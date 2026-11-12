import type { Endpoint, PayloadRequest } from 'payload'
import { z } from 'zod'
import { sql } from '@payloadcms/db-postgres'
import { ApiError, endpoint, fail, json, readBody, param } from '../lib/respond'
import { accountRef, requireVerifiedMember, verifiedContext } from '../lib/accounts'
import { hasCapability } from '../lib/access'
import * as store from '../lib/content'
import { rateLimit } from '../lib/rateLimit'
import { cleanText } from '../lib/text'
import { audit } from '../lib/audit'
import { isUniqueViolation, txHandle } from '../lib/pg'
import type { Doc, AnyValue } from '../lib/domain'

const intelligenceLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  scope: 'intelligence',
})

type Evidence = {
  evidenceId: string
  sourceType: string
  title: string
  snippet: string
  url: string
}

async function evidenceForQuery(
  req: PayloadRequest,
  query: string,
  access: AnyValue,
  limit: number,
): Promise<Evidence[]> {
  const needle = query.toLowerCase()
  const terms = needle.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  const evidence: Evidence[] = []
  const push = (sourceType: string, title: string, snippet: string, url: string) => {
    const score = terms.reduce(
      (n, t) =>
        n + (title.toLowerCase().includes(t) ? 3 : 0) + (snippet.toLowerCase().includes(t) ? 1 : 0),
      0,
    )
    if (score > 0) {
      evidence.push({
        evidenceId: `${sourceType}:${evidence.length + 1}`,
        sourceType,
        title,
        snippet: snippet.slice(0, 280),
        url,
      })
      ;(evidence[evidence.length - 1] as Doc).score = score
    }
  }

  const [events, announcements, groups, submissions, decisions] = await Promise.all([
    store.listEvents(req),
    store.listAnnouncements(req),
    store.listGroups(req),
    store.listSubmissions(req, 'all'),
    store.listDecisions(req, 'all', true),
  ])
  for (const e of events) push('event', e.title, e.description || '', `/events/${e.slug}`)
  for (const a of announcements)
    push('announcement', a.title, a.body || '', `/announcements/${a.slug}`)
  for (const g of groups)
    push('working_group', g.name, g.focusLine || g.description || '', `/groups/${g.slug}`)
  for (const s of submissions)
    push('submission', s.title, s.summary || '', `/submissions/${s.slug}`)
  for (const d of decisions)
    push('council_decision', d.title, d.summary || '', `/decisions/${d.slug}`)
  if (hasCapability(access, 'intelligence.contacts.read')) {
    for (const c of await store.listDirectory(req))
      push('contact', c.personName || c.roleTitle, c.roleTitle || '', `/directory`)
  }
  // Members always see their own role/record context
  if (access.accountId) {
    for (const a of access.records || [])
      push(
        'authority_record',
        `Your role: ${a.role}`,
        `Scope: ${a.scopeType} ${a.scopeId || ''}`,
        '/profile',
      )
  }
  evidence.sort((a, b) => (b as Doc).score - (a as Doc).score)
  return evidence.slice(0, Math.max(1, Math.min(25, limit)))
}

const writebackView = (row: Doc) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  note: row.note,
  citations: row.citations,
  status: row.status,
  account: accountRef(row.account),
  idempotencyKey: row.idempotencyKey || null,
  approvedBy: typeof row.approvedBy === 'object' ? row.approvedBy?.id : row.approvedBy,
  appliedBy: typeof row.appliedBy === 'object' ? row.appliedBy?.id : row.appliedBy,
  appliedAt: row.appliedAt || null,
  reviewedAt: row.reviewedAt || null,
  createdAt: row.createdAt,
})

// evidence ids from the search page, or full { title, url } sources
const text = (max: number) => z.string().transform((v) => cleanText(v, max))
const citationsSchema = z
  .array(
    z.union([
      text(120).pipe(z.string().min(1)),
      z.object({
        evidenceId: text(120).optional(),
        sourceType: text(40).optional(),
        title: text(300).pipe(z.string().min(1)),
        snippet: text(400).optional(),
        // same-origin path or http(s) only
        url: z
          .string()
          .max(500)
          // no `//` or `/\` after the leading slash: browsers read both as protocol-relative
          .regex(/^(\/(?![/\\])|https?:\/\/)/),
      }),
    ]),
  )
  .min(1)
  .max(50)

const reloadNote = (req: PayloadRequest, id: AnyValue) =>
  req.payload.findByID({ collection: 'research-notes', id, depth: 0, overrideAccess: true })

// compare-and-set the status and audit it in one tx (same join/commit shape as
// withAuthorityLock); no row claimed → 409, which rolls back
async function transition(
  req: PayloadRequest,
  claim: ReturnType<typeof sql>,
  conflict: string,
  record: () => Promise<void>,
) {
  const apply = async (transactionID: AnyValue) => {
    const { rows } = await (req.payload.db as Doc).execute({
      db: txHandle(req.payload, transactionID),
      sql: claim,
    })
    if (!rows?.length) throw new ApiError(409, 'conflict', conflict)
    await record()
  }
  // joined tx: the caller owns commit/rollback
  if (req.transactionID != null) return apply(req.transactionID)
  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Database transactions are unavailable.')
  req.transactionID = transactionID
  try {
    await apply(transactionID)
    await req.payload.db.commitTransaction(transactionID)
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  } finally {
    delete req.transactionID
  }
}

export const intelligenceEndpoints: Endpoint[] = [
  {
    path: '/intelligence/query',
    method: 'post',
    handler: endpoint(async (req) => {
      await intelligenceLimit(req)
      const { account, access } = await verifiedContext(req)
      const b = await readBody(req)
      const query = String(b.query || '').trim()
      if (query.length < 3 || query.length > 500)
        throw fail.validation({ query: 'Ask a question of 3–500 characters.' })
      // junk limits fall back to 10; evidenceForQuery clamps to 1–25
      const limit = Math.trunc(Number(b.limit)) || 10
      const evidence = await evidenceForQuery(req, query, access, limit)
      const bullets = evidence.slice(0, 4).map((e, i) => ({
        text: `${e.title} — ${e.snippet || e.sourceType}`,
        citationIndexes: [i + 1],
      }))
      const answer = evidence.length
        ? `Found ${evidence.length} relevant record${evidence.length === 1 ? '' : 's'} across the Hub.`
        : 'No directly matching records were found. Try a more specific title, working group, deadline, or location.'
      await audit(req, account, {
        action: 'intelligence.query',
        after: { queryLength: query.length, results: evidence.length },
      })
      return json({
        query,
        audience: hasCapability(access, 'intelligence.operations.read') ? 'operator' : 'member',
        evidence,
        citations: evidence.map((e, i) => ({ ...e, evidenceId: `E${i + 1}` })),
        synthesis: {
          answer,
          bullets: bullets.map((bl) => ({
            ...bl,
            citationIndexes: bl.citationIndexes,
          })),
          confidence: evidence.length >= 4 ? 'medium' : evidence.length ? 'low' : 'none',
          caveat:
            'This synthesis is derived only from records your account can access; verify the cited sources before acting on it.',
        },
      })
    }),
  },
  {
    path: '/intelligence/writebacks',
    method: 'get',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      const isOperator = hasCapability(access, 'intelligence.operations.read')
      const where: AnyValue = isOperator ? {} : { account: { equals: account.id } }
      const { docs } = await req.payload.find({
        collection: 'research-notes',
        where,
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
        // depth 1 so accountRef carries the author's name for the review queue
        depth: 1,
      })
      return json({ items: docs.map(writebackView) })
    }),
  },
  {
    path: '/intelligence/writebacks',
    method: 'post',
    handler: endpoint(async (req) => {
      await intelligenceLimit(req)
      const account = requireVerifiedMember(req)
      const b = await readBody(req)
      if (b.action !== 'save_research_note')
        throw fail.validation({ action: 'Unsupported writeback action.' })
      const title = cleanText(b.title, 160)
      const note = cleanText(b.note || b.body, 4000)
      const parsed = citationsSchema.safeParse(b.citations)
      if (!parsed.success)
        throw fail.validation({
          citations: 'Give 1–50 citations, each an evidence id or a { title, url } source.',
        })
      const citations = parsed.data
      if (!title || !note)
        throw fail.validation({ note: 'A research note needs a title and a body.' })
      const idempotencyKey = String(
        req.headers.get('idempotency-key') || b.idempotencyKey || '',
      ).slice(0, 120)
      const existing = async () =>
        (
          await req.payload.find({
            collection: 'research-notes',
            where: {
              account: { equals: account.id },
              idempotencyKey: { equals: idempotencyKey },
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
        ).docs[0]
      if (idempotencyKey) {
        const dup = await existing()
        if (dup) return json({ item: writebackView(dup) }, { status: 200 })
      }
      let item
      try {
        item = await req.payload.create({
          collection: 'research-notes',
          data: {
            account: account.id,
            title,
            note,
            citations,
            status: 'pending_review',
            idempotencyKey: idempotencyKey || null,
          },
          depth: 0,
          overrideAccess: true,
          req,
        })
      } catch (error) {
        // a concurrent retry won the (account, key) unique index — hand back its note
        if (!idempotencyKey || !isUniqueViolation(error, 'research-notes', 'research_notes'))
          throw error
        const dup = await existing()
        if (!dup) throw error
        return json({ item: writebackView(dup) }, { status: 200 })
      }
      await audit(req, account, {
        action: 'intelligence.writeback_proposed',
        targetType: 'research_note',
        targetId: String(item.id),
      })
      return json({ item: writebackView(item) }, { status: 201 })
    }),
  },
  {
    path: '/intelligence/writebacks/:id/approve',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      if (!hasCapability(access, 'intelligence.writeback.approve'))
        throw fail.forbidden('Research notes are approved by platform officers.')
      const id = param(req, 'id')
      const reason = cleanText((await readBody(req)).reason, 500)
      if (reason.length < 8)
        throw fail.validation({ reason: 'A reason of at least 8 characters is required.' })
      const row = (await req.payload.findByID({
        collection: 'research-notes',
        id,
        overrideAccess: true,
        req,
      })) as Doc
      if (!row) throw fail.notFound()
      if (
        String(typeof row.account === 'object' ? row.account.id : row.account) ===
        String(account.id)
      )
        throw new ApiError(
          409,
          'separation_of_duties',
          'A research note must be approved by an operator other than its author.',
        )
      // a concurrent approval claims zero rows here
      await transition(
        req,
        sql`UPDATE research_notes
               SET status = 'approved', approved_by_id = ${account.id},
                   reviewed_at = now(), updated_at = now()
             WHERE id = ${row.id} AND status IN ('pending_review', 'draft')
               AND account_id <> ${account.id}
         RETURNING id`,
        'This note was already reviewed.',
        () =>
          audit(req, account, {
            action: 'intelligence.writeback_approved',
            targetType: 'research_note',
            targetId: id,
            reason,
          }),
      )
      const updated = await reloadNote(req, row.id)
      return json({ item: writebackView(updated) })
    }),
  },
  {
    path: '/intelligence/writebacks/:id/apply',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      if (!hasCapability(access, 'intelligence.writeback.apply'))
        throw fail.forbidden('Research notes are applied by platform officers.')
      const id = param(req, 'id')
      const row = (await req.payload.findByID({
        collection: 'research-notes',
        id,
        overrideAccess: true,
        req,
      })) as Doc
      if (!row) throw fail.notFound()
      const approverId = typeof row.approvedBy === 'object' ? row.approvedBy?.id : row.approvedBy
      if (String(approverId) === String(account.id))
        throw new ApiError(
          409,
          'separation_of_duties',
          'A research note must be applied by a different operator than its approver.',
        )
      // only an approved note moves, and only once
      await transition(
        req,
        sql`UPDATE research_notes
               SET status = 'applied', applied_by_id = ${account.id},
                   applied_at = now(), updated_at = now()
             WHERE id = ${row.id} AND status = 'approved'
               AND approved_by_id IS DISTINCT FROM ${account.id}
         RETURNING id`,
        'Only approved notes can be applied.',
        () =>
          audit(req, account, {
            action: 'intelligence.writeback_applied',
            targetType: 'research_note',
            targetId: id,
          }),
      )
      const updated = await reloadNote(req, row.id)
      return json({ item: writebackView(updated) })
    }),
  },
  {
    path: '/intelligence/metrics',
    method: 'get',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      const isOperator = hasCapability(access, 'intelligence.operations.read')
      const where: AnyValue = isOperator ? {} : { account: { equals: account.id } }
      const notes = await req.payload.find({
        collection: 'research-notes',
        where,
        limit: 500,
        overrideAccess: true,
      })
      const byStatus = (notes.docs as Doc[]).reduce<Record<string, number>>((acc, n) => {
        acc[n.status] = (acc[n.status] || 0) + 1
        return acc
      }, {})
      return json({
        notesTotal: notes.totalDocs,
        byStatus,
        semanticEnabled: false,
      })
    }),
  },
]
