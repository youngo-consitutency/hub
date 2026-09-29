// Shared contracts for the operational platform. HTTP input is validated again on the server.
export const BODY_KINDS = [
  'working_group',
  'operational_team',
  'coordination',
  'council',
  'task_force',
] as const
export const DECISION_STATES = [
  'draft',
  'consultation',
  'revision',
  'decision',
  'voting',
  'adopted',
  'not_adopted',
  'withdrawn',
] as const
export type DecisionState = (typeof DECISION_STATES)[number]
export type BodyKind = (typeof BODY_KINDS)[number]
export interface Person {
  id: string
  name: string
  entityType: string
  membershipTrack: string
  membershipStatus: string
}
export interface Body {
  id: string
  name: string
  kind: BodyKind
  description: string
  publicSummary: string
  reviewDueAt: string | null
  version: number
  publishedVersion: number | null
  canManage: boolean
  canParticipate: boolean
}
export interface Assignment {
  id: string
  accountId: string
  name: string
  scopeType: string
  scopeId: string
  role: string
  startsAt: string
  endsAt: string | null
  status: string
  evidence: string
}
export interface Task {
  canEdit: boolean
  id: string
  bodyId: string
  title: string
  description: string
  ownerId: string | null
  ownerName: string | null
  dueAt: string | null
  status: 'open' | 'in_progress' | 'done'
  decisionId: string | null
  version: number
}
export interface Decision {
  bodyName: string
  id: string
  bodyId: string
  title: string
  proposal: string
  stage: DecisionState
  process: 'standard' | 'snap'
  policyVersion: string
  urgencyReason: string
  snapHours: number
  deadlineAt: string | null
  version: number
  authorId: string
  isPublic: boolean
  outcomeEvidence: string | null
  electorateSize: number | null
  votesFor: number | null
  votesAgainst: number | null
  outcome: string | null
}
export interface Contribution {
  id: string
  authorId: string
  authorName: string
  kind: 'comment' | 'red' | 'grey'
  text: string
  grounds: string
  alternative: string
  resolution: string | null
  createdAt: string
}
export interface DecisionDetail {
  viewerId: string
  decision: Decision
  contributions: Contribution[]
  revisions: {
    version: number
    title: string
    proposal: string
    createdAt: string
  }[]
  history: { action: string; reason: string; createdAt: string }[]
  canManage: boolean
  canParticipate: boolean
}
export interface Enquiry {
  id: string
  organisation: string
  contactName: string
  email: string
  message: string
  status: 'new' | 'in_progress' | 'closed' | 'approved'
  ownerId: string | null
  followUpAt: string | null
  decisionId: string | null
  publicSummary: string
  website: string
  version: number
}
export interface Overview {
  bodies: Body[]
  people: Person[]
  assignments: Assignment[]
  tasks: Task[]
  decisions: Decision[]
  enquiries: Enquiry[]
  canAdminister: boolean
  canReviewMembership: boolean
  canManagePartnerships: boolean
  canPublish: boolean
  notices: { kind: string; title: string; dueAt: string }[]
}

// One translation between the S09 engine store (decision_proposals) and the
// platform UI's decision vocabulary. decision_proposals is the single source
// of truth; platform_decisions survives only as a uuid-keyed projection.
export const STAGE_SQL = `CASE dp.status WHEN 'vetoed' THEN 'withdrawn' WHEN 'failed_quorum' THEN 'not_adopted' WHEN 'rejected' THEN 'not_adopted' ELSE dp.status::text END`
export const BODY_ID_SQL = `CASE dp.body WHEN 'council' THEN 'council' ELSE dp.body_ref END`
const DEADLINE_SQL = `CASE dp.status WHEN 'consultation' THEN dp.consultation_ends_at WHEN 'revision' THEN dp.revision_ends_at WHEN 'decision' THEN dp.decision_ends_at WHEN 'voting' THEN dp.voting_ends_at ELSE NULL END`
export const DECISION_VIEW_SELECT = `SELECT COALESCE(pd.id::text, dp.id::text) AS id,
  ${BODY_ID_SQL} AS "bodyId", b.name AS "bodyName",
  dp.title, dp.proposal_text AS proposal, (${STAGE_SQL})::text AS stage,
  CASE WHEN dp.decision_type = 'snap' THEN 'snap' ELSE 'standard' END AS process,
  dp.policy_version AS "policyVersion", dp.snap_justification AS "urgencyReason",
  dp.snap_hours::float AS "snapHours", ${DEADLINE_SQL} AS "deadlineAt",
  dp.version, dp.proposed_by_id AS "authorId", dp.is_public AS "isPublic",
  dp.result_summary AS outcome, dp.outcome_evidence AS "outcomeEvidence",
  dp.eligible_voter_count AS "electorateSize", dp.votes_for AS "votesFor",
  dp.votes_against AS "votesAgainst"
  FROM decision_proposals dp
  LEFT JOIN platform_decisions pd ON pd.s09_proposal_id = dp.id
  LEFT JOIN platform_bodies b ON b.id = ${BODY_ID_SQL}`

export function transitionDeadline(
  process: Decision['process'],
  stage: DecisionState,
  now: Date,
  snapHours = 24,
): string | null {
  const hours =
    process === 'standard'
      ? { consultation: 120, revision: 24, decision: 24 }
      : {
          consultation: snapHours / 2,
          revision: snapHours / 4,
          decision: snapHours / 4,
        }
  const duration = stage === 'voting' ? 24 : hours[stage as keyof typeof hours]
  return duration ? new Date(now.getTime() + duration * 3600000).toISOString() : null
}
