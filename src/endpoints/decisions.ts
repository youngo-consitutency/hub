import type { Endpoint } from 'payload'
import { endpoint, fail, json, readBody, param } from '../lib/respond'
import {
  accountRef,
  requireCwMember,
  requireVerifiedMember,
  verifiedContext,
} from '../lib/accounts'
import { isUniqueViolation } from '../lib/pg'
import { requireCronSecret } from '../lib/cron'
import { DECISION_TYPES, RED_FLAG_CATEGORIES, snapDeadlinePassed } from '../lib/decisions'
import { getAccessProfile, hasCapability } from '../lib/access'
import {
  advanceIfDue,
  ballotSeatKeys,
  ballotView,
  checkVeto,
  commentView,
  flagView,
  ids,
  isBodyMember,
  isContactPerson,
  loadProposal,
  computeWindows,
  proposalFlags,
  proposalView,
  recordEvent,
  sweepDueDecisions,
  transition,
  vetoView,
  withProposalLock,
} from '../lib/decisionRuntime'
import type { AccountLike, Doc, AnyValue } from '../lib/domain'

// S09 decision workflow endpoints — members act through these; collection
// REST writes are staff-only, and every transition is audited. The state
// machine lives in src/lib/decisionRuntime.ts (shared with the bridge).

// A duplicate (proposal, account) surfaces as raw 23505 or a converted
// ValidationError — ballots' only unique constraint is this pair.
const isDuplicateBallot = (error: unknown) =>
  isUniqueViolation(error, 'decision-ballots', 'decision_ballots')

// a child row only answers under the proposal it belongs to
const ownedBy = (row: Doc, proposal: Doc) => ids(row.proposal)[0] === proposal.id

const DECISION_BODIES = ['council', 'working_group', 'operational_team', 'gct', 'constituency']

export const decisionEndpoints: Endpoint[] = [
  {
    path: '/decisions',
    method: 'get',
    handler: endpoint(async (req) => {
      requireVerifiedMember(req)
      const where: AnyValue = {}
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
      for (const p of docs as Doc[]) {
        items.push(proposalView(await advanceIfDue(req, p)))
      }
      return json({ items })
    }),
  },
  {
    path: '/decisions',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const b = await readBody(req)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!b.context?.trim()) fields.context = 'Required.'
      if (!b.proposalText?.trim()) fields.proposalText = 'Required.'
      if (!DECISION_TYPES.includes(b.decisionType)) fields.decisionType = 'Invalid.'
      if (!b.body) fields.body = 'Required.'
      else if (!DECISION_BODIES.includes(b.body)) fields.body = 'Invalid.'
      if (b.decisionType === 'snap') {
        if (!b.snapJustification?.trim())
          fields.snapJustification = 'Snap decisions require a justification.'
        if (!b.snapDeadline) fields.snapDeadline = 'Snap decisions require a deadline.'
        else if (snapDeadlinePassed('snap', b.snapDeadline))
          fields.snapDeadline = 'Must be a future date.'
      }
      if (Object.keys(fields).length) throw fail.validation(fields)
      // proposers and their contact persons must sit in the body they propose to
      const scope = { body: b.body, bodyRef: b.bodyRef?.trim() || null }
      if (!(await isBodyMember(req, account, scope)))
        throw fail.forbidden('Only members of the decision-making body may propose to it.')
      const contacts: number[] =
        Array.isArray(b.contactPersons) && b.contactPersons.length
          ? b.contactPersons.map(Number)
          : [account.id]
      for (const id of contacts) {
        if (id === account.id) continue
        const contact = Number.isInteger(id)
          ? await req.payload
              .findByID({ collection: 'accounts', id, overrideAccess: true })
              .catch(() => null)
          : null
        if (!contact || !(await isBodyMember(req, contact as unknown as AccountLike, scope)))
          throw fail.validation({ contactPersons: 'Contact persons must be members of the body.' })
      }
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
          contactPersons: contacts,
        },
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
      // capped: comment volume is member-driven
      const { docs: comments, totalDocs: commentCount } = await req.payload.find({
        collection: 'decision-comments',
        where: { proposal: { equals: p.id } },
        sort: 'createdAt',
        limit: 500,
        overrideAccess: true,
      })
      const { totalDocs: ballots } = await req.payload.count({
        collection: 'decision-ballots',
        where: { proposal: { equals: p.id } },
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
          comments: commentCount,
          ballots,
        }),
        comments: (comments as Doc[]).map(commentView),
        myBallot: mine[0] ? ballotView(mine[0]) : null,
      })
    }),
  },
  {
    path: '/decisions/:id/present',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireVerifiedMember(req)
      const p = await loadProposal(req, param(req, 'id'))
      if (!isContactPerson(account, p))
        throw fail.forbidden('Only the contact person(s) may present the proposal.')
      if (p.status !== 'draft')
        throw fail.conflict('invalid_phase', 'Only draft proposals can be presented.')
      if (snapDeadlinePassed(p.decisionType, p.snapDeadline))
        throw fail.conflict('snap_deadline_passed', 'The snap deadline has already passed.')
      const windows = computeWindows(
        p.decisionType,
        new Date(),
        p.snapDeadline ? new Date(p.snapDeadline) : null,
      )
      const presented = await transition(
        req,
        p,
        { status: 'consultation', presentedAt: new Date().toISOString(), ...windows },
        'presented',
        account,
        windows,
      )
      if (!presented) throw fail.conflict('invalid_phase', 'Only draft proposals can be presented.')
      return json({ proposal: proposalView(presented) })
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
        },
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
      // under the proposal lock so the flag is either counted or refused
      const flag = await withProposalLock(req, p, async () => {
        const created = await req.payload.create({
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
          },
          overrideAccess: true,
          req,
        })
        await recordEvent(req, p.id, `flag_${b.kind}_raised`, account, { flagId: created.id })
        return created
      })
      if (!flag)
        throw fail.conflict('invalid_phase', 'The period for raising flags has just closed.')
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
      if (!ownedBy(flag, p)) throw fail.notFound('Flag not found.')
      if (!['open'].includes((flag as Doc).status))
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
      if (!ownedBy(flag, p)) throw fail.notFound('Flag not found.')
      const raiser = (flag as Doc).raisedBy?.id ?? (flag as Doc).raisedBy
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
      const options = (p.ballotOptions ?? []).map((o: AnyValue) => o.option)
      if (!options.includes(b.choice))
        throw fail.validation({ choice: `Must be one of: ${options.join(', ')}.` })
      const hasBallot = async () => {
        const { totalDocs } = await req.payload.count({
          collection: 'decision-ballots',
          where: {
            and: [{ proposal: { equals: p.id } }, { account: { equals: account.id } }],
          },
          overrideAccess: true,
        })
        return totalDocs > 0
      }
      if (await hasBallot()) throw fail.conflict('already_voted', 'Each member may vote once.')
      // council seats vote once each, however many accounts hold them
      let seat: string | null = null
      if (p.body === 'council') {
        const keys = ballotSeatKeys(account, (await getAccessProfile(req, account)).councilSeats)
        const { docs: used } = await req.payload.find({
          collection: 'decision-ballots',
          where: { and: [{ proposal: { equals: p.id } }, { seat: { in: keys } }] },
          pagination: false,
          overrideAccess: true,
        })
        const taken = new Set((used as Doc[]).map((d) => d.seat))
        seat = keys.find((k) => !taken.has(k)) ?? null
        if (!seat) throw fail.conflict('already_voted', 'This seat has already voted.')
      }
      let ballot
      try {
        // under the proposal lock so the ballot is either counted or refused
        ballot = await withProposalLock(req, p, async () => {
          const created = await req.payload.create({
            collection: 'decision-ballots',
            data: {
              proposal: p.id,
              account: account.id,
              seat,
              choice: b.choice,
              castAt: new Date().toISOString(),
            },
            overrideAccess: true,
            req,
          })
          await recordEvent(req, p.id, 'ballot_cast', account)
          return created
        })
      } catch (error: AnyValue) {
        // The pre-check is a fast path only — the unique indexes are the real
        // guard, and error shapes vary, so re-confirm against the table: a
        // row for this pair after a failed insert means the race was lost.
        if (isDuplicateBallot(error) || (await hasBallot()))
          throw fail.conflict('already_voted', 'Each member may vote once.')
        throw error
      }
      if (!ballot) throw fail.conflict('invalid_phase', 'Voting has just closed.')
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
        },
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
      // Veto verification is a coordination duty (GCT), not admin.
      if (!hasCapability(access, 'gct.coordinate'))
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
      if (!ownedBy(veto, p)) throw fail.notFound('Veto request not found.')
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
      const updated = await transition(
        req,
        p,
        { status: 'withdrawn', decidedAt: new Date().toISOString() },
        'withdrawn',
        account,
      )
      // lost the race to an overdue close or another withdraw
      if (!updated) throw fail.conflict('invalid_phase', 'Decision already concluded.')
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
        pagination: false,
        overrideAccess: true,
      })
      return json({
        items: (docs as Doc[]).map((e) => ({
          id: e.id,
          type: e.type,
          actor: accountRef(e.actor),
          detail: e.detail,
          createdAt: e.createdAt,
        })),
      })
    }),
  },
  {
    // daily backstop (vercel.json crons → CRON_SECRET bearer): resolves overdue
    // windows nobody has opened since the deadline passed
    path: '/cron/decisions-sweep',
    method: 'get',
    handler: endpoint(async (req) => {
      requireCronSecret(req)
      return json(await sweepDueDecisions(req))
    }),
  },
]
