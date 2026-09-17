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
  return duration
    ? new Date(now.getTime() + duration * 3600000).toISOString()
    : null
}
