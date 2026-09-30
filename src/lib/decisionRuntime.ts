import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { getAccessProfile } from './access'
import { councilSeatFor, legacyAppointmentRole } from './appointments'
import {
  computeWindows,
  consensusOutcome,
  quorumMet,
  quorumNeeded,
  requiresQuorum,
  unresolvedRed,
  vetoThresholdMet,
  voteAdopted,
  VOTING_WINDOW_MS,
} from './decisions'
import { audit } from './audit'

// Shared runtime for the S09 decision workflow. Both the member endpoints
// (src/endpoints/decisions.ts) and the platform bridge
// (src/modules/platform/decisionsBridge.ts) drive proposals through these
// helpers so there is exactly one state machine.

export const ids = (rel: any): number[] =>
  (Array.isArray(rel) ? rel : rel ? [rel] : []).map((x) => (typeof x === 'object' ? x.id : x))

// Resolve by numeric id, or by the imported legacy platform uuid.
export async function loadProposal(req: PayloadRequest, id: string | number) {
  try {
    return await req.payload.findByID({
      collection: 'decision-proposals',
      id: Number(id),
      overrideAccess: true,
    })
  } catch {
    const { docs } = await req.payload.find({
      collection: 'decision-proposals',
      where: { legacyRef: { equals: String(id) } },
      limit: 1,
      overrideAccess: true,
    })
    if (!docs.length) throw fail.notFound('Decision proposal not found.')
    return docs[0] as any
  }
}

export async function proposalFlags(req: PayloadRequest, proposalId: number) {
  const { docs } = await req.payload.find({
    collection: 'decision-flags',
    where: { proposal: { equals: proposalId } },
    limit: 500,
    overrideAccess: true,
  })
  return docs as any[]
}

export async function recordEvent(
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
  await audit(req, actor, {
    action: `decision.${type}`,
    targetType: 'decision_proposal',
    targetId: String(proposalId),
  })
}

export function isContactPerson(account: any, proposal: any): boolean {
  // The contact person is a recorded role on the proposal — a technical
  // administrator does not gain constituency authority over it.
  return (
    ids(proposal.contactPersons).includes(account.id) ||
    proposal.proposedBy === account.id ||
    (proposal.proposedBy as any)?.id === account.id
  )
}

// Who may raise flags / vote in a body (S13 §1: council members; WG/OT members
// for scoped bodies; CW members for constituency-wide).
export async function isBodyMember(
  req: PayloadRequest,
  account: any,
  proposal: any,
): Promise<boolean> {
  // No title grants body membership — `admin` and `focal_point` roles confer
  // nothing here; only an appointment or participation row does.
  const access = await getAccessProfile(req, account)
  const scopeIds = new Set(access.wgAssignments.map((w) => `working_group:${w.wgSlug}`))
  const teamIds = new Set(access.teamRoles)
  switch (proposal.body) {
    case 'council':
      // Council = org reps + one seat per WG (shared by its CPs) + one per OT
      // liaison + the two Focal Points (S13 §6). Membership is a recorded
      // Council seat, not a title — seat-level vote deduplication is enforced
      // at ballot time.
      return access.councilSeats.length > 0
    case 'working_group':
      return (
        scopeIds.has(`working_group:${proposal.bodyRef}`) ||
        access.bodyScopes.includes(String(proposal.bodyRef))
      )
    case 'operational_team':
      return (
        teamIds.has(String(proposal.bodyRef)) ||
        access.bodyScopes.includes(String(proposal.bodyRef)) ||
        access.appointments.some(
          (a) => a.scopeType === 'operational_team' && a.scopeId === String(proposal.bodyRef),
        )
      )
    case 'gct':
      return teamIds.has('gct')
    case 'constituency':
      return true // eligibility already gated by requireCwMember
    default:
      return false
  }
}

// Rows "current" at `now` in either store (mirrors appointmentCurrent()).
const currentRow = (now: string): any[] => [
  { status: { equals: 'active' } },
  { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
  { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than: now } }] },
]
const accountIdOf = (row: any) =>
  (typeof row.account === 'object' ? row.account?.id : row.account) as number

// The Council electorate (S13 §6): distinct accounts currently holding a
// Council seat — organisation representatives, one seat per WG/OT, the two
// Focal Points, and recorded substitutes — resolved through the same
// appointment model as voting, so counting and validation agree.
async function councilElectorate(req: PayloadRequest, now: string): Promise<Set<number>> {
  const [appts, legacy, focalPoints] = await Promise.all([
    req.payload.find({
      collection: 'appointments',
      where: { and: [...currentRow(now), { councilSeat: { exists: true } }] },
      limit: 2000,
      overrideAccess: true,
    }),
    req.payload.find({
      collection: 'assignments',
      where: { and: currentRow(now) },
      limit: 2000,
      overrideAccess: true,
    }),
    req.payload.find({
      collection: 'accounts',
      where: {
        and: [
          { role: { equals: 'focal_point' } },
          { hubAccessStatus: { equals: 'active' } },
          { membershipTrack: { equals: 'constituency_work' } },
          { constituencyWorkStatus: { equals: 'active' } },
        ],
      },
      limit: 10,
      overrideAccess: true,
    }),
  ])
  const accounts = new Set<number>()
  for (const row of appts.docs as any[]) {
    if (row.councilSeat) accounts.add(accountIdOf(row))
  }
  for (const row of legacy.docs as any[]) {
    const roleKey = legacyAppointmentRole(row.scopeType, row.scopeId, row.role)
    if (roleKey && councilSeatFor(roleKey, row)) accounts.add(accountIdOf(row))
  }
  for (const a of focalPoints.docs as any[]) accounts.add(a.id)
  return accounts
}

export async function countEligible(req: PayloadRequest, proposal: any): Promise<number> {
  // Eligible-voter registry snapshot for the 5% quorum (S09 §2 step 6).
  const now = new Date().toISOString()
  if (proposal.body === 'council') {
    return Math.max((await councilElectorate(req, now)).size, 1)
  }
  if (proposal.body === 'constituency') {
    // The whole Constituency Work membership is the electorate. A platform
    // role does not add anyone — mandate holders must still be CW members.
    const { totalDocs } = await req.payload.find({
      collection: 'accounts',
      where: {
        and: [
          { hubAccessStatus: { equals: 'active' } },
          { membershipTrack: { equals: 'constituency_work' } },
          { constituencyWorkStatus: { equals: 'active' } },
          { membershipStatus: { in: ['active', 'renewal_due'] } },
        ],
      },
      limit: 0,
      overrideAccess: true,
    })
    return Math.max(totalDocs, 1)
  }
  // Scoped bodies: distinct accounts with a current participation or
  // appointment row for the scope. Platform-bridged bodies also count
  // 'body'-scope rows; OTs may be recorded as team rows.
  const scopeTypes =
    proposal.body === 'working_group'
      ? ['working_group', 'body']
      : proposal.body === 'gct'
        ? ['team']
        : ['operational_team', 'team', 'body']
  const scopeId =
    proposal.body === 'gct' ? 'gct' : String(proposal.bodyRef ?? '')
  const [assigned, appointed] = await Promise.all([
    req.payload.find({
      collection: 'assignments',
      where: {
        and: [
          ...currentRow(now),
          { scopeType: { in: scopeTypes } },
          { scopeId: { equals: scopeId } },
        ],
      },
      limit: 2000,
      overrideAccess: true,
    }),
    req.payload.find({
      collection: 'appointments',
      where: {
        and: [
          ...currentRow(now),
          { scopeType: { in: scopeTypes } },
          { scopeId: { equals: scopeId } },
        ],
      },
      limit: 2000,
      overrideAccess: true,
    }),
  ])
  const accounts = new Set<number>()
  for (const row of [...assigned.docs, ...appointed.docs] as any[]) {
    accounts.add(accountIdOf(row))
  }
  return Math.max(accounts.size, 1)
}

// Advance the proposal state machine according to wall-clock deadlines.
// Idempotent: safe to call from reads and explicit close/advance calls.
export async function advanceIfDue(req: PayloadRequest, proposal: any) {
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
    if (
      requiresQuorum(proposal.decisionType) &&
      !quorumMet(cast, proposal.eligibleVoterCount ?? 0)
    ) {
      // Quorum not met → the original proposal must be withdrawn (S09 §2).
      await update(
        { status: 'failed_quorum', decidedAt: new Date().toISOString() },
        'failed_quorum',
        { cast, quorumNeeded: quorumNeeded(proposal.eligibleVoterCount ?? 0) },
      )
    } else if (voteAdopted(votesFor, cast)) {
      await update(
        {
          status: 'adopted',
          adoptedVia: 'vote',
          decidedAt: new Date().toISOString(),
          votesFor,
          votesAgainst: cast - votesFor,
        },
        'adopted',
        { via: 'vote', votesFor, cast },
      )
    } else {
      await update(
        {
          status: 'rejected',
          decidedAt: new Date().toISOString(),
          votesFor,
          votesAgainst: cast - votesFor,
        },
        'rejected',
        { votesFor, cast },
      )
    }
  }
  return proposal
}

export async function checkVeto(req: PayloadRequest, proposal: any) {
  const { docs } = await req.payload.find({
    collection: 'decision-vetoes',
    where: {
      and: [{ proposal: { equals: proposal.id } }, { status: { equals: 'confirmed' } }],
    },
    limit: 500,
    overrideAccess: true,
  })
  if (proposal.status === 'voting' && vetoThresholdMet(docs as any[])) {
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
export const accountRef = (a: any) =>
  a == null
    ? null
    : {
        id: typeof a === 'object' ? a.id : a,
        name: typeof a === 'object' ? a.name : undefined,
      }

export const flagView = (f: any) => ({
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

export const commentView = (c: any) => ({
  id: c.id,
  account: accountRef(c.account),
  body: c.body,
  createdAt: c.createdAt,
})

export const ballotView = (b: any) => ({
  id: b.id,
  account: accountRef(b.account),
  choice: b.choice,
  castAt: b.castAt,
})

export const vetoView = (v: any) => ({
  id: v.id,
  requesterKind: v.requesterKind,
  groupKey: v.groupKey,
  reasoning: v.reasoning,
  requestedBy: accountRef(v.requestedBy),
  status: v.status,
  createdAt: v.createdAt,
})

export const proposalView = (p: any, flags?: any[], counts?: any) => ({
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

export {
  computeWindows,
  consensusOutcome,
  quorumNeeded,
  requiresQuorum,
  unresolvedRed,
  voteAdopted,
}
