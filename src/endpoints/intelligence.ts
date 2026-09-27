import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { requireVerifiedMember } from '../lib/accounts'
import { getAccessProfile, hasCapability } from '../lib/access'
import * as store from '../lib/content'
import { rateLimit } from '../lib/rateLimit'
import { audit } from '../lib/audit'

const intelligenceLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  scope: 'intelligence',
})

const trimmed = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)

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
  access: any,
  limit: number,
): Promise<Evidence[]> {
  const needle = query.toLowerCase()
  const terms = needle.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)
  const evidence: Evidence[] = []
  const push = (
    sourceType: string,
    title: string,
    snippet: string,
    url: string,
  ) => {
    const score = terms.reduce(
      (n, t) =>
        n +
        (title.toLowerCase().includes(t) ? 3 : 0) +
        (snippet.toLowerCase().includes(t) ? 1 : 0),
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
      ;(evidence[evidence.length - 1] as any).score = score
    }
  }

  const [events, announcements, groups, submissions, decisions] =
    await Promise.all([
      store.listEvents(req),
      store.listAnnouncements(req),
      store.listGroups(req),
      store.listSubmissions(req, 'all'),
      store.listDecisions(req, 'all', true),
    ])
  for (const e of events)
    push('event', e.title, e.description || '', `/events/${e.slug}`)
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
      push('contact', c.name, c.role || '', `/directory`)
  }
  // Members always see their own role/assignment context
  if (access.accountId) {
    for (const a of access.assignments || [])
      push(
        'assignment',
        `Your role: ${a.role}`,
        `Scope: ${a.scopeType} ${a.scopeId || ''}`,
        '/profile',
      )
  }
  evidence.sort((a, b) => (b as any).score - (a as any).score)
  return evidence.slice(0, Math.max(1, Math.min(25, limit)))
}

const writebackView = (row: any) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  note: row.note,
  citations: row.citations,
  status: row.status,
  accountId:
    typeof row.account === 'object' ? row.account?.id : row.account,
  accountEmail:
    typeof row.account === 'object' ? row.account?.email : null,
  idempotencyKey: row.idempotencyKey || null,
  approvedBy:
    typeof row.approvedBy === 'object' ? row.approvedBy?.id : row.approvedBy,
  appliedBy:
    typeof row.appliedBy === 'object' ? row.appliedBy?.id : row.appliedBy,
  appliedAt: row.appliedAt || null,
  reviewedAt: row.reviewedAt || null,
  createdAt: row.createdAt,
})

export const intelligenceEndpoints: Endpoint[] = [
  {
    path: '/intelligence/query',
    method: 'post',
    handler: endpoint(async (req) => {
      intelligenceLimit(req)
      const account = requireVerifiedMember(req)
      const access = await getAccessProfile(req, account)
      const b = ((await req.json?.()) || {}) as any
      const query = String(b.query || '').trim()
      if (query.length < 3 || query.length > 500)
        throw fail.validation({ query: 'Ask a question of 3–500 characters.' })
      const limit = Number(b.limit || 10)
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
        audience: account.role === 'admin' ? 'admin' : 'member',
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
      const account = requireVerifiedMember(req)
      const isAdmin = account.role === 'admin'
      const where: any = isAdmin ? {} : { account: { equals: account.id } }
      const { docs } = await req.payload.find({
        collection: 'research-notes',
        where,
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
        depth: 1,
      })
      return json({ items: docs.map(writebackView) })
    }),
  },
  {
    path: '/intelligence/writebacks',
    method: 'post',
    handler: endpoint(async (req) => {
      intelligenceLimit(req)
      const account = requireVerifiedMember(req)
      const b = ((await req.json?.()) || {}) as any
      if (b.action !== 'save_research_note')
        throw fail.validation({ action: 'Unsupported writeback action.' })
      const title = trimmed(b.title, 160)
      const note = trimmed(b.note || b.body, 4000)
      const citations = Array.isArray(b.citations) ? b.citations.slice(0, 50) : []
      if (!title || !note || !citations.length)
        throw fail.validation({
          note: 'A research note needs a title, body, and at least one citation.',
        })
      const idempotencyKey = String(
        req.headers.get('idempotency-key') || b.idempotencyKey || '',
      ).slice(0, 120)
      if (idempotencyKey) {
        const dup = await req.payload.find({
          collection: 'research-notes',
          where: {
            account: { equals: account.id },
            idempotencyKey: { equals: idempotencyKey },
          },
          limit: 1,
          overrideAccess: true,
        })
        if (dup.docs[0])
          return json({ item: writebackView(dup.docs[0]) }, { status: 200 })
      }
      const item = await req.payload.create({
        collection: 'research-notes',
        data: {
          account: account.id,
          title,
          note,
          citations,
          status: 'pending_review',
          idempotencyKey: idempotencyKey || null,
        } as any,
        overrideAccess: true,
        req,
      })
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
      const account = requireVerifiedMember(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Research notes are approved by administrators.')
      const id = String(req.routeParams?.id)
      const row = (await req.payload.findByID({
        collection: 'research-notes',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!row) throw fail.notFound()
      if (String(typeof row.account === 'object' ? row.account.id : row.account) === String(account.id))
        throw new ApiError(
          409,
          'separation_of_duties',
          'A research note must be approved by a different administrator than its author.',
        )
      if (!['pending_review', 'draft'].includes(row.status))
        throw new ApiError(409, 'conflict', 'This note was already reviewed.')
      const updated = await req.payload.update({
        collection: 'research-notes',
        id,
        data: {
          status: 'approved',
          approvedBy: account.id,
          reviewedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'intelligence.writeback_approved',
        targetType: 'research_note',
        targetId: id,
      })
      return json({ item: writebackView(updated) })
    }),
  },
  {
    path: '/intelligence/writebacks/:id/apply',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Research notes are applied by administrators.')
      const id = String(req.routeParams?.id)
      const row = (await req.payload.findByID({
        collection: 'research-notes',
        id,
        overrideAccess: true,
        req,
      })) as any
      if (!row) throw fail.notFound()
      if (row.status !== 'approved')
        throw new ApiError(409, 'conflict', 'Only approved notes can be applied.')
      const approverId =
        typeof row.approvedBy === 'object' ? row.approvedBy?.id : row.approvedBy
      if (String(approverId) === String(account.id))
        throw new ApiError(
          409,
          'separation_of_duties',
          'A research note must be applied by a different administrator than its approver.',
        )
      const updated = await req.payload.update({
        collection: 'research-notes',
        id,
        data: {
          status: 'applied',
          appliedBy: account.id,
          appliedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
        req,
      })
      await audit(req, account, {
        action: 'intelligence.writeback_applied',
        targetType: 'research_note',
        targetId: id,
      })
      return json({ item: writebackView(updated) })
    }),
  },
  {
    path: '/intelligence/metrics',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const isAdmin = account.role === 'admin'
      const where: any = isAdmin ? {} : { account: { equals: account.id } }
      const notes = await req.payload.find({
        collection: 'research-notes',
        where,
        limit: 500,
        overrideAccess: true,
      })
      const byStatus = (notes.docs as any[]).reduce<Record<string, number>>(
        (acc, n) => {
          acc[n.status] = (acc[n.status] || 0) + 1
          return acc
        },
        {},
      )
      return json({
        notesTotal: notes.totalDocs,
        byStatus,
        semanticEnabled: false,
      })
    }),
  },
]
