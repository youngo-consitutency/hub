import type { Endpoint, PayloadRequest } from 'payload'
import { ApiError, endpoint, fail, json } from '../lib/respond'
import { requireAccount } from '../lib/accounts'
import { getAccessProfile } from '../lib/access'
import {
  DECISION_TYPES,
  RED_FLAG_CATEGORIES,
  computeWindows,
  consensusOutcome,
  quorumMet,
  quorumNeeded,
  requiresQuorum,
  unresolvedRed,
  vetoThresholdMet,
  voteAdopted,
  VOTING_WINDOW_MS,
} from '../lib/decisions'

// S09 decision workflow endpoints. Members act through these — direct REST
// writes on the decision collections are staff-only (see Decisions.ts), so
// every transition below also appends to decision-events and audit-log.

const VERIFIED_ROLES = new Set(['admin', 'focal_point'])

function requireVerifiedMember(req: PayloadRequest) {
  const account = requireAccount(req)
  const ok =
    account?.hubAccessStatus === 'active' &&
    (account?.memberStatus === 'verified' || VERIFIED_ROLES.has(account?.role))
  if (!ok)
    throw new ApiError(
      403,
      'not_verified',
      'Complete onboarding and verification to take part in decisions.',
    )
  return account
}

// Constituency Work membership is required to raise flags / cast ballots /
// veto (S17 §1.1: decision-making rights belong to CW members).
function requireCwMember(req: PayloadRequest) {
  const account = requireVerifiedMember(req)
  if (
    account.membershipTrack !== 'constituency_work' &&
    !VERIFIED_ROLES.has(account.role)
  )
    throw new ApiError(
      403,
      'not_constituency_work',
      'Decision rights require Constituency Work membership (S17 §1.1).',
    )
  return account
}

const ids = (rel: any): number[] =>
  (Array.isArray(rel) ? rel : rel ? [rel] : []).map((x) =>
    typeof x === 'object' ? x.id : x,
  )

async function loadProposal(req: PayloadRequest, id: string | number) {
  try {
    return await req.payload.findByID({
      collection: 'decision-proposals',
      id: Number(id),
      overrideAccess: true,
    })
  } catch {
    throw fail.notFound('Decision proposal not found.')
  }
}

async function proposalFlags(req: PayloadRequest, proposalId: number) {
  const { docs } = await req.payload.find({
    collection: 'decision-flags',
    where: { proposal: { equals: proposalId } },
    limit: 500,
    overrideAccess: true,
  })
  return docs as any[]
}

async function recordEvent(
  req: PayloadRequest,
  proposalId: number,
  type: string,
  actor: any,
  detail?: any,
) {
  await req.payload.create({
    collection: 'decision-events',
    data: {
      proposal: proposalId,
      type,
      actor: actor?.id ?? null,
      detail: detail ?? null,
      createdAt: new Date().toISOString(),
    } as any,
    overrideAccess: true,
  })
  await req.payload.create({
    collection: 'audit-log',
    data: {
      actor: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action: `decision.${type}`,
      targetType: 'decision_proposal',
      targetId: String(proposalId),
    } as any,
    overrideAccess: true,
  })
}

function isContactPerson(account: any, proposal: any): boolean {
  if (account.role === 'admin') return true
  return ids(proposal.contactPersons).includes(account.id) ||
    proposal.proposedBy === account.id ||
    (proposal.proposedBy as any)?.id === account.id
}

// Who may raise flags / vote in a body (S13 §1: council members; WG/OT members
// for scoped bodies; CW members for constituency-wide).
async function isBodyMember(
  req: PayloadRequest,
  account: any,
  proposal: any,
): Promise<boolean> {
  if (VERIFIED_ROLES.has(account.role)) return true
  const access = await getAccessProfile(req, account)
  const scopeIds = new Set(
    access.wgAssignments.map((w) => `working_group:${w.wgSlug}`),
  )
  const teamIds = new Set(access.teamRoles)
  switch (proposal.body) {
    case 'council':
      // Council = org reps + one CP per WG + liaisons + 2 FPs (S13 §1).
      // WG *members* do not sit on Council — only coordination roles (CPs)
      // carry wg.manage, which is the closest proxy for a Council seat.
      return (
        access.capabilities.some((c) => c.startsWith('wg.manage:')) ||
        teamIds.has('council') ||
        access.capabilities.includes('platform.manage')
      )
    case 'working_group':
      return scopeIds.has(`working_group:${proposal.bodyRef}`)
    case 'operational_team':
      return teamIds.has(String(proposal.bodyRef))
    case 'gct':
      return teamIds.has('gct')
    case 'constituency':
      return true // eligibility already gated by requireCwMember
    default:
      return false
  }
}

async function countEligible(req: PayloadRequest, proposal: any): Promise<number> {
  // Eligible-voter registry snapshot for the 5% quorum (S09 §2 step 6).
  const where: any = {
    and: [
      { hubAccessStatus: { equals: 'active' } },
      {
        or: [
          { membershipTrack: { equals: 'constituency_work' } },
          { role: { in: ['admin', 'focal_point'] } },
        ],
      },
    ],
  }
  const { totalDocs } = await req.payload.find({
    collection: 'accounts',
    where,
    limit: 0,
    overrideAccess: true,
  })
  if (proposal.body === 'constituency' || proposal.body === 'council')
    return Math.max(totalDocs, 1)
  // Scoped bodies: count their active assignments' accounts.
  const scopeType =
    proposal.body === 'working_group' ? 'working_group' : 'team'
  const { totalDocs: members } = await req.payload.find({
    collection: 'assignments',
    where: {
      and: [
        { scopeType: { equals: scopeType } },
        { scopeId: { equals: String(proposal.bodyRef ?? '') } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 0,
    overrideAccess: true,
  })
  return Math.max(members, 1)
}

// Advance the proposal state machine according to wall-clock deadlines.
// Idempotent: safe to call from reads and explicit close/advance calls.
async function advanceIfDue(req: PayloadRequest, proposal: any) {
  const now = Date.now()
  const past = (d?: string | null) => d && new Date(d).getTime() <= now
  const update = async (data: any, type: string, detail?: any) => {
    proposal = await req.payload.update({
      collection: 'decision-proposals',
      id: proposal.id,
      data,
      overrideAccess: true,
    })
    await recordEvent(req, proposal.id, type, null, detail)
    return proposal
  }
  if (proposal.status === 'consultation' && past(proposal.consultationEndsAt)) {
    await update({ status: 'revision' }, 'phase_revision')
  }
  if (proposal.status === 'revision' && past(proposal.revisionEndsAt)) {
    await update({ status: 'decision' }, 'phase_decision')
  }
  if (proposal.status === 'decision' && past(proposal.decisionEndsAt)) {
    const flags = await proposalFlags(req, proposal.id)
    const red = flags.filter((f) => f.kind === 'red').map((f) => f.status)
    const grey = flags.filter((f) => f.kind === 'grey').map((f) => f.status)
    const outcome = consensusOutcome(red, grey)
    if (outcome === 'vote') {
      const eligible = await countEligible(req, proposal)
      await update(
        {
          status: 'voting',
          eligibleVoterCount: eligible,
          votingEndsAt: new Date(Date.now() + VOTING_WINDOW_MS).toISOString(),
          ballotOptions: [{ option: 'for' }, { option: 'against' }],
        },
        'vote_opened',
        { eligibleVoterCount: eligible, quorumNeeded: quorumNeeded(eligible) },
      )
    } else {
      await update(
        { status: 'adopted', adoptedVia: outcome, decidedAt: new Date().toISOString() },
        'adopted',
        { via: outcome },
      )
    }
  }
  if (proposal.status === 'voting' && past(proposal.votingEndsAt)) {
    const { docs: ballots } = await req.payload.find({
      collection: 'decision-ballots',
      where: { proposal: { equals: proposal.id } },
      limit: 10000,
      overrideAccess: true,
    })
    const cast = ballots.length
    const votesFor = (ballots as any[]).filter((b) => b.choice === 'for').length
    if (requiresQuorum(proposal.decisionType) && !quorumMet(cast, proposal.eligibleVoterCount ?? 0)) {
      // Quorum not met → the original proposal must be withdrawn (S09 §2).
      await update(
        { status: 'failed_quorum', decidedAt: new Date().toISOString() },
        'failed_quorum',
        { cast, quorumNeeded: quorumNeeded(proposal.eligibleVoterCount ?? 0) },
      )
    } else if (voteAdopted(votesFor, cast)) {
      await update(
        { status: 'adopted', adoptedVia: 'vote', decidedAt: new Date().toISOString() },
        'adopted',
        { via: 'vote', votesFor, cast },
      )
    } else {
      await update(
        { status: 'rejected', decidedAt: new Date().toISOString() },
        'rejected',
        { votesFor, cast },
      )
    }
  }
  return proposal
}

async function checkVeto(req: PayloadRequest, proposal: any) {
  const { docs } = await req.payload.find({
    collection: 'decision-vetoes',
    where: {
      and: [
        { proposal: { equals: proposal.id } },
        { status: { equals: 'confirmed' } },
      ],
    },
    limit: 500,
    overrideAccess: true,
  })
  if (
    proposal.status === 'voting' &&
    vetoThresholdMet(docs as any[])
  ) {
    proposal = await req.payload.update({
      collection: 'decision-proposals',
      id: proposal.id,
      data: { status: 'vetoed', decidedAt: new Date().toISOString() },
      overrideAccess: true,
    })
    await recordEvent(req, proposal.id, 'vetoed', null, {
      confirmedRequests: docs.length,
    })
  }
  return proposal
}

// Member-facing actor reference: id + display name only. Never expose raw
// account docs (personal/contact fields stay inside the Hub).
const accountRef = (a: any) =>
  a == null
    ? null
    : {
        id: typeof a === 'object' ? a.id : a,
        name: typeof a === 'object' ? a.name : undefined,
      }

const flagView = (f: any) => ({
  id: f.id,
  kind: f.kind,
  rationaleCategory: f.rationaleCategory,
  reason: f.reason,
  alternative: f.alternative,
  raisedBy: accountRef(f.raisedBy),
  status: f.status,
  responseNote: f.responseNote,
  respondedBy: accountRef(f.respondedBy),
  respondedAt: f.respondedAt,
  raisedAt: f.raisedAt,
})

const commentView = (c: any) => ({
  id: c.id,
  account: accountRef(c.account),
  body: c.body,
  createdAt: c.createdAt,
})

const ballotView = (b: any) => ({
  id: b.id,
  account: accountRef(b.account),
  choice: b.choice,
  castAt: b.castAt,
})

const vetoView = (v: any) => ({
  id: v.id,
  requesterKind: v.requesterKind,
  groupKey: v.groupKey,
  reasoning: v.reasoning,
  requestedBy: accountRef(v.requestedBy),
  status: v.status,
  createdAt: v.createdAt,
})

const proposalView = (p: any, flags?: any[], counts?: any) => ({
  id: p.id,
  title: p.title,
  context: p.context,
  proposalText: p.proposalText,
  decisionType: p.decisionType,
  body: p.body,
  bodyRef: p.bodyRef,
  status: p.status,
  proposedBy: accountRef(p.proposedBy),
  contactPersons: (Array.isArray(p.contactPersons) ? p.contactPersons : []).map(accountRef),
  snapJustification: p.snapJustification,
  snapDeadline: p.snapDeadline,
  presentedAt: p.presentedAt,
  consultationEndsAt: p.consultationEndsAt,
  revisionEndsAt: p.revisionEndsAt,
  decisionEndsAt: p.decisionEndsAt,
  votingEndsAt: p.votingEndsAt,
  eligibleVoterCount: p.eligibleVoterCount,
  ballotOptions: (p.ballotOptions ?? []).map((o: any) => o.option),
  adoptedVia: p.adoptedVia,
  decidedAt: p.decidedAt,
  resultSummary: p.resultSummary,
  createdAt: p.createdAt,
  ...(flags ? { flags: flags.map(flagView) } : {}),
  ...(counts ? { counts } : {}),
})

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
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!b.title?.trim()) fields.title = 'Required.'
      if (!b.context?.trim()) fields.context = 'Required.'
      if (!b.proposalText?.trim()) fields.proposalText = 'Required.'
      if (!DECISION_TYPES.includes(b.decisionType)) fields.decisionType = 'Invalid.'
      if (!b.body) fields.body = 'Required.'
      if (b.decisionType === 'snap') {
        if (!b.snapJustification?.trim())
          fields.snapJustification = 'Snap decisions require a justification.'
        if (!b.snapDeadline)
          fields.snapDeadline = 'Snap decisions require a deadline.'
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
      let p = await loadProposal(req, req.routeParams!.id as string)
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
          and: [
            { proposal: { equals: p.id } },
            { account: { equals: account.id } },
          ],
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
      let p = await loadProposal(req, req.routeParams!.id as string)
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
      const p = await advanceIfDue(req, await loadProposal(req, req.routeParams!.id as string))
      if (!['consultation', 'decision'].includes(p.status))
        throw fail.conflict('invalid_phase', 'Comments are only open during consultation or decision periods.')
      const b = (await req.json?.()) ?? ({} as any)
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
      const p = await advanceIfDue(req, await loadProposal(req, req.routeParams!.id as string))
      if (!['consultation', 'decision'].includes(p.status))
        throw fail.conflict(
          'invalid_phase',
          'Flags may only be raised during consultation or decision periods.',
        )
      if (!(await isBodyMember(req, account, p)))
        throw fail.forbidden('Only members of the decision-making body may raise flags.')
      const b = (await req.json?.()) ?? ({} as any)
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
      const p = await loadProposal(req, req.routeParams!.id as string)
      if (!isContactPerson(account, p))
        throw fail.forbidden('Only contact person(s) respond to flags.')
      const flag = await req.payload.findByID({
        collection: 'decision-flags',
        id: Number(req.routeParams!.flagId),
        overrideAccess: true,
      }).catch(() => { throw fail.notFound('Flag not found.') })
      if (!['open'].includes((flag as any).status))
        throw fail.conflict('invalid_phase', 'Flag is no longer open.')
      const b = (await req.json?.()) ?? ({} as any)
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
      const p = await loadProposal(req, req.routeParams!.id as string)
      const flag = await req.payload.findByID({
        collection: 'decision-flags',
        id: Number(req.routeParams!.flagId),
        overrideAccess: true,
      }).catch(() => { throw fail.notFound('Flag not found.') })
      const raiser = (flag as any).raisedBy?.id ?? (flag as any).raisedBy
      if (raiser !== account.id && account.role !== 'admin')
        throw fail.forbidden('Only the flag raiser may withdraw it.')
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
      let p = await loadProposal(req, req.routeParams!.id as string)
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
      const p = await advanceIfDue(req, await loadProposal(req, req.routeParams!.id as string))
      if (p.status !== 'voting')
        throw fail.conflict('invalid_phase', 'Voting is not open for this proposal.')
      if (!(await isBodyMember(req, account, p)))
        throw fail.forbidden('Only members of the decision-making body may vote.')
      const b = (await req.json?.()) ?? ({} as any)
      const options = (p.ballotOptions ?? []).map((o: any) => o.option)
      if (!options.includes(b.choice))
        throw fail.validation({ choice: `Must be one of: ${options.join(', ')}.` })
      const { totalDocs: existing } = await req.payload.find({
        collection: 'decision-ballots',
        where: {
          and: [
            { proposal: { equals: p.id } },
            { account: { equals: account.id } },
          ],
        },
        limit: 0,
        overrideAccess: true,
      })
      if (existing > 0)
        throw fail.conflict('already_voted', 'Each member may vote once.')
      const ballot = await req.payload.create({
        collection: 'decision-ballots',
        data: {
          proposal: p.id,
          account: account.id,
          choice: b.choice,
          castAt: new Date().toISOString(),
        } as any,
        overrideAccess: true,
      })
      await recordEvent(req, p.id, 'ballot_cast', account)
      return json({ ballot: ballotView(ballot) }, { status: 201 })
    }),
  },
  {
    path: '/decisions/:id/vetoes',
    method: 'post',
    handler: endpoint(async (req) => {
      const account = requireCwMember(req)
      const p = await advanceIfDue(req, await loadProposal(req, req.routeParams!.id as string))
      if (p.status !== 'voting')
        throw fail.conflict('invalid_phase', 'A veto may only stop an open vote.')
      const b = (await req.json?.()) ?? ({} as any)
      const fields: Record<string, string> = {}
      if (!['org', 'org_global_south', 'wg_or_ot'].includes(b.requesterKind))
        fields.requesterKind = 'Must be org, org_global_south or wg_or_ot.'
      if (!b.groupKey?.trim()) fields.groupKey = 'Required.'
      if (!b.reasoning?.trim())
        fields.reasoning = 'A veto request requires detailed reasoning.'
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
      const account = requireVerifiedMember(req)
      if (account.role !== 'admin')
        throw fail.forbidden('Veto requests are confirmed by the coordination team.')
      let p = await loadProposal(req, req.routeParams!.id as string)
      const veto = await req.payload.findByID({
        collection: 'decision-vetoes',
        id: Number(req.routeParams!.vetoId),
        overrideAccess: true,
      }).catch(() => { throw fail.notFound('Veto request not found.') })
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
      const p = await loadProposal(req, req.routeParams!.id as string)
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
      const p = await loadProposal(req, req.routeParams!.id as string)
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
