// Record the first reviewed Membership Team appointment on a new installation.
// This requires operator database access and is not an HTTP privilege escalation.
import { getPool } from '../../server/lib/db.js'

const pool = getPool()
if (!pool) throw new Error('DATABASE_URL is required.')
const email = String(process.env.MEMBERSHIP_STEWARD_EMAIL || '')
  .trim()
  .toLowerCase()
const evidence = String(process.env.MANDATE_EVIDENCE || '').trim()
const cohort = String(process.env.ONBOARDING_COHORT || '').trim()
const endsAt = new Date(process.env.MANDATE_ENDS_AT || '')
const renewalAt = new Date(process.env.RENEWAL_DUE_AT || '')
const client = await pool.connect()
try {
  if (
    !email ||
    evidence.length < 8 ||
    !cohort ||
    !(endsAt.getTime() > Date.now()) ||
    !(renewalAt.getTime() > Date.now())
  )
    throw new Error(
      'Set MEMBERSHIP_STEWARD_EMAIL, MANDATE_EVIDENCE, ONBOARDING_COHORT, future MANDATE_ENDS_AT and RENEWAL_DUE_AT.',
    )
  await client.query('BEGIN')
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('bootstrap-membership-steward'))",
  )
  const current = await client.query(
    "SELECT 1 FROM account_assignments WHERE scope_type='team' AND scope_id='membership_team' AND status='active' AND (ends_at IS NULL OR ends_at>now())",
  )
  if (current.rowCount)
    throw new Error(
      'A Membership Team appointment already exists. Use the platform to record further assignments.',
    )
  const { rows } = await client.query(
    "SELECT id FROM hub_accounts WHERE lower(email)=$1 AND entity_type='individual' AND course_passed_at IS NOT NULL AND email_verified_at IS NOT NULL AND hub_access_status='active' AND membership_status NOT IN ('expired','terminated') FOR UPDATE",
    [email],
  )
  if (!rows.length)
    throw new Error(
      'Register, verify email and complete the course for this individual account first.',
    )
  const id = rows[0].id
  await client.query(
    "UPDATE hub_accounts SET membership_track='constituency_work', constituency_work_status='active', membership_status='active',onboarding_cohort=$2,renewal_due_at=$3 WHERE id=$1",
    [id, cohort, renewalAt],
  )
  await client.query(
    "INSERT INTO account_assignments(account_id,scope_type,scope_id,role,ends_at,appointment_evidence) VALUES($1,'team','membership_team','member',$2,$3) ON CONFLICT(account_id,scope_type,scope_id,role) DO UPDATE SET status='active',starts_at=now(),ends_at=$2,appointment_evidence=$3,updated_at=now()",
    [id, endsAt, evidence],
  )
  await client.query(
    "INSERT INTO governance_audit(action,target_type,target_id,reason) VALUES('membership.operator_bootstrap','platform',$1,$2)",
    [id, evidence],
  )
  await client.query('COMMIT')
  console.log(
    JSON.stringify({
      event: 'membership_steward_recorded',
      accountId: id,
      endsAt,
    }),
  )
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
