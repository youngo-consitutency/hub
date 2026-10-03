import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import { requireCwMember, requireVerifiedMember, verifiedContext } from '../lib/accounts'
import { isUniqueViolation } from '../lib/pg'
import { DECISION_TYPES, RED_FLAG_CATEGORIES } from '../lib/decisions'
import {
  accountRef,
  advanceIfDue,
  ballotView,
  checkVeto,
  commentView,
  flagView,
  isBodyMember,
  isContactPerson,
  loadProposal,
  computeWindows,
  proposalFlags,
  proposalView,
  recordEvent,
  vetoView,
} from '../lib/decisionRuntime'

// S09 decision workflow endpoints. Members act through these — direct REST
// writes on the decision collections are staff-only (see Decisions.ts), so
// every transition below also appends to decision-events and audit-log.
// The state machine itself lives in src/lib/decisionRuntime.ts so the
// platform bridge (src/modules/platform/decisionsBridge.ts) shares it.

// A duplicate (proposal, account) insert can surface as the raw PostgreSQL
// 23505 or the ValidationError the drizzle adapter converts it into. The
// ballots table's only unique constraint is this pair — the serial primary
// key cannot collide — so either shape is unambiguous here.
const isDuplicateBallot = (error: unknown) =>
  isUniqueViolation(error, 'decision-ballots', 'decision_ballots')

export const decisionEndpoints: Endpoint[] = [
  {
    path: '/decisions',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const where: any = {}
      const body = req.query?.body as string | undefined
      const status = req.query?.status as string | undefined
      if (body) where.body = { equals: body }
      if (status) where.status = { equals: status }
      const { docs } = await req.payload.find({
        collection: 'decision-proposals',
        where,
        sort: '-createdAt',
        limit: 100,
        overrideAccess: true,
      })
      const items = []
      for (const p of docs as any[]) {
        items.push(proposalView(await advanceIfDue(req, p)))
      }
      return json({ items })
    }),
  },
  {
    path: '/decisions',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!b.context?.trim()) fields.context = 'Required.'
      if (!b.proposalText?.trim()) fields.proposalText = 'Required.'
      if (!DECISION_TYPES.includes(b.decisionType)) fields.decisionType = 'Invalid.'
      if (!b.body) fields.body = 'Required.'
      if (b.decisionType === 'snap') {
        if (!b.snapJustification?.trim())
          fields.snapJustification = 'Snap decisions require a justification.'
        if (!b.snapDeadline) fields.snapDeadline = 'Snap decisions require a deadline.'
      }
      if (Object.keys(fields).length) throw fail.validation(fields)
      const proposal = await req.payload.create({
        collection: 'decision-proposals',
        data: {
          title: b.title.trim(),
          context: b.context.trim(),
          proposalText: b.proposalText.trim(),
          decisionType: b.decisionType,
          body: b.body,
          bodyRef: b.bodyRef?.trim() || null,
          snapJustification: b.snapJustification?.trim() || null,
          snapDeadline: b.snapDeadline ?? null,
          status: 'draft',
          proposedBy: account.id,
          contactPersons:
            Array.isArray(b.contactPersons) && b.contactPersons.length
              ? b.contactPersons
              : [account.id],
        } as any,
        overrideAccess: true,
      })
      await recordEvent(req, proposal.id, 'created', account)
      return json({ proposal: proposalView(proposal) }, { status: 201 })
    }),
  },
  {
    path: '/decisions/:id',
    method: 'get',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      let p = await loadProposal(req, param(req, 'id'))
      p = await advanceIfDue(req, p)
      p = await checkVeto(req, p)
      const flags = await proposalFlags(req, p.id)
      const { docs: comments } = await req.payload.find({
        collection: 'decision-comments',
        where: { proposal: { equals: p.id } },
        sort: 'createdAt',
        limit: 500,
        overrideAccess: true,
      })
      const { totalDocs: ballots } = await req.payload.find({
        collection: 'decision-ballots',
        where: { proposal: { equals: p.id } },
        limit: 0,
        overrideAccess: true,
      })
      const { docs: mine } = await req.payload.find({
        collection: 'decision-ballots',
        where: {
          and: [{ proposal: { equals: p.id } }, { account: { equals: account.id } }],
        },
        limit: 1,
        overrideAccess: true,
      })
      return json({
        proposal: proposalView(p, flags, {
          comments: (comments as any[]).length,
          ballots,
        }),
        comments: (comments as any[]).map(commentView),
        myBallot: mine[0] ? ballotView(mine[0]) : null,
      })
    }),
  },
  {
    path: '/decisions/:id/present',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      let p = await loadProposal(req, param(req, 'id'))
      if (!isContactPerson(account, p))
        throw fail.forbidden('Only the contact person(s) may present the proposal.')
      if (p.status !== 'draft')
        throw fail.conflict('invalid_phase', 'Only draft proposals can be presented.')
      const windows = computeWindows(
        p.decisionType,
        new Date(),
        p.snapDeadline ? new Date(p.snapDeadline) : null,
      )
      p = await req.payload.update({
        collection: 'decision-proposals',
        id: p.id,
        data: {
          status: 'consultation',
          presentedAt: new Date().toISOString(),
          ...windows,
        },
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'presented', account, windows)
      return json({ proposal: proposalView(p) })
    }),
  },
  {
    path: '/decisions/:id/comments',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const p = await advanceIfDue(req, await loadProposal(req, param(req, 'id')))
      if (!['consultation', 'decision'].includes(p.status))
        throw fail.conflict(
          'invalid_phase',
          'Comments are only open during consultation or decision periods.',
        )
      const b = await readBody(req)
      if (!b.body?.trim()) throw fail.validation({ body: 'Required.' })
      const comment = await req.payload.create({
        collection: 'decision-comments',
        data: {
          proposal: p.id,
          account: account.id,
          body: b.body.trim(),
          createdAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'commented', account)
      return json({ comment }, { status: 201 })
    }),
  },
  {
    path: '/decisions/:id/flags',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const p = await advanceIfDue(req, await loadProposal(req, param(req, 'id')))
      if (!['consultation', 'decision'].includes(p.status))
        throw fail.conflict(
          'invalid_phase',
          'Flags may only be raised during consultation or decision periods.',
        )
      if (!(await isBodyMember(req, account, p)))
        throw fail.forbidden('Only members of the decision-making body may raise flags.')
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      if (!['red', 'grey'].includes(b.kind)) fields.kind = 'Must be red or grey.'
      if (!b.reason?.trim()) fields.reason = 'Required.'
      if (b.kind === 'red') {
        if (!RED_FLAG_CATEGORIES.includes(b.rationaleCategory))
          fields.rationaleCategory = 'Required for red flags.'
        if (!b.alternative?.trim())
          fields.alternative = 'Red flags require an alternative proposal.'
      }
      if (Object.keys(fields).length) throw fail.validation(fields)
      const flag = await req.payload.create({
        collection: 'decision-flags',
        data: {
          proposal: p.id,
          kind: b.kind,
          rationaleCategory: b.kind === 'red' ? b.rationaleCategory : null,
          reason: b.reason.trim(),
          alternative: b.alternative?.trim() || null,
          raisedBy: account.id,
          status: 'open',
          raisedAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await recordEvent(req, p.id, `flag_${b.kind}_raised`, account, { flagId: flag.id })
      return json({ flag: flagView(flag) }, { status: 201 })
    }),
  },
  {
    path: '/decisions/:id/flags/:flagId/respond',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const p = await loadProposal(req, param(req, 'id'))
      if (!isContactPerson(account, p))
        throw fail.forbidden('Only contact person(s) respond to flags.')
      const flag = await req.payload
        .findByID({
          collection: 'decision-flags',
          id: Number(param(req, 'flagId')),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Flag not found.')
        })
      if (!['open'].includes((flag as any).status))
        throw fail.conflict('invalid_phase', 'Flag is no longer open.')
      const b = await readBody(req)
      const updated = await req.payload.update({
        collection: 'decision-flags',
        id: flag.id,
        data: {
          status: 'addressed',
          responseNote: b.responseNote?.trim() || null,
          respondedBy: account.id,
          respondedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'flag_responded', account, { flagId: flag.id })
      return json({ flag: flagView(updated) })
    }),
  },
  {
    path: '/decisions/:id/flags/:flagId/withdraw',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const p = await loadProposal(req, param(req, 'id'))
      const flag = await req.payload
        .findByID({
          collection: 'decision-flags',
          id: Number(param(req, 'flagId')),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Flag not found.')
        })
      const raiser = (flag as any).raisedBy?.id ?? (flag as any).raisedBy
      // S09: a flag is withdrawn by its raiser or through the documented
      // nullification/escalation process — never by administrator override.
      if (raiser !== account.id) throw fail.forbidden('Only the flag raiser may withdraw it.')
      const updated = await req.payload.update({
        collection: 'decision-flags',
        id: flag.id,
        data: { status: 'withdrawn' },
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'flag_withdrawn', account, { flagId: flag.id })
      return json({ flag: flagView(updated) })
    }),
  },
  {
    path: '/decisions/:id/close',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      let p = await loadProposal(req, param(req, 'id'))
      if (!isContactPerson(account, p))
        throw fail.forbidden('Only contact person(s) may close the decision period.')
      p = await advanceIfDue(req, p)
      if (['adopted', 'vetoed', 'withdrawn', 'rejected', 'failed_quorum'].includes(p.status))
        return json({ proposal: proposalView(p) })
      if (!['consultation', 'revision', 'decision', 'voting'].includes(p.status))
        throw fail.conflict('invalid_phase', `Cannot close while status is ${p.status}.`)
      // The contact person confirms the consultation outcome and closes the
      // remaining windows (S09 §2 step 5-6): mark every pending phase
      // deadline as elapsed, then let the state machine resolve the chain
      // (consensus, consensus-with-reservations, or vote → tally).
      const past = new Date(Date.now() - 1000).toISOString()
      p = await req.payload.update({
        collection: 'decision-proposals',
        id: p.id,
        data: {
          consultationEndsAt: past,
          revisionEndsAt: past,
          decisionEndsAt: past,
          ...(p.status === 'voting' ? { votingEndsAt: past } : {}),
        },
        overrideAccess: true,
      })
      p = await advanceIfDue(req, p)
      return json({ proposal: proposalView(p) })
    }),
  },
  {
    path: '/decisions/:id/ballots',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const p = await advanceIfDue(req, await loadProposal(req, param(req, 'id')))
      if (p.status !== 'voting')
        throw fail.conflict('invalid_phase', 'Voting is not open for this proposal.')
      if (!(await isBodyMember(req, account, p)))
        throw fail.forbidden('Only members of the decision-making body may vote.')
      const b = await readBody(req)
      const options = (p.ballotOptions ?? []).map((o: any) => o.option)
      if (!options.includes(b.choice))
        throw fail.validation({ choice: `Must be one of: ${options.join(', ')}.` })
      const hasBallot = async () => {
        const { totalDocs } = await req.payload.find({
          collection: 'decision-ballots',
          where: {
            and: [{ proposal: { equals: p.id } }, { account: { equals: account.id } }],
          },
          limit: 0,
          overrideAccess: true,
        })
        return totalDocs > 0
      }
      if (await hasBallot()) throw fail.conflict('already_voted', 'Each member may vote once.')
      let ballot
      try {
        ballot = await req.payload.create({
          collection: 'decision-ballots',
          data: {
            proposal: p.id,
            account: account.id,
            choice: b.choice,
            castAt: new Date().toISOString(),
          } as any,
          overrideAccess: true,
        })
      } catch (error: any) {
        // The pre-check is only a fast path: concurrent submissions can both
        // see zero ballots, so the unique (proposal, account) index is the
        // real guard. Converted error shapes vary between drizzle paths, so
        // also re-confirm against the table — a row for this pair after a
        // failed insert means the race was lost, whatever the error was.
        if (isDuplicateBallot(error) || (await hasBallot()))
          throw fail.conflict('already_voted', 'Each member may vote once.')
        throw error
      }
      await recordEvent(req, p.id, 'ballot_cast', account)
      return json({ ballot: ballotView(ballot) }, { status: 201 })
    }),
  },
  {
    path: '/decisions/:id/vetoes',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const p = await advanceIfDue(req, await loadProposal(req, param(req, 'id')))
      if (p.status !== 'voting')
        throw fail.conflict('invalid_phase', 'A veto may only stop an open vote.')
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      if (!['org', 'org_global_south', 'wg_or_ot'].includes(b.requesterKind))
        fields.requesterKind = 'Must be org, org_global_south or wg_or_ot.'
      if (!b.groupKey?.trim()) fields.groupKey = 'Required.'
      if (!b.reasoning?.trim()) fields.reasoning = 'A veto request requires detailed reasoning.'
      if (Object.keys(fields).length) throw fail.validation(fields)
      const veto = await req.payload.create({
        collection: 'decision-vetoes',
        data: {
          proposal: p.id,
          requesterKind: b.requesterKind,
          groupKey: b.groupKey.trim(),
          reasoning: b.reasoning.trim(),
          requestedBy: account.id,
          status: 'pending',
          createdAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'veto_requested', account, { vetoId: veto.id })
      return json({ veto: vetoView(veto) }, { status: 201 })
    }),
  },
  {
    path: '/decisions/:id/vetoes/:vetoId/confirm',
    method: 'post',
    handler: endpoint(async (req) => {
      const { account, access } = await verifiedContext(req)
      // Verifying a veto request against eligible representation is a
      // coordination duty (GCT), not a technical-administration function.
      if (!access.capabilities.includes('gct.coordinate'))
        throw fail.forbidden('Veto requests are confirmed by the coordination team.')
      let p = await loadProposal(req, param(req, 'id'))
      const veto = await req.payload
        .findByID({
          collection: 'decision-vetoes',
          id: Number(param(req, 'vetoId')),
          overrideAccess: true,
        })
        .catch(() => {
          throw fail.notFound('Veto request not found.')
        })
      const updated = await req.payload.update({
        collection: 'decision-vetoes',
        id: veto.id,
        data: { status: 'confirmed' },
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'veto_confirmed', account, { vetoId: veto.id })
      p = await checkVeto(req, p)
      return json({ veto: vetoView(updated), proposal: proposalView(p) })
    }),
  },
  {
    path: '/decisions/:id/withdraw',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const p = await loadProposal(req, param(req, 'id'))
      if (!isContactPerson(account, p))
        throw fail.forbidden('Only contact person(s) may withdraw the proposal.')
      if (['adopted', 'vetoed', 'rejected', 'failed_quorum', 'withdrawn'].includes(p.status))
        throw fail.conflict('invalid_phase', 'Decision already concluded.')
      const updated = await req.payload.update({
        collection: 'decision-proposals',
        id: p.id,
        data: { status: 'withdrawn', decidedAt: new Date().toISOString() },
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'withdrawn', account)
      return json({ proposal: proposalView(updated) })
    }),
  },
  {
    path: '/decisions/:id/events',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const p = await loadProposal(req, param(req, 'id'))
      const { docs } = await req.payload.find({
        collection: 'decision-events',
        where: { proposal: { equals: p.id } },
        sort: 'createdAt',
        limit: 500,
        overrideAccess: true,
      })
      return json({
        items: (docs as any[]).map((e) => ({
          id: e.id,
          type: e.type,
          actor: accountRef(e.actor),
          detail: e.detail,
          createdAt: e.createdAt,
        })),
      })
    }),
  },
]
