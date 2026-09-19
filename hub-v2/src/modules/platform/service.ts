import { bodyRoles } from './responsibilities.js'
import { type PoolClient } from 'pg'
import { requirePgPool } from '../../lib/pg'

import {
  transitionDeadline,
  BODY_KINDS,
  type Decision,
  type DecisionState,
  type Body,
  type Task,
} from './platformShared.ts'

export interface Actor {
  id: string
  role: string
  membershipTrack?: string
  constituencyWorkStatus?: string
  membershipStatus?: string
  hubAccessStatus?: string
}
type Input = Record<string, unknown>
export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), {
    status,
    code:
      status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'validation',
  })
}
export function text(
  input: Input,
  key: string,
  max = 200,
  required = true,
): string {
  const value = input[key]
  if (value === undefined && !required) return ''
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    fail(400, `Check ${key}.`)
  return value.trim()
}
function date(input: Input, key: string, required = false): string | null {
  const value = text(input, key, 80, required)
  if (!value) return null
  if (!Number.isFinite(Date.parse(value))) fail(400, `Check ${key}.`)
  return new Date(value).toISOString()
}
export function intId(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) fail(400, 'Invalid record identifier.')
  return n
}
export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    fail(400, 'Invalid record identifier.')
  return value
}
// Same schema as Payload's collections (accounts / assignments / wg_progress /
// audit_log) plus the platform_* tables created by the platform migration.
export function db() {
  if (!process.env.DATABASE_URL)
    fail(
      503,
      'Connect PostgreSQL to use the operational workspace. No demonstration records will be substituted.',
    )
  return requirePgPool()
}
export async function transaction<T>(
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db().connect()
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
async function audit(
  client: PoolClient,
  actor: Actor,
  action: string,
  target: string,
  reason: string,
  after: Input = {},
) {
  await client.query(
    `INSERT INTO audit_log(actor_id,action,target_type,target_id,reason,"after") VALUES($1,$2,'platform',$3,$4,$5)`,
    [actor.id, action, target, reason, after],
  )
}
export async function permissions(
  actor: Actor,
  client: Pick<PoolClient, 'query'> = db(),
) {
  const current = (
    await client.query(
      `SELECT role,membership_track,constituency_work_status,membership_status,hub_access_status FROM accounts WHERE id=$1 FOR SHARE`,
      [actor.id],
    )
  ).rows[0]
  if (
    !current ||
    current.hub_access_status === 'suspended' ||
    ['expired', 'terminated'].includes(current.membership_status)
  )
    fail(403, 'This membership is no longer active.')
  const { rows } = await client.query<{
    scope_type: string
    scope_id: string
    role: string
  }>(
    `SELECT scope_type,scope_id,role FROM assignments WHERE account_id=$1 AND status='active' AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()) FOR SHARE`,
    [actor.id],
  )
  const cw =
    current.membership_track === 'constituency_work' &&
    current.constituency_work_status === 'active' &&
    ['active', 'renewal_due'].includes(current.membership_status) &&
    current.hub_access_status === 'active'
  const team = (name: string) =>
    cw && rows.some((r) => r.scope_type === 'team' && r.scope_id === name)
  const participates = (id: string) =>
    cw && rows.some((r) => r.scope_type === 'body' && r.scope_id === id)
  const manages = (id: string) =>
    cw &&
    rows.some(
      (r) =>
        r.scope_type === 'body' &&
        r.scope_id === id &&
        ['coordinator', 'contact_point', 'liaison'].includes(r.role),
    )
  return {
    rows,
    cw,
    admin: current.role === 'admin',
    membership: team('membership_team'),
    partnerships: team('partnerships'),
    publisher: team('content_publisher'),
    participates,
    manages,
  }
}
const bodySelect = `SELECT id,name,kind,description,public_summary AS "publicSummary",review_due_at AS "reviewDueAt",version,published_version AS "publishedVersion" FROM platform_bodies`
const taskSelect = `SELECT t.id,t.body_id AS "bodyId",t.title,t.description,t.owner_id AS "ownerId",a.name AS "ownerName",t.due_at AS "dueAt",t.status,t.decision_id AS "decisionId",t.version,t.created_by AS "createdBy" FROM platform_tasks t LEFT JOIN accounts a ON a.id=t.owner_id`
const decisionSelect = `SELECT id,body_id AS "bodyId",(SELECT name FROM platform_bodies b WHERE b.id=platform_decisions.body_id) AS "bodyName",title,proposal,stage,process,policy_version AS "policyVersion",urgency_reason AS "urgencyReason",snap_hours::float AS "snapHours",deadline_at AS "deadlineAt",version,author_id AS "authorId",is_public AS "isPublic",outcome,outcome_evidence AS "outcomeEvidence",electorate_size AS "electorateSize",votes_for AS "votesFor",votes_against AS "votesAgainst" FROM platform_decisions`
const enquirySelect = `SELECT id,organisation,contact_name AS "contactName",email,message,status,owner_id AS "ownerId",follow_up_at AS "followUpAt",decision_id AS "decisionId",public_summary AS "publicSummary",website,version FROM platform_enquiries`

export async function overview(actor: Actor) {
  const p = await permissions(actor)
  const bodyIds = p.rows
    .filter((r) => r.scope_type === 'body')
    .map((r) => r.scope_id)
  const [bodies, people, assignments, tasks, decisions, enquiries] =
    await Promise.all([
      db().query(bodySelect + ' WHERE $1::boolean ORDER BY name', [
        p.cw || p.admin,
      ]),
      db().query(
        `SELECT id,name,entity_type AS "entityType",membership_track AS "membershipTrack",membership_status AS "membershipStatus" FROM accounts WHERE $1::boolean OR id=$2 OR ($3::boolean AND EXISTS(SELECT 1 FROM assignments s WHERE s.account_id=accounts.id AND s.status='active' AND s.starts_at<=now() AND (s.ends_at IS NULL OR s.ends_at>now()) AND ((s.scope_type='body' AND s.scope_id=ANY($4::text[])) OR ($5::boolean AND s.scope_type='team' AND s.scope_id='partnerships')))) ORDER BY name LIMIT 1000`,
        [p.membership || p.admin, actor.id, p.cw, bodyIds, p.partnerships],
      ),
      db().query(
        `SELECT s.id,s.account_id AS "accountId",a.name,s.scope_type AS "scopeType",s.scope_id AS "scopeId",s.role,s.starts_at AS "startsAt",s.ends_at AS "endsAt",s.status,s.appointment_evidence AS evidence FROM assignments s JOIN accounts a ON a.id=s.account_id WHERE $1::boolean OR s.account_id=$2 OR ($3::boolean AND s.scope_type='body' AND s.scope_id=ANY($4::text[])) ORDER BY s.created_at DESC LIMIT 1000`,
        [p.admin || p.membership, actor.id, p.cw, bodyIds],
      ),
      db().query(
        taskSelect +
          ' WHERE t.body_id=ANY($1::text[]) ORDER BY t.due_at NULLS LAST LIMIT 500',
        [p.cw ? bodyIds : []],
      ),
      db().query(
        decisionSelect +
          ' WHERE body_id=ANY($1::text[]) ORDER BY updated_at DESC LIMIT 500',
        [p.cw ? bodyIds : []],
      ),
      p.partnerships
        ? db().query(enquirySelect + ' ORDER BY created_at DESC LIMIT 500')
        : Promise.resolve({ rows: [] }),
    ])
  const renewals = await db().query(
    `SELECT name,renewal_due_at FROM accounts WHERE ($1::boolean OR id=$2) AND membership_track='constituency_work' AND renewal_due_at<=now()+interval '30 days'`,
    [p.membership, actor.id],
  )
  const notices: { kind: string; title: string; dueAt: string }[] = []
  for (const r of renewals.rows)
    notices.push({
      kind: 'renewal',
      title: `Membership renewal: ${r.name}`,
      dueAt: r.renewal_due_at,
    })
  for (const e of enquiries.rows)
    if (!['closed', 'approved'].includes(e.status) && e.followUpAt)
      notices.push({
        kind: 'partnership',
        title: `Follow up: ${e.organisation}`,
        dueAt: e.followUpAt,
      })
  const horizon = Date.now() + 30 * 86400000
  for (const a of assignments.rows)
    if (
      a.status === 'active' &&
      a.endsAt &&
      new Date(a.endsAt).getTime() < horizon
    )
      notices.push({
        kind: 'handover',
        title: `${a.name}: ${a.role} in ${a.scopeId}`,
        dueAt: a.endsAt,
      })
  for (const t of tasks.rows)
    if (t.status !== 'done' && t.dueAt && new Date(t.dueAt).getTime() < horizon)
      notices.push({ kind: 'task', title: t.title, dueAt: t.dueAt })
  for (const d of decisions.rows)
    if (
      d.deadlineAt &&
      !['adopted', 'not_adopted', 'withdrawn'].includes(d.stage)
    )
      notices.push({
        kind: 'decision',
        title: `${d.title}: ${d.stage}`,
        dueAt: d.deadlineAt,
      })
  for (const b of bodies.rows)
    if (
      p.manages(b.id) &&
      b.reviewDueAt &&
      new Date(b.reviewDueAt).getTime() < horizon
    )
      notices.push({
        kind: 'review',
        title: `Review public information: ${b.name}`,
        dueAt: b.reviewDueAt,
      })
  return {
    bodies: bodies.rows.map((b: Body) => ({
      ...b,
      description: p.admin || p.participates(b.id) ? b.description : '',
      publicSummary:
        p.admin || p.publisher || p.participates(b.id) ? b.publicSummary : '',
      canManage: p.manages(b.id),
      canParticipate: p.participates(b.id),
    })),
    people: people.rows,
    assignments: assignments.rows,
    tasks: tasks.rows.map((t: Task & { createdBy: string }) => ({
      ...t,
      canEdit:
        p.manages(t.bodyId) ||
        t.ownerId === actor.id ||
        t.createdBy === actor.id,
    })),
    decisions: decisions.rows,
    enquiries: enquiries.rows,
    canAdminister: p.admin,
    canReviewMembership: p.membership,
    canManagePartnerships: p.partnerships,
    canPublish: p.publisher,
    notices: notices.sort(
      (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
    ),
  }
}

export async function saveBody(actor: Actor, input: Input, id?: string) {
  return transaction(async (client) => {
    const p = await permissions(actor, client)
    if (id ? !p.manages(id) && !p.admin : !p.admin)
      fail(
        403,
        'An assigned Contact Point, Liaison, coordinator or platform administrator is required.',
      )
    if (id && !p.admin) {
      const body = (
        await client.query('SELECT kind FROM platform_bodies WHERE id=$1', [id])
      ).rows[0]
      if (!body || body.kind !== input.kind)
        fail(403, 'Only an administrator can change the type of a body.')
    }
    const name = text(input, 'name'),
      kind = text(input, 'kind'),
      description = text(input, 'description', 5000, false),
      summary = text(input, 'publicSummary', 3000, false)
    if (!BODY_KINDS.includes(kind as (typeof BODY_KINDS)[number]))
      fail(400, 'Choose a body type.')
    const slug = id || text(input, 'id', 80)
    if (!/^[a-z][a-z0-9-]{1,79}$/.test(slug))
      fail(400, 'Use a short lowercase identifier with hyphens.')
    const values = [
      slug,
      name,
      kind,
      description,
      summary,
      date(input, 'reviewDueAt'),
      actor.id,
    ]
    const result = id
      ? await client.query(
          `UPDATE platform_bodies SET name=$2,kind=$3,description=$4,public_summary=$5,review_due_at=$6,updated_by=$7,version=version+1,updated_at=now() WHERE id=$1 AND version=$8 RETURNING id`,
          [...values, input.version],
        )
      : await client.query(
          `INSERT INTO platform_bodies(id,name,kind,description,public_summary,review_due_at,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
          values,
        )
    if (!result.rowCount)
      fail(
        409,
        'The body changed or this identifier already exists. Reload first.',
      )
    await audit(client, actor, 'body.saved', slug, description.slice(0, 200))
    return { id: slug }
  })
}
export async function publishBody(actor: Actor, id: string, version: unknown) {
  return transaction(async (client) => {
    const p = await permissions(actor, client)
    if (!p.publisher) fail(403, 'A content publisher assignment is required.')
    const result = await client.query(
      `UPDATE platform_bodies SET public_snapshot=jsonb_build_object('id',id,'name',name,'kind',kind,'summary',public_summary,'reviewDueAt',review_due_at),published_version=version,published_by=$2 WHERE id=$1 AND version=$3 AND updated_by<>$2 AND public_summary<>'' RETURNING id`,
      [id, actor.id, version],
    )
    if (!result.rowCount)
      fail(
        409,
        'A different publisher must review the current, non-empty public summary.',
      )
    await audit(
      client,
      actor,
      'body.published',
      id,
      'Reviewed public information',
    )
  })
}
export async function assign(actor: Actor, input: Input) {
  return transaction(async (client) => {
    const p = await permissions(actor, client)
    if (!p.admin)
      fail(
        403,
        'Only platform administrators can record an evidenced assignment.',
      )
    const accountId = intId(input.accountId),
      scopeType = text(input, 'scopeType'),
      scopeId = text(input, 'scopeId'),
      role = text(input, 'role'),
      evidence = text(input, 'evidence', 2000)
    if (!['body', 'team', 'working_group'].includes(scopeType))
      fail(400, 'Choose body, team or working group.')
    const valid =
      scopeType === 'body'
        ? [
            'member',
            'coordinator',
            'contact_point',
            'liaison',
            'council_representative',
          ]
        : scopeType === 'working_group'
          ? ['contact']
          : ['member']
    if (!valid.includes(role)) fail(400, 'Invalid role for this scope.')
    if (
      scopeType === 'team' &&
      ![
        'membership_team',
        'partnerships',
        'content_editor',
        'content_publisher',
        'gys_policy_team',
      ].includes(scopeId)
    )
      fail(400, 'Unknown team responsibility.')
    if (scopeType === 'body') {
      const { rows: bodies } = await client.query(
        'SELECT kind FROM platform_bodies WHERE id=$1',
        [scopeId],
      )
      if (!bodies.length) fail(400, 'Choose an existing body.')
      if (!bodyRoles(bodies[0].kind).includes(role))
        fail(400, 'Choose a documented responsibility for this type of body.')
    }
    if (scopeType === 'working_group') {
      const exists = await client.query(
        'SELECT 1 FROM working_groups WHERE slug=$1',
        [scopeId],
      )
      if (!exists.rowCount) fail(400, 'Choose an existing working group.')
    }
    const startsAt = date(input, 'startsAt', true),
      endsAt = date(input, 'endsAt', true)
    if (Date.parse(endsAt!) <= Date.parse(startsAt!))
      fail(400, 'The end must follow the start.')
    const eligible = await client.query(
      `SELECT 1 FROM accounts WHERE id=$1 AND entity_type='individual' AND hub_access_status='active' AND membership_track='constituency_work' AND constituency_work_status='active' AND membership_status IN ('active','renewal_due')`,
      [accountId],
    )
    if (!eligible.rowCount)
      fail(409, 'This person must have active Constituency Work membership.')
    const { rows } = await client.query(
      `INSERT INTO assignments(account_id,scope_type,scope_id,role,starts_at,ends_at,appointment_evidence,assigned_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(account_id,scope_type,scope_id,role) DO UPDATE SET status='active',starts_at=$5,ends_at=$6,appointment_evidence=$7,assigned_by_id=$8,updated_at=now() RETURNING id`,
      [
        accountId,
        scopeType,
        scopeId,
        role,
        startsAt,
        endsAt,
        evidence,
        actor.id,
      ],
    )
    await audit(client, actor, 'assignment.recorded', rows[0].id, evidence, {
      accountId,
      scopeType,
      scopeId,
      role,
      startsAt,
      endsAt,
    })
  })
}
export async function revoke(actor: Actor, id: string, reason: string) {
  return transaction(async (client) => {
    if (!(await permissions(actor, client)).admin)
      fail(403, 'Platform administrator access required.')
    if (reason.length < 8)
      fail(400, 'Give a reason for ending this assignment.')
    const result = await client.query(
      `UPDATE assignments SET status='inactive',ends_at=now(),updated_at=now() WHERE id=$1 RETURNING account_id`,
      [intId(id)],
    )
    if (!result.rowCount) fail(404, 'Assignment not found.')
    await audit(client, actor, 'assignment.revoked', id, reason)
  })
}
export async function joinBody(actor: Actor, id: string) {
  return transaction(async (client) => {
    if (!(await permissions(actor, client)).cw)
      fail(403, 'Active Constituency Work membership is required.')
    if (
      !(
        await client.query(
          "SELECT 1 FROM platform_bodies WHERE id=$1 AND kind='working_group'",
          [id],
        )
      ).rowCount
    )
      fail(403, 'This body requires an assigned or screened membership.')
    await client.query(
      `INSERT INTO assignments(account_id,scope_type,scope_id,role) VALUES($1,'body',$2,'member') ON CONFLICT(account_id,scope_type,scope_id,role) DO UPDATE SET status='active',starts_at=now(),ends_at=NULL`,
      [actor.id, id],
    )
    await audit(
      client,
      actor,
      'body.joined',
      id,
      'Member joined an open working group',
    )
  })
}

export async function saveTask(actor: Actor, input: Input, id?: string) {
  return transaction(async (client) => {
    const bodyId = text(input, 'bodyId'),
      p = await permissions(actor, client)
    if (!p.participates(bodyId)) fail(403, 'Join this body before adding work.')
    const ownerId = input.ownerId ? intId(input.ownerId) : null
    if (
      ownerId &&
      !(
        await client.query(
          `SELECT 1 FROM assignments s JOIN accounts a ON a.id=s.account_id WHERE s.account_id=$1 AND s.scope_type='body' AND s.scope_id=$2 AND s.status='active' AND s.starts_at<=now() AND (s.ends_at IS NULL OR s.ends_at>now()) AND a.membership_track='constituency_work' AND a.constituency_work_status='active' AND a.hub_access_status='active' AND a.membership_status IN ('active','renewal_due')`,
          [ownerId, bodyId],
        )
      ).rowCount
    )
      fail(400, 'Assign work to a current member of this body.')
    const decisionId = input.decisionId ? uuid(input.decisionId) : null
    if (
      decisionId &&
      !(
        await client.query(
          `SELECT 1 FROM platform_decisions WHERE id=$1 AND body_id=$2 AND stage='adopted'`,
          [decisionId, bodyId],
        )
      ).rowCount
    )
      fail(400, 'Link an adopted decision from this body.')
    const status = text(input, 'status')
    if (!['open', 'in_progress', 'done'].includes(status))
      fail(400, 'Choose a task status.')
    const values = [
      bodyId,
      text(input, 'title'),
      text(input, 'description', 5000, false),
      ownerId,
      date(input, 'dueAt'),
      status,
      decisionId,
      actor.id,
    ]
    const result = id
      ? await client.query(
          `UPDATE platform_tasks SET title=$2,description=$3,owner_id=$4,due_at=$5,status=$6,decision_id=$7,version=version+1,updated_at=now() WHERE id=$9 AND body_id=$1 AND version=$10 AND ($11::boolean OR created_by=$8 OR owner_id=$8) RETURNING id`,
          [...values, uuid(id), input.version, p.manages(bodyId)],
        )
      : await client.query(
          `INSERT INTO platform_tasks(body_id,title,description,owner_id,due_at,status,decision_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          values,
        )
    if (!result.rowCount)
      fail(409, 'Task changed, or you are not its owner/coordinator.')
    await audit(client, actor, 'task.saved', result.rows[0].id, status)
    return result.rows[0]
  })
}

export async function saveDecision(actor: Actor, input: Input, id?: string) {
  return transaction(async (client) => {
    const p = await permissions(actor, client),
      bodyId = text(input, 'bodyId')
    if (!p.participates(bodyId))
      fail(403, 'Only members of this body can propose a decision.')
    const title = text(input, 'title'),
      proposal = text(input, 'proposal', 20000),
      process = text(input, 'process'),
      policy = text(input, 'policyVersion', 200),
      urgency = text(input, 'urgencyReason', 2000, false)
    if (!['standard', 'snap'].includes(process))
      fail(
        400,
        'Choose a standard or snap process. Conference decisions require a separate attendance model.',
      )
    const snapHours = Number(input.snapHours ?? 24)
    if (!Number.isFinite(snapHours) || snapHours <= 0 || snapHours >= 168)
      fail(400, 'Snap decisions need fewer than 168 hours.')
    if (process !== 'standard' && urgency.length < 8)
      fail(400, 'Explain the urgency or conference context.')
    const values = [
      bodyId,
      title,
      proposal,
      process,
      policy,
      urgency,
      snapHours,
      actor.id,
    ]
    const result = id
      ? await client.query(
          `UPDATE platform_decisions SET title=$2,proposal=$3,version=version+1,updated_at=now() WHERE id=$9 AND body_id=$1 AND version=$10 AND stage IN ('draft','revision') AND process=$4 AND policy_version=$5 AND urgency_reason=$6 AND snap_hours=$7 AND (author_id=$8 OR $11::boolean) RETURNING *`,
          [...values, uuid(id), input.version, p.manages(bodyId)],
        )
      : await client.query(
          `INSERT INTO platform_decisions(body_id,title,proposal,process,policy_version,urgency_reason,snap_hours,author_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          values,
        )
    if (!result.rowCount)
      fail(409, 'The proposal changed or cannot be edited in this phase.')
    const row = result.rows[0]
    await client.query(
      'INSERT INTO platform_decision_revisions(decision_id,version,title,proposal,author_id) VALUES($1,$2,$3,$4,$5)',
      [row.id, row.version, title, proposal, actor.id],
    )
    await audit(
      client,
      actor,
      'decision.revised',
      row.id,
      `Proposal version ${row.version}`,
    )
    return { id: row.id }
  })
}
export async function decisionDetail(actor: Actor, id: string) {
  const { rows } = await db().query(decisionSelect + ' WHERE id=$1', [uuid(id)])
  const d = rows[0]
  if (!d) fail(404, 'Decision not found.')
  const p = await permissions(actor)
  if (!p.participates(d.bodyId))
    fail(403, 'Only members of this body can read the process.')
  const [contributions, revisions, history] = await Promise.all([
    db().query(
      `SELECT c.id,c.author_id AS "authorId",a.name AS "authorName",c.kind,c.text,c.grounds,c.alternative,c.resolution,c.created_at AS "createdAt" FROM platform_contributions c JOIN accounts a ON a.id=c.author_id WHERE c.decision_id=$1 ORDER BY c.created_at`,
      [id],
    ),
    db().query(
      `SELECT version,title,proposal,created_at AS "createdAt" FROM platform_decision_revisions WHERE decision_id=$1 ORDER BY version DESC`,
      [id],
    ),
    db().query(
      `SELECT action,reason,created_at AS "createdAt" FROM audit_log WHERE target_type='platform' AND target_id=$1 ORDER BY created_at`,
      [id],
    ),
  ])
  return {
    viewerId: actor.id,
    decision: d,
    contributions: contributions.rows,
    revisions: revisions.rows,
    history: history.rows,
    canManage: p.manages(d.bodyId),
    canParticipate: true,
  }
}
export async function contribute(actor: Actor, id: string, input: Input) {
  return transaction(async (client) => {
    const { rows } = await client.query(
        'SELECT * FROM platform_decisions WHERE id=$1 FOR UPDATE',
        [uuid(id)],
      ),
      d = rows[0]
    if (!d) fail(404, 'Decision not found.')
    if (!(await permissions(actor, client)).participates(d.body_id))
      fail(403, 'Only members of this body may participate.')
    if (
      !['consultation', 'decision'].includes(d.stage) ||
      new Date(d.deadline_at).getTime() <= Date.now()
    )
      fail(409, 'The response period is closed.')
    const kind = text(input, 'kind'),
      message = text(input, 'text', 5000),
      grounds = text(input, 'grounds', 3000, false),
      alternative = text(input, 'alternative', 5000, false)
    if (!['comment', 'red', 'grey'].includes(kind))
      fail(400, 'Choose comment, red or grey flag.')
    if (kind === 'red' && (!grounds || !alternative))
      fail(400, 'A red flag needs grounds and an alternative proposal.')
    if (kind === 'grey' && !grounds)
      fail(400, 'Explain the concern behind a grey flag.')
    const { rows: added } = await client.query(
      'INSERT INTO platform_contributions(decision_id,author_id,kind,text,grounds,alternative) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [id, actor.id, kind, message, grounds, alternative],
    )
    await audit(
      client,
      actor,
      'decision.contribution',
      id,
      `${kind} recorded`,
      { contributionId: added[0].id },
    )
  })
}
export async function resolveContribution(
  actor: Actor,
  id: string,
  input: Input,
) {
  return transaction(async (client) => {
    const { rows } = await client.query(
        `SELECT c.*,d.body_id,d.stage FROM platform_contributions c JOIN platform_decisions d ON d.id=c.decision_id WHERE c.id=$1 FOR UPDATE OF d,c`,
        [uuid(id)],
      ),
      c = rows[0]
    if (!c) fail(404, 'Contribution not found.')
    const p = await permissions(actor, client)
    // A coordinator may answer a flag, but its author must confirm withdrawal.
    if (!p.participates(c.body_id) || c.author_id !== actor.id)
      fail(
        403,
        'Only the flag author can confirm that their concern is resolved.',
      )
    if (c.kind === 'comment') fail(400, 'Comments are not flags.')
    if (['adopted', 'not_adopted', 'withdrawn'].includes(c.stage))
      fail(409, 'The decision is already closed.')
    const reason = text(input, 'resolution', 3000)
    await client.query(
      'UPDATE platform_contributions SET resolution=$2,resolved_by=$3,resolved_at=now() WHERE id=$1',
      [id, reason, actor.id],
    )
    await audit(client, actor, 'decision.flag_resolved', c.decision_id, reason)
  })
}
export async function transition(actor: Actor, id: string, input: Input) {
  return transaction(async (client) => {
    const { rows } = await client.query(
        'SELECT * FROM platform_decisions WHERE id=$1 FOR UPDATE',
        [uuid(id)],
      ),
      d = rows[0]
    if (!d) fail(404, 'Decision not found.')
    if (!(await permissions(actor, client)).manages(d.body_id))
      fail(
        403,
        'The assigned body facilitator must confirm process transitions.',
      )
    if (d.version !== input.version)
      fail(409, 'The proposal changed. Review its current version.')
    const next = text(input, 'stage') as DecisionState
    let reason = text(input, 'reason', 3000)
    const allowed: Record<string, string[]> = {
      draft: ['consultation', 'withdrawn'],
      consultation: ['revision', 'withdrawn'],
      revision: ['decision', 'withdrawn'],
      decision: ['adopted', 'voting', 'withdrawn'],
      voting: ['adopted', 'not_adopted', 'withdrawn'],
    }
    if (!allowed[d.stage]?.includes(next))
      fail(409, 'This transition is not allowed.')
    if (
      next !== 'withdrawn' &&
      d.deadline_at &&
      new Date(d.deadline_at).getTime() > Date.now()
    )
      fail(409, 'Wait for the current response period to end.')
    let evidence = '',
      electorate: number | null = null,
      forVotes: number | null = null,
      against: number | null = null
    if (next === 'adopted' || next === 'not_adopted') {
      evidence = text(input, 'evidence', 3000)
      if (d.stage === 'decision') {
        const flags = await client.query(
          "SELECT 1 FROM platform_contributions WHERE decision_id=$1 AND kind='red' AND resolution IS NULL LIMIT 1",
          [id],
        )
        if (flags.rowCount)
          fail(
            409,
            'Resolve the outstanding red flags or use the voting process.',
          )
      }
      if (d.stage === 'decision') {
        const grey = await client.query(
          "SELECT 1 FROM platform_contributions WHERE decision_id=$1 AND kind='grey' AND resolution IS NULL LIMIT 1",
          [id],
        )
        if (grey.rowCount)
          reason += `\nReservations considered: ${text(input, 'reservations', 3000)}`
      }
      if (d.stage === 'voting') {
        if (
          ![input.electorateSize, input.votesFor, input.votesAgainst].every(
            (v) => typeof v === 'number' && Number.isSafeInteger(v),
          )
        )
          fail(400, 'Enter all three vote counts explicitly.')
        electorate = Number(input.electorateSize)
        forVotes = Number(input.votesFor)
        against = Number(input.votesAgainst)
        if (
          ![electorate, forVotes, against].every(Number.isInteger) ||
          electorate < 1 ||
          forVotes < 0 ||
          against < 0 ||
          forVotes + against > electorate
        )
          fail(400, 'Enter valid eligible-seat and vote counts.')
        if (forVotes + against < Math.ceil(electorate * 0.05))
          fail(
            409,
            'The vote did not meet quorum. Withdraw the proposal and record the ballot evidence.',
          )
        const passed = forVotes * 3 >= (forVotes + against) * 2
        if ((next === 'adopted') !== passed)
          fail(
            409,
            'The recorded vote does not support this outcome (5% quorum, two-thirds approval).',
          )
      }
    }
    const outcomeBasis = text(input, 'outcomeBasis', 40, false)
    let veto: Input | undefined
    if (outcomeBasis && !['process', 'formal_veto'].includes(outcomeBasis))
      fail(400, 'Choose a recognised outcome basis.')
    if (outcomeBasis === 'formal_veto') {
      if (d.stage !== 'voting' || next !== 'withdrawn')
        fail(409, 'A formal veto stops the vote and withdraws the proposal.')
      const organisations = Number(input.vetoOrganisations),
        south = Number(input.vetoGlobalSouth),
        bodies = Number(input.vetoBodies)
      if (
        ![organisations, south, bodies].every(Number.isSafeInteger) ||
        Math.min(organisations, south, bodies) < 0 ||
        south > organisations
      )
        fail(400, 'Enter valid represented organisation and body counts.')
      if (organisations < 20 && south < 6 && bodies < 5)
        fail(409, 'The formal veto threshold has not been met.')
      evidence = text(input, 'evidence', 3000)
      veto = { organisations, globalSouthOrganisations: south, bodies }
      reason = `Formal veto: ${reason}`
    }
    if (next === 'withdrawn' && !evidence)
      evidence = text(input, 'evidence', 3000, false)
    const deadline = transitionDeadline(
      d.process as Decision['process'],
      next,
      new Date(),
      Number(d.snap_hours),
    )
    await client.query(
      `UPDATE platform_decisions SET stage=$2,deadline_at=$3,outcome=$4,outcome_evidence=$5,electorate_size=$6,votes_for=$7,votes_against=$8,version=version+1,updated_at=now() WHERE id=$1`,
      [
        id,
        next,
        deadline,
        ['adopted', 'not_adopted', 'withdrawn'].includes(next) ? reason : null,
        evidence || null,
        electorate,
        forVotes,
        against,
      ],
    )
    await audit(client, actor, `decision.${next}`, id, reason, {
      version: d.version,
      deadline,
      electorate,
      votesFor: forVotes,
      votesAgainst: against,
      ...(veto ? { veto } : {}),
    })
    if (next === 'adopted') {
      await client.query(
        `INSERT INTO platform_tasks(body_id,title,description,owner_id,due_at,status,decision_id,created_by) VALUES($1,$2,$3,$4,now()+interval '7 days','open',$5,$4)`,
        [
          d.body_id,
          `Communicate decision: ${d.title}`.slice(0, 200),
          'Update the constituency decision tracker and communicate through the main channel. Record the communication link here when complete.',
          actor.id,
          id,
        ],
      )
    }
  })
}
export async function publishDecision(
  actor: Actor,
  id: string,
  version: unknown,
) {
  return transaction(async (client) => {
    const p = await permissions(actor, client)
    if (!p.publisher)
      fail(403, 'A content publisher must approve public disclosure.')
    const record = (
      await client.query('SELECT body_id FROM platform_decisions WHERE id=$1', [
        uuid(id),
      ])
    ).rows[0]
    if (!record || !p.participates(record.body_id))
      fail(
        403,
        'The publisher must belong to this body to review its decision.',
      )
    const result = await client.query(
      `UPDATE platform_decisions SET is_public=true WHERE id=$1 AND version=$2 AND stage='adopted' AND author_id<>$3 AND (SELECT r.author_id FROM platform_decision_revisions r WHERE r.decision_id=platform_decisions.id ORDER BY r.version DESC LIMIT 1)<>$3 RETURNING id`,
      [uuid(id), version, actor.id],
    )
    if (!result.rowCount)
      fail(
        409,
        'Only an adopted, current proposal can be published by a different person.',
      )
    await audit(
      client,
      actor,
      'decision.published',
      id,
      'Approved for the public decision register',
    )
  })
}

export async function createEnquiry(input: Input) {
  if (input.consent !== true)
    fail(400, 'Consent to using these details to respond is required.')
  if (input.websiteTrap) return { ok: true }
  const email = text(input, 'email', 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(400, 'Enter a valid email address.')
  const { rows } = await db().query(
    `INSERT INTO platform_enquiries(organisation,contact_name,email,message,privacy_version) VALUES($1,$2,$3,$4,'partner-enquiry-2026-09') RETURNING id`,
    [
      text(input, 'organisation'),
      text(input, 'contactName'),
      email,
      text(input, 'message', 5000),
    ],
  )
  return { ok: true, id: rows[0].id }
}
export async function updateEnquiry(actor: Actor, id: string, input: Input) {
  return transaction(async (client) => {
    if (!(await permissions(actor, client)).partnerships)
      fail(403, 'A partnerships assignment is required.')
    const status = text(input, 'status'),
      summary = text(input, 'publicSummary', 3000, false),
      website = text(input, 'website', 1000, false),
      decisionId = input.decisionId ? uuid(input.decisionId) : null,
      ownerId = input.ownerId ? intId(input.ownerId) : null
    if (!['new', 'in_progress', 'closed', 'approved'].includes(status))
      fail(400, 'Choose an enquiry status.')
    if (website) {
      let url: URL
      try {
        url = new URL(website)
      } catch {
        fail(400, 'Use an HTTPS website URL.')
      }
      if (url.protocol !== 'https:' || url.username || url.password)
        fail(400, 'Use an HTTPS website URL.')
    }
    if (
      status === 'approved' &&
      (!summary ||
        !decisionId ||
        !(
          await client.query(
            "SELECT 1 FROM platform_decisions WHERE id=$1 AND stage='adopted' AND is_public=true",
            [decisionId],
          )
        ).rowCount)
    )
      fail(
        409,
        'Publish the approving decision and provide a public summary before listing a partner.',
      )
    if (
      ownerId &&
      !(
        await client.query(
          "SELECT 1 FROM assignments s JOIN accounts a ON a.id=s.account_id WHERE s.account_id=$1 AND s.scope_type='team' AND s.scope_id='partnerships' AND s.status='active' AND s.starts_at<=now() AND (s.ends_at IS NULL OR s.ends_at>now()) AND a.membership_track='constituency_work' AND a.constituency_work_status='active' AND a.hub_access_status='active' AND a.membership_status IN ('active','renewal_due')",
          [ownerId],
        )
      ).rowCount
    )
      fail(400, 'Choose a current partnerships coordinator.')
    const result = await client.query(
      `UPDATE platform_enquiries SET status=$2,owner_id=$3,follow_up_at=$4,decision_id=$5,public_summary=$6,website=$7,version=version+1,updated_at=now() WHERE id=$1 AND version=$8 RETURNING id`,
      [
        uuid(id),
        status,
        ownerId,
        date(input, 'followUpAt'),
        decisionId,
        summary,
        website,
        input.version,
      ],
    )
    if (!result.rowCount) fail(409, 'The enquiry changed. Reload first.')
    await audit(client, actor, 'partnership.updated', id, status)
  })
}
export async function publicPlatform() {
  const [bodies, decisions, partners] = await Promise.all([
    db().query(
      'SELECT public_snapshot FROM platform_bodies WHERE public_snapshot IS NOT NULL ORDER BY name',
    ),
    db().query(
      `SELECT id,title,proposal,outcome,policy_version AS "policyVersion",updated_at AS "decidedAt" FROM platform_decisions WHERE is_public=true AND stage='adopted' ORDER BY updated_at DESC LIMIT 200`,
    ),
    db().query(
      "SELECT e.id,e.organisation,e.public_summary AS summary,e.website FROM platform_enquiries e JOIN platform_decisions d ON d.id=e.decision_id WHERE e.status='approved' AND d.is_public=true AND d.stage='adopted' ORDER BY e.organisation",
    ),
  ])
  return {
    bodies: bodies.rows.map(
      (r: { public_snapshot: Record<string, unknown> }) => r.public_snapshot,
    ),
    decisions: decisions.rows,
    partners: partners.rows,
  }
}

export async function membershipAction(actor: Actor, id: string, input: Input) {
  return transaction(async (client) => {
    if (!(await permissions(actor, client)).membership)
      fail(403, 'An active Membership Team assignment is required.')
    const action = text(input, 'action'),
      reason = text(input, 'reason', 2000),
      renewalDueAt = date(input, 'renewalDueAt')
    if (reason.length < 8)
      fail(400, 'Record the onboarding or renewal evidence.')
    const { rows } = await client.query(
        'SELECT * FROM accounts WHERE id=$1 FOR UPDATE',
        [intId(id)],
      ),
      member = rows[0]
    if (!member || member.entity_type !== 'individual')
      fail(404, 'Individual member not found.')
    if (
      member.hub_access_status === 'suspended' ||
      ['expired', 'terminated'].includes(member.membership_status)
    )
      fail(
        409,
        'Resolve the account suspension through the authorised membership process first.',
      )
    if (action === 'activate_cw') {
      if (!renewalDueAt || Date.parse(renewalDueAt) <= Date.now())
        fail(400, 'Set a future renewal date.')
      if (!member.course_passed_at)
        fail(409, 'Course completion is required before recording onboarding.')
      const cohort = text(input, 'cohort', 120)
      await client.query(
        `UPDATE accounts SET membership_track='constituency_work',constituency_work_status='active',membership_status='active',hub_access_status='active',member_status='verified',onboarding_cohort=$2,renewal_due_at=$3 WHERE id=$1`,
        [id, cohort, renewalDueAt],
      )
    } else if (action === 'renew_cw') {
      if (
        member.membership_track !== 'constituency_work' ||
        member.constituency_work_status !== 'active' ||
        !renewalDueAt ||
        Date.parse(renewalDueAt) <= Date.now()
      )
        fail(
          409,
          'Renew a current Constituency Work membership and set its next renewal date.',
        )
      await client.query(
        "UPDATE accounts SET membership_status='active',renewal_due_at=$2 WHERE id=$1",
        [id, renewalDueAt],
      )
    } else if (action === 'expire_cw') {
      if (member.membership_track !== 'constituency_work')
        fail(409, 'This person is already a Network member.')
      await client.query(
        `UPDATE accounts SET membership_track='network',constituency_work_status=NULL,membership_status='active',hub_access_status='active',renewal_due_at=NULL,team_roles='[]'::jsonb,role=CASE WHEN role IN ('wg_contact','focal_point') THEN 'member' ELSE role END WHERE id=$1`,
        [id],
      )
      await client.query(
        "UPDATE assignments SET status='expired',ends_at=now(),updated_at=now() WHERE account_id=$1 AND scope_type IN ('body','team','working_group')",
        [id],
      )
      await client.query(
        "UPDATE wg_progress SET status='interested',role_in_wg='member' WHERE account_id=$1",
        [id],
      )
    } else fail(400, 'Choose onboarding, renewal or Constituency Work expiry.')
    await audit(client, actor, `membership.${action}`, id, reason)
  })
}

// Withdrawal changes public visibility, never the adopted outcome or audit record.
export async function withdrawPublication(
  actor: Actor,
  kind: 'body' | 'decision',
  id: string,
  input: Input,
) {
  return transaction(async (client) => {
    const p = await permissions(actor, client)
    if (!p.publisher) fail(403, 'A content publisher assignment is required.')
    const reason = text(input, 'reason', 2000)
    let result
    if (kind === 'body')
      result = await client.query(
        'UPDATE platform_bodies SET public_snapshot=NULL,published_version=NULL,published_by=NULL WHERE id=$1 AND version=$2 RETURNING id',
        [id, input.version],
      )
    else {
      const record = (
        await client.query(
          'SELECT body_id FROM platform_decisions WHERE id=$1',
          [uuid(id)],
        )
      ).rows[0]
      if (!record || !p.participates(record.body_id))
        fail(403, 'The publisher must belong to this body.')
      result = await client.query(
        'UPDATE platform_decisions SET is_public=false WHERE id=$1 AND version=$2 RETURNING id',
        [id, input.version],
      )
    }
    if (!result.rowCount) fail(409, 'The record changed. Reload first.')
    await audit(client, actor, `${kind}.publication_withdrawn`, id, reason)
  })
}
