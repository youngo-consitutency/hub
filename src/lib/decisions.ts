// S09 Decision-Making Processes — pure domain logic.
// No I/O here: windows, consensus outcomes, quorum/tally and veto rules are
// computed from plain values so the endpoints stay thin and the rules stay
// testable. References: S09 (decision process), S13 (bodies/quorum actors).

export const DECISION_TYPES = [
  'standard', // 5d consult / 24h revision / 24h decision
  'snap', // ½ consult / ¼ revision / ¼ decision of the time available
  'og_standard', // on-ground standard: 6h / 6h / 6h
  'og_snap', // on-ground snap: meeting decision, ⅔ majority
  'press_release', // 48h / 24h / 24h; red flags get +4d resolution window
] as const
export type DecisionType = (typeof DECISION_TYPES)[number]

export const DECISION_STATUSES = [
  'draft',
  'consultation',
  'revision',
  'decision',
  'voting',
  'adopted',
  'vetoed',
  'withdrawn',
  'failed_quorum',
  'rejected',
] as const

export const DECISION_BODIES = [
  'council',
  'working_group',
  'operational_team',
  'gct',
  'constituency',
] as const
export type DecisionBody = (typeof DECISION_BODIES)[number]

// Red flag rationale categories, Annex 3 of S09.
export const RED_FLAG_CATEGORIES = [
  'principles_violation',
  'coc_violation',
  'science_contradiction',
  'past_decision_contradiction',
  'process_noncompliance',
  'mission_misalignment',
  'inadequate_consultation',
  'grey_flag_unsatisfactory',
] as const

export const FLAG_STATUSES = [
  'open',
  'addressed', // contact person responded; flag still stands unless withdrawn
  'withdrawn',
  'nullified', // CoC violation by the flagger → automatic nullification
] as const

const H = 3_600_000
const D = 24 * H

export interface PhaseWindows {
  consultationEndsAt: string
  revisionEndsAt: string
  decisionEndsAt: string
}

// Phase deadlines from presentation time, per S09 §3.
export function computeWindows(
  type: DecisionType,
  presentedAt: Date,
  snapDeadline?: Date | null,
): PhaseWindows {
  const t = presentedAt.getTime()
  const span = (c: number, r: number, d: number): PhaseWindows => ({
    consultationEndsAt: new Date(t + c).toISOString(),
    revisionEndsAt: new Date(t + c + r).toISOString(),
    decisionEndsAt: new Date(t + c + r + d).toISOString(),
  })
  switch (type) {
    case 'standard':
      return span(5 * D, 1 * D, 1 * D)
    case 'press_release':
      return span(48 * H, 24 * H, 24 * H)
    case 'og_standard':
      return span(6 * H, 6 * H, 6 * H)
    case 'og_snap':
      return span(6 * H, 0, 6 * H)
    case 'snap': {
      if (!snapDeadline || snapDeadline.getTime() <= t) throw new Error('snap_deadline_required')
      const avail = snapDeadline.getTime() - t
      return span(avail / 2, avail / 4, avail / 4)
    }
  }
}

export const VOTING_WINDOW_MS = 24 * H

// On-ground decisions are made by members present; the 5% quorum of the whole
// body does not apply (S09 §3.3/§3.4).
export function requiresQuorum(type: DecisionType): boolean {
  return type !== 'og_standard' && type !== 'og_snap'
}

// 5% of the eligible members of the decision-making body (S09 §2, step 6).
export function quorumNeeded(eligibleCount: number): number {
  return Math.max(1, Math.ceil(eligibleCount * 0.05))
}

export function quorumMet(votesCast: number, eligibleCount: number): boolean {
  return votesCast >= quorumNeeded(eligibleCount)
}

// A red flag stands until it is withdrawn or nullified — a response alone does
// not resolve it. Grey flags never block consensus (they allow "consensus with
// reservations"), but an unresolved grey may be escalated to red.
export function unresolvedRed(flagStatuses: string[]): number {
  return flagStatuses.filter((s) => s === 'open' || s === 'addressed').length
}

export function consensusOutcome(
  redStatuses: string[],
  greyStatuses: string[],
): 'vote' | 'consensus' | 'consensus_with_reservations' {
  if (unresolvedRed(redStatuses) > 0) return 'vote'
  return unresolvedRed(greyStatuses) > 0 ? 'consensus_with_reservations' : 'consensus'
}

// Adoption needs ≥⅔ of votes cast (S09 §2 step 6). Blank/spoiled ballots are
// excluded from `cast` before calling this.
export function voteAdopted(votesFor: number, votesCast: number): boolean {
  if (votesCast <= 0) return false
  return votesFor / votesCast >= 2 / 3
}

export interface VetoRequest {
  requesterKind: 'org' | 'org_global_south' | 'wg_or_ot'
  groupKey: string
}

// Veto stops the vote (S09 §2 step 7): ≥20 organisations worldwide, or ≥6
// organisations from the Global South, or ≥5 working groups/operational teams.
export function vetoThresholdMet(requests: VetoRequest[]): boolean {
  const orgs = new Set<string>()
  const orgsSouth = new Set<string>()
  const bodies = new Set<string>()
  for (const r of requests) {
    if (r.requesterKind === 'org') orgs.add(r.groupKey)
    if (r.requesterKind === 'org_global_south') {
      orgs.add(r.groupKey)
      orgsSouth.add(r.groupKey)
    }
    if (r.requesterKind === 'wg_or_ot') bodies.add(r.groupKey)
  }
  return orgs.size >= 20 || orgsSouth.size >= 6 || bodies.size >= 5
}

export interface IrvBallot {
  // Ordered candidate ids; empty array = blank ballot ("no good candidate").
  ranks: string[]
}

export interface IrvResult {
  outcome: 'elected' | 'restart'
  winner?: string
  blankCount: number
  rounds: { eliminated: string[]; tallies: Record<string, number> }[]
}

// Instant-runoff tally per S10 §3.4. Absolute majority of non-blank ballots
// wins; fewest-first-preference candidates are eliminated (ties broken by
// later preferences); majority of blank ballots → restart.
export function tallyIrv(ballots: IrvBallot[], candidates: string[]): IrvResult {
  const blankCount = ballots.filter((b) => b.ranks.length === 0).length
  if (blankCount * 2 > ballots.length) {
    return { outcome: 'restart', blankCount, rounds: [] }
  }
  const live = ballots.filter((b) => b.ranks.length > 0).map((b) => [...b.ranks])
  let remaining = [...candidates]
  const rounds: IrvResult['rounds'] = []
  while (remaining.length > 1) {
    const tallies: Record<string, number> = Object.fromEntries(remaining.map((c) => [c, 0]))
    for (const ranks of live) {
      const top = ranks.find((r) => remaining.includes(r))
      if (top) tallies[top] += 1
    }
    const total = Object.values(tallies).reduce((a, b) => a + b, 0)
    const winner = remaining.find((c) => tallies[c] * 2 > total)
    if (winner) return { outcome: 'elected', winner, blankCount, rounds }
    // eliminate all candidates sharing the fewest top preferences
    const min = Math.min(...remaining.map((c) => tallies[c]))
    const eliminated = remaining.filter((c) => tallies[c] === min)
    rounds.push({ eliminated, tallies })
    remaining = remaining.filter((c) => !eliminated.includes(c))
  }
  return {
    outcome: 'elected',
    winner: remaining[0],
    blankCount,
    rounds,
  }
}
