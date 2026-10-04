import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { getAccessProfile } from './access'
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
import type { VetoRequest } from './decisions'
import type { AccountLike, ActorLike, Doc, AnyValue } from './domain'

// Shared S09 decision state machine — driven by the member endpoints and
// the platform bridge so there is exactly one runtime.

export const ids = (rel: AnyValue): number[] =>
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
    return docs[0] as Doc
  }
}

export async function proposalFlags(req: PayloadRequest, proposalId: number) {
  const { docs } = await req.payload.find({
    collection: 'decision-flags',
    where: { proposal: { equals: proposalId } },
    limit: 500,
    overrideAccess: true,
  })
  return docs as Doc[]
}

export async function recordEvent(
  req: PayloadRequest,
  proposalId: number,
  type: string,
  actor: ActorLike | null,
  detail?: AnyValue,
) {
  await req.payload.create({
    collection: 'decision-events',
    data: {
      proposal: proposalId,
      type,
      actor: actor?.id != null ? Number(actor.id) : null,
      detail: detail ?? null,
      createdAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })
  await audit(req, actor, {
    action: `decision.${type}`,
    targetType: 'decision_proposal',
    targetId: String(proposalId),
  })
}

export function isContactPerson(account: AccountLike, proposal: Doc): boolean {
  // The contact person is a recorded role on the proposal — a technical
  // administrator does not gain constituency authority over it.
  return (
    ids(proposal.contactPersons).includes(account.id) ||
    proposal.proposedBy === account.id ||
    (proposal.proposedBy as Doc)?.id === account.id
  )
}

// Who may flag/vote in a body (S13 §1).
export async function isBodyMember(
  req: PayloadRequest,
  account: AccountLike,
  proposal: Doc,
): Promise<boolean> {
  // Only an authority record grants body membership.
  const access = await getAccessProfile(req, account)
  const scopeIds = new Set(access.wgAssignments.map((w) => `working_group:${w.wgSlug}`))
  const teamIds = new Set(access.teamRoles)
  switch (proposal.body) {
    case 'council':
      // Council = org reps + one seat per WG (shared by CPs) + one per OT
      // liaison + two Focal Points (S13 §6). Seats deduplicate at ballot time.
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
        access.records.some(
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

// Rows current at `now` in either store.
const currentRow = (now: string): Doc[] => [
  { status: { equals: 'active' } },
  { or: [{ startsAt: { exists: false } }, { startsAt: { less_than_equal: now } }] },
  { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than: now } }] },
]
const accountIdOf = (row: Doc) =>
  (typeof row.account === 'object' ? row.account?.id : row.account) as number

// Lapsed CW members lose their seat's vote — every seat role requires
// active CW.
async function eligibleAccounts(req: PayloadRequest, accountIds: Set<number>) {
  if (!accountIds.size) return new Set<number>()
  const { docs: accounts } = await req.payload.find({
    collection: 'accounts',
    where: {
      and: [
        { id: { in: [...accountIds] } },
        { hubAccessStatus: { equals: 'active' } },
        { membershipTrack: { equals: 'constituency_work' } },
        { constituencyWorkStatus: { equals: 'active' } },
        { membershipStatus: { in: ['active', 'renewal_due'] } },
      ],
    },
    pagination: false,
    overrideAccess: true,
  })
  return new Set<number>((accounts as Doc[]).map((a) => a.id))
}

// Council electorate (S13 §6): distinct held seats, not accounts — a
// substitute covers its principal's seat; lapsed CW holders don't vote.
// Focal Point seats are personal and count per holder.
async function councilElectorate(req: PayloadRequest, now: string): Promise<number> {
  const { docs } = await req.payload.find({
    collection: 'authority-records',
    where: { and: [...currentRow(now), { councilSeat: { exists: true } }] },
    pagination: false,
    overrideAccess: true,
  })
  const seats = new Map<string, Set<number>>() // seat -> holder account ids
  const focalHolders = new Set<number>()
  for (const row of docs) {
    if (!row.councilSeat) continue
    if (row.councilSeat === 'focal_point') {
      focalHolders.add(accountIdOf(row))
      continue
    }
    const holders = seats.get(row.councilSeat) ?? new Set<number>()
    holders.add(accountIdOf(row))
    seats.set(row.councilSeat, holders)
  }
  const holderIds = new Set<number>(focalHolders)
  for (const holders of seats.values()) for (const id of holders) holderIds.add(id)
  const eligible = await eligibleAccounts(req, holderIds)
  let count = 0
  for (const holders of seats.values()) {
    // A shared seat votes if any holder is eligible, and counts once.
    for (const holder of holders) {
      if (eligible.has(holder)) {
        count += 1
        break
      }
    }
  }
  for (const holder of focalHolders) if (eligible.has(holder)) count += 1
  return count
}

export async function countEligible(req: PayloadRequest, proposal: Doc): Promise<number> {
  // Eligible-voter snapshot for the 5% quorum (S09 §2 step 6).
  const now = new Date().toISOString()
  if (proposal.body === 'council') {
    return Math.max(await councilElectorate(req, now), 1)
  }
  if (proposal.body === 'constituency') {
    // The whole CW membership is the electorate — mandates add no one.
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
  // Scoped bodies: accounts with a current record for the scope
  // (participation or mandate). 'body' rows also count; OTs may be team rows.
  const scopeTypes =
    proposal.body === 'working_group'
      ? ['working_group', 'body']
      : proposal.body === 'gct'
        ? ['team']
        : ['operational_team', 'team', 'body']
  const scopeId = proposal.body === 'gct' ? 'gct' : String(proposal.bodyRef ?? '')
  const { docs: scoped } = await req.payload.find({
    collection: 'authority-records',
    where: {
      and: [
        ...currentRow(now),
        { scopeType: { in: scopeTypes } },
        { scopeId: { equals: scopeId } },
      ],
    },
    pagination: false,
    overrideAccess: true,
  })
  const accounts = new Set<number>()
  for (const row of scoped as Doc[]) accounts.add(accountIdOf(row))
  return Math.max((await eligibleAccounts(req, accounts)).size, 1)
}

// Advance the state machine by wall-clock deadlines. Idempotent.
export async function advanceIfDue(req: PayloadRequest, proposal: Doc) {
  const now = Date.now()
  const past = (d?: string | null) => d && new Date(d).getTime() <= now
  const update = async (data: Doc, type: string, detail?: AnyValue) => {
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
    const votesFor = (ballots as Doc[]).filter((b) => b.choice === 'for').length
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

export async function checkVeto(req: PayloadRequest, proposal: Doc) {
  const { docs } = await req.payload.find({
    collection: 'decision-vetoes',
    where: {
      and: [{ proposal: { equals: proposal.id } }, { status: { equals: 'confirmed' } }],
    },
    limit: 500,
    overrideAccess: true,
  })
  if (proposal.status === 'voting' && vetoThresholdMet(docs as unknown as VetoRequest[])) {
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

// Member-facing actor: id + display name only — never raw account docs.
export const accountRef = (a: AnyValue) =>
  a == null
    ? null
    : {
        id: typeof a === 'object' ? a.id : a,
        name: typeof a === 'object' ? a.name : undefined,
      }

export const flagView = (f: AnyValue) => ({
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

export const commentView = (c: AnyValue) => ({
  id: c.id,
  account: accountRef(c.account),
  body: c.body,
  createdAt: c.createdAt,
})

export const ballotView = (b: AnyValue) => ({
  id: b.id,
  account: accountRef(b.account),
  choice: b.choice,
  castAt: b.castAt,
})

export const vetoView = (v: AnyValue) => ({
  id: v.id,
  requesterKind: v.requesterKind,
  groupKey: v.groupKey,
  reasoning: v.reasoning,
  requestedBy: accountRef(v.requestedBy),
  status: v.status,
  createdAt: v.createdAt,
})

export const proposalView = (p: AnyValue, flags?: AnyValue[], counts?: AnyValue) => ({
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
  ballotOptions: (p.ballotOptions ?? []).map((o: AnyValue) => o.option),
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
