// contracts live in src/shared/platform.ts (the member UI imports them too); this adds the server-only sql
export * from '../../shared/platform.ts'
import type { Decision, DecisionState } from '../../shared/platform.ts'

// One translation between the S09 engine store (decision_proposals) and the
// platform UI's decision vocabulary. decision_proposals is the single source
// of truth; platform_decisions survives only as a uuid-keyed projection.
const STAGE_SQL = `CASE dp.status WHEN 'vetoed' THEN 'withdrawn' WHEN 'failed_quorum' THEN 'not_adopted' WHEN 'rejected' THEN 'not_adopted' ELSE dp.status::text END`
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
