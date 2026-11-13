// S09 decision-making — pure domain logic, no I/O (S09, S13).

export const DECISION_TYPES = [
  'standard', // 5d consult / 24h revision / 24h decision
  'snap', // ½ consult / ¼ revision / ¼ decision of the time available
  'og_standard', // on-ground standard: 6h / 6h / 6h
  'og_snap', // on-ground snap: meeting decision, ⅔ majority
  'press_release', // 48h / 24h / 24h; red flags get +4d resolution window
] as const
export type DecisionType = (typeof DECISION_TYPES)[number]

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

// a snap proposal can't be presented once its deadline has passed
export function snapDeadlinePassed(
  type: DecisionType,
  snapDeadline: string | Date | null | undefined,
  now = Date.now(),
): boolean {
  if (type !== 'snap') return false
  const t = snapDeadline ? new Date(snapDeadline).getTime() : NaN
  return !Number.isFinite(t) || t <= now
}

export const VOTING_WINDOW_MS = 24 * H

// On-ground decisions vote among members present; no 5% quorum (S09 §3.3/§3.4).
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

// Red flags stand until withdrawn or nullified. Grey flags never block
// consensus but may escalate to red.
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

// Adoption needs ≥⅔ of votes cast (S09 §2 step 6); blanks are excluded earlier.
export function voteAdopted(votesFor: number, votesCast: number): boolean {
  if (votesCast <= 0) return false
  return votesFor / votesCast >= 2 / 3
}

export interface VetoRequest {
  requesterKind: 'org' | 'org_global_south' | 'wg_or_ot'
  groupKey: string
}

// Veto stops the vote (S09 §2 step 7): ≥20 orgs, ≥6 Global South orgs, or
// ≥5 working groups/operational teams.
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
