import { bodyRoles } from '../../../spa/shared/protocol.js'
import { type PoolClient } from 'pg'
import { requirePgPool } from '../../lib/pg'
import { AUTHORITY_LOCK_NS } from '../../lib/authorityLock'
import {
  councilSeatFor,
  deriveAuthority,
  resolveLegacyRole,
  normaliseScopeType,
  recordKind,
  type AuthorityRow,
} from '../../lib/authority'

import {
  BODY_ID_SQL,
  BODY_KINDS,
  DECISION_VIEW_SELECT,
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
export type Input = Record<string, unknown>
export function fail(status: number, message: string): never {
  throw Object.assign(new Error(message), {
    status,
    code: status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'validation',
  })
}
export function text(input: Input, key: string, max = 200, required = true): string {
  const value = input[key]
  if (value === undefined && !required) return ''
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim()))
    fail(400, `Check ${key}.`)
  return value.trim()
}
function date(input: Input, key: string, required = false): string | null {
  const value = text(input, key, 80, required)
  if (!value) return null
  if (!Number.isFinite(Date.parse(value))) fail(400, `Check ${key}.`)
  return new Date(value).toISOString()
}
function intId(value: unknown): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) fail(400, 'Invalid record identifier.')
  return n
}
function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
    fail(400, 'Invalid record identifier.')
  return value
}
// Same schema as Payload's collections (accounts / authority_records / wg_progress /
// audit_log) plus the platform_* tables created by the platform migration.
export function db() {
  if (!process.env.DATABASE_URL)
    fail(
      503,
      'Connect PostgreSQL to use the operational workspace. No demonstration records will be substituted.',
    )
  return requirePgPool()
}
async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
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
// Lock every account this transaction may write, in ascending id order,
// BEFORE permissions()' FOR SHARE reads. permissions() shares-locks the
// actor's own rows while writes target another account's rows — locking
// only the target would let a cross pair (A writes B while B writes A)
// deadlock on each other's FOR SHARE. Locking {actor, target} in a fixed
// order closes that cycle; see lib/authorityLock.ts for the contract.
async function lockAuthority(client: Pick<PoolClient, 'query'>, ...accountIds: number[]) {
  for (const id of [...new Set(accountIds)].sort((a, b) => a - b))
    await client.query('SELECT pg_advisory_xact_lock($1,$2)', [AUTHORITY_LOCK_NS, id])
}

export async function permissions(actor: Actor, client: Pick<PoolClient, 'query'> = db()) {
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
  // One authority store feeds the SAME derivation the Payload access
  // layer uses (lib/authority.deriveAuthority) — one permission engine, no
  // parallel scope-identifier logic.
  const records = await client.query(
    `SELECT id,role,scope_type::text AS "scopeType",scope_id AS "scopeId",council_seat AS "councilSeat",status,starts_at AS "startsAt",ends_at AS "endsAt" FROM authority_records WHERE account_id=$1 AND status='active' AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()) FOR SHARE`,
    [actor.id],
  )
  const cw =
    current.membership_track === 'constituency_work' &&
    current.constituency_work_status === 'active' &&
    ['active', 'renewal_due'].includes(current.membership_status) &&
    current.hub_access_status === 'active'
  const derived = deriveAuthority(records.rows as AuthorityRow[], { cw })
  const caps = new Set(derived.capabilities)
  return {
    bodyScopes: derived.bodyScopes,
    teamRoles: derived.teamRoles,
    cw,
    admin: current.role === 'admin',
    membership: caps.has('membership.review'),
    partnerships: caps.has('partnership.review'),
    publisher: caps.has('content.publish'),
    participates: (id: string) => derived.bodyScopes.includes(id),
    manages: (id: string) => caps.has(`body.manage:${id}`),
  }
}
const bodySelect = `SELECT id,name,kind,description,public_summary AS "publicSummary",review_due_at AS "reviewDueAt",version,published_version AS "publishedVersion" FROM platform_bodies`
const taskSelect = `SELECT t.id,t.body_id AS "bodyId",t.title,t.description,t.owner_id AS "ownerId",a.name AS "ownerName",t.due_at AS "dueAt",t.status,t.decision_id AS "decisionId",t.version,t.created_by AS "createdBy" FROM platform_tasks t LEFT JOIN accounts a ON a.id=t.owner_id`
const enquirySelect = `SELECT id,organisation,contact_name AS "contactName",email,message,status,owner_id AS "ownerId",follow_up_at AS "followUpAt",decision_id AS "decisionId",public_summary AS "publicSummary",website,version FROM platform_enquiries`

export async function overview(actor: Actor) {
  const p = await permissions(actor)
  const bodyIds = p.bodyScopes
  const [bodies, people, records, tasks, decisions, enquiries] = await Promise.all([
    db().query(bodySelect + ' WHERE $1::boolean ORDER BY name', [p.cw || p.admin]),
    db().query(
      `SELECT id,name,entity_type AS "entityType",membership_track AS "membershipTrack",membership_status AS "membershipStatus" FROM accounts WHERE $1::boolean OR id=$2 OR ($3::boolean AND EXISTS(SELECT 1 FROM authority_records ar WHERE ar.account_id=accounts.id AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now()) AND ((ar.scope_type='body' AND ar.scope_id=ANY($4::text[])) OR ($5::boolean AND ar.scope_type='team' AND ar.role='team.partnerships')))) ORDER BY name LIMIT 1000`,
      [p.membership || p.admin, actor.id, p.cw, bodyIds, p.partnerships],
    ),
    db().query(
      `SELECT ar.id,ar.account_id AS "accountId",a.name,ar.kind,ar.scope_type AS "scopeType",ar.scope_id AS "scopeId",ar.role,ar.council_seat AS "councilSeat",ar.starts_at AS "startsAt",ar.ends_at AS "endsAt",ar.status,ar.evidence FROM authority_records ar JOIN accounts a ON a.id=ar.account_id WHERE $1::boolean OR ar.account_id=$2 OR ($3::boolean AND ar.scope_type='body' AND ar.scope_id=ANY($4::text[])) ORDER BY ar.created_at DESC LIMIT 1000`,
      [p.admin || p.membership, actor.id, p.cw, bodyIds],
    ),
    db().query(
      taskSelect + ' WHERE t.body_id=ANY($1::text[]) ORDER BY t.due_at NULLS LAST LIMIT 500',
      [p.cw ? bodyIds : []],
    ),
    db().query(
      DECISION_VIEW_SELECT +
        ' WHERE ' +
        BODY_ID_SQL +
        ' = ANY($1::text[]) ORDER BY dp.updated_at DESC LIMIT 500',
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
  for (const a of records.rows)
    if (a.status === 'active' && a.endsAt && new Date(a.endsAt).getTime() < horizon)
      notices.push({
        kind: 'handover',
        title: `${a.name}: ${a.role} in ${a.scopeId}`,
        dueAt: a.endsAt,
      })
  for (const t of tasks.rows)
    if (t.status !== 'done' && t.dueAt && new Date(t.dueAt).getTime() < horizon)
      notices.push({ kind: 'task', title: t.title, dueAt: t.dueAt })
  for (const d of decisions.rows)
    if (d.deadlineAt && !['adopted', 'not_adopted', 'withdrawn'].includes(d.stage))
      notices.push({
        kind: 'decision',
        title: `${d.title}: ${d.stage}`,
        dueAt: d.deadlineAt,
      })
  for (const b of bodies.rows)
    if (p.manages(b.id) && b.reviewDueAt && new Date(b.reviewDueAt).getTime() < horizon)
      notices.push({
        kind: 'review',
        title: `Review public information: ${b.name}`,
        dueAt: b.reviewDueAt,
      })
  return {
    bodies: bodies.rows.map((b: Body) => ({
      ...b,
      description: p.admin || p.participates(b.id) ? b.description : '',
      publicSummary: p.admin || p.publisher || p.participates(b.id) ? b.publicSummary : '',
      canManage: p.manages(b.id),
      canParticipate: p.participates(b.id),
    })),
    people: people.rows,
    records: records.rows,
    tasks: tasks.rows.map((t: Task & { createdBy: string }) => ({
      ...t,
      canEdit: p.manages(t.bodyId) || t.ownerId === actor.id || t.createdBy === actor.id,
    })),
    decisions: decisions.rows,
    enquiries: enquiries.rows,
    canAdminister: p.admin,
    canReviewMembership: p.membership,
    canManagePartnerships: p.partnerships,
    canPublish: p.publisher,
    notices: notices.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()),
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
      const body = (await client.query('SELECT kind FROM platform_bodies WHERE id=$1', [id]))
        .rows[0]
      if (!body || body.kind !== input.kind)
        fail(403, 'Only an administrator can change the type of a body.')
    }
    const name = text(input, 'name'),
      kind = text(input, 'kind'),
      description = text(input, 'description', 5000, false),
      summary = text(input, 'publicSummary', 3000, false)
    if (!BODY_KINDS.includes(kind as (typeof BODY_KINDS)[number])) fail(400, 'Choose a body type.')
    const slug = id || text(input, 'id', 80)
    if (!/^[a-z][a-z0-9-]{1,79}$/.test(slug))
      fail(400, 'Use a short lowercase identifier with hyphens.')
    const values = [slug, name, kind, description, summary, date(input, 'reviewDueAt'), actor.id]
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
      fail(409, 'The body changed or this identifier already exists. Reload first.')
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
      fail(409, 'A different publisher must review the current, non-empty public summary.')
    await audit(client, actor, 'body.published', id, 'Reviewed public information')
  })
}
// Scope/role vocabularies for recording mandates and participation. Every
// record lands in `authority_records`; `recordKind` decides whether the
// tuple is a mandate or member-joinable participation.
const BODY_MANDATE_ROLES = ['coordinator', 'contact_point', 'liaison', 'council_representative']
const TEAM_SCOPE_IDS = [
  'membership_team',
  'selection_team',
  'election_facilitation',
  'awareness_team',
  'safeguarding_team',
  'finance_team',
  'partnerships_team',
  'partnerships',
  'comms_team',
  'reforms_team',
  'data_controller',
  'gys_policy_team',
  'content_editor',
  'content_publisher',
  'gct',
  'lcoy_liaison',
  'rcoy_liaison',
  'gcoy_liaison',
]
const GCT_AREAS = [
  'coordinator',
  'partnerships',
  'membership',
  'finance',
  'internal',
  'coordination',
]

export async function assign(actor: Actor, input: Input) {
  return transaction(async (client) => {
    const accountId = intId(input.accountId)
    // The shared advisory locks come FIRST in the lock order — before
    // permissions()' FOR SHARE reads on the actor's own rows — so no
    // writer ever waits on a row lock while holding an authority lock.
    // Self-targeting (actor === target) collapses to a single key.
    await lockAuthority(client, intId(actor.id), accountId)
    const p = await permissions(actor, client)
    if (!p.admin) fail(403, 'Only platform administrators can record an evidenced assignment.')
    // Accept both spellings; canonicalise to 'organisation' — the stored
    // enum and registry vocabulary.
    const scopeType = normaliseScopeType(text(input, 'scopeType')),
      scopeId = text(input, 'scopeId'),
      role = text(input, 'role'),
      evidence = text(input, 'evidence', 2000)
    if (
      !['body', 'team', 'working_group', 'organisation', 'operational_team', 'event'].includes(
        scopeType,
      )
    )
      fail(400, 'Choose body, team, working group, organisation, operational team or event.')
    const valid =
      scopeType === 'body'
        ? ['member', ...BODY_MANDATE_ROLES]
        : scopeType === 'working_group'
          ? ['member', 'contact']
          : scopeType === 'team'
            ? scopeId === 'gct'
              ? GCT_AREAS
              : ['member']
            : scopeType === 'operational_team'
              ? ['member', 'liaison']
              : scopeType === 'organisation'
                ? ['member', 'representative', 'admin']
                : ['member', 'coordinator'] // event → cct
    if (!valid.includes(role)) fail(400, 'Invalid role for this scope.')
    if (scopeType === 'team' && !TEAM_SCOPE_IDS.includes(scopeId))
      fail(400, 'Unknown team responsibility.')
    if (scopeType === 'body') {
      const { rows: bodies } = await client.query('SELECT kind FROM platform_bodies WHERE id=$1', [
        scopeId,
      ])
      if (!bodies.length) fail(400, 'Choose an existing body.')
      if (!bodyRoles(bodies[0].kind).includes(role))
        fail(400, 'Choose a documented responsibility for this type of body.')
    }
    if (scopeType === 'working_group') {
      const exists = await client.query('SELECT 1 FROM working_groups WHERE slug=$1', [scopeId])
      if (!exists.rowCount) fail(400, 'Choose an existing working group.')
    }
    const startsAt = date(input, 'startsAt', true),
      endsAt = date(input, 'endsAt', true)
    if (Date.parse(endsAt!) <= Date.parse(startsAt!)) fail(400, 'The end must follow the start.')
    const eligible = await client.query(
      `SELECT 1 FROM accounts WHERE id=$1 AND entity_type='individual' AND hub_access_status='active' AND membership_track='constituency_work' AND constituency_work_status='active' AND membership_status IN ('active','renewal_due')`,
      [accountId],
    )
    if (!eligible.rowCount) fail(409, 'This person must have active Constituency Work membership.')

    const resolvedRole =
      scopeType === 'working_group'
        ? role === 'contact'
          ? 'wg.contact_point'
          : 'wg.member'
        : resolveLegacyRole(scopeType, scopeId, role)
    if (!resolvedRole) fail(400, 'Unknown role for this scope.')

    // One store for mandates and participation. The partial unique index
    // keeps a single active row per (account, role, scope); re-recording an
    // active record refreshes term and evidence. The advisory lock taken at
    // the top of this transaction serialises the insert against every other
    // authority write on the account.
    const councilSeat = councilSeatFor(resolvedRole, { scopeId, councilSeat: null })
    const { rows } = await client.query(
      `INSERT INTO authority_records(account_id,kind,role,scope_type,scope_id,council_seat,starts_at,ends_at,evidence,recorded_by_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (account_id,role,scope_type,scope_id) WHERE status='active'
       DO UPDATE SET starts_at=$7,ends_at=$8,evidence=$9,recorded_by_id=$10,updated_at=now()
       RETURNING id`,
      [
        accountId,
        recordKind(scopeType, role),
        resolvedRole,
        scopeType,
        scopeId,
        councilSeat,
        startsAt,
        endsAt,
        evidence,
        actor.id,
      ],
    )
    await audit(client, actor, 'authority.recorded', String(rows[0].id), evidence, {
      accountId,
      role: resolvedRole,
      scopeType,
      scopeId,
      startsAt,
      endsAt,
    })
  })
}
export async function revoke(actor: Actor, id: string, reason: string) {
  return transaction(async (client) => {
    if (reason.length < 8) fail(400, 'Give a reason for ending this record.')
    // Resolve the target account and take the shared advisory locks BEFORE
    // permissions()' FOR SHARE reads — the lock order (advisory → row
    // locks → writes) is what keeps concurrent and self-targeting writes
    // deadlock-free.
    const target = await client.query('SELECT account_id FROM authority_records WHERE id=$1', [
      intId(id),
    ])
    if (!target.rowCount) fail(404, 'Authority record not found.')
    await lockAuthority(client, intId(actor.id), intId(target.rows[0].account_id))
    if (!(await permissions(actor, client)).admin)
      fail(403, 'Platform administrator access required.')
    const result = await client.query(
      `UPDATE authority_records SET status='revoked',ends_at=now(),updated_at=now() WHERE id=$1 AND status='active' RETURNING account_id`,
      [intId(id)],
    )
    if (!result.rowCount) fail(404, 'Authority record not found or already ended.')
    await audit(client, actor, 'authority.revoked', id, reason)
  })
}
export async function joinBody(actor: Actor, id: string) {
  return transaction(async (client) => {
    if (!(await permissions(actor, client)).cw)
      fail(403, 'Active Constituency Work membership is required.')
    if (
      !(
        await client.query("SELECT 1 FROM platform_bodies WHERE id=$1 AND kind='working_group'", [
          id,
        ])
      ).rowCount
    )
      fail(403, 'This body requires an assigned or screened membership.')
    await client.query(
      `INSERT INTO authority_records(account_id,kind,role,scope_type,scope_id) VALUES($1,'participation','body.member','body',$2) ON CONFLICT(account_id,role,scope_type,scope_id) WHERE status='active' DO UPDATE SET starts_at=now(),ends_at=NULL,updated_at=now()`,
      [actor.id, id],
    )
    await audit(client, actor, 'body.joined', id, 'Member joined an open working group')
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
          `SELECT 1 FROM authority_records ar JOIN accounts a ON a.id=ar.account_id WHERE ar.account_id=$1 AND ar.scope_type='body' AND ar.scope_id=$2 AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now()) AND a.membership_track='constituency_work' AND a.constituency_work_status='active' AND a.hub_access_status='active' AND a.membership_status IN ('active','renewal_due')`,
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
    if (!['open', 'in_progress', 'done'].includes(status)) fail(400, 'Choose a task status.')
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
    if (!result.rowCount) fail(409, 'Task changed, or you are not its owner/coordinator.')
    await audit(client, actor, 'task.saved', result.rows[0].id, status)
    return result.rows[0]
  })
}

export async function createEnquiry(input: Input) {
  if (input.consent !== true) fail(400, 'Consent to using these details to respond is required.')
  if (input.websiteTrap) return { ok: true }
  const email = text(input, 'email', 254)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.')
  const { rows } = await db().query(
    `INSERT INTO platform_enquiries(organisation,contact_name,email,message,privacy_version) VALUES($1,$2,$3,$4,'partner-enquiry-2026-09') RETURNING id`,
    [text(input, 'organisation'), text(input, 'contactName'), email, text(input, 'message', 5000)],
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
          `SELECT 1 FROM authority_records ar JOIN accounts a ON a.id=ar.account_id WHERE ar.account_id=$1 AND ar.scope_type='team' AND ar.role='team.partnerships' AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now()) AND a.membership_track='constituency_work' AND a.constituency_work_status='active' AND a.hub_access_status='active' AND a.membership_status IN ('active','renewal_due')`,
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
      `SELECT COALESCE(pd.id::text, dp.id::text) AS id, dp.title, dp.proposal_text AS proposal, dp.result_summary AS outcome, dp.policy_version AS "policyVersion", dp.decided_at AS "decidedAt" FROM decision_proposals dp LEFT JOIN platform_decisions pd ON pd.s09_proposal_id = dp.id WHERE dp.is_public = true AND dp.status = 'adopted' ORDER BY dp.decided_at DESC LIMIT 200`,
    ),
    db().query(
      "SELECT e.id,e.organisation,e.public_summary AS summary,e.website FROM platform_enquiries e JOIN platform_decisions d ON d.id=e.decision_id WHERE e.status='approved' AND d.is_public=true AND d.stage='adopted' ORDER BY e.organisation",
    ),
  ])
  return {
    bodies: bodies.rows.map((r: { public_snapshot: Record<string, unknown> }) => r.public_snapshot),
    decisions: decisions.rows,
    partners: partners.rows,
  }
}

export async function membershipAction(actor: Actor, id: string, input: Input) {
  return transaction(async (client) => {
    // Lifecycle writes touch the TARGET account's rows; permissions()
    // FOR SHAREs the actor's. Lock both accounts first, per the shared
    // lock order — an expiry racing a grant on the same account must
    // serialise, never deadlock.
    await lockAuthority(client, intId(actor.id), intId(id))
    if (!(await permissions(actor, client)).membership)
      fail(403, 'An active Membership Team assignment is required.')
    const action = text(input, 'action'),
      reason = text(input, 'reason', 2000),
      renewalDueAt = date(input, 'renewalDueAt')
    if (reason.length < 8) fail(400, 'Record the onboarding or renewal evidence.')
    const { rows } = await client.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE', [
        intId(id),
      ]),
      member = rows[0]
    if (!member || member.entity_type !== 'individual') fail(404, 'Individual member not found.')
    if (
      member.hub_access_status === 'suspended' ||
      ['expired', 'terminated'].includes(member.membership_status)
    )
      fail(409, 'Resolve the account suspension through the authorised membership process first.')
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
        fail(409, 'Renew a current Constituency Work membership and set its next renewal date.')
      await client.query(
        "UPDATE accounts SET membership_status='active',renewal_due_at=$2 WHERE id=$1",
        [id, renewalDueAt],
      )
    } else if (action === 'expire_cw') {
      if (member.membership_track !== 'constituency_work')
        fail(409, 'This person is already a Network member.')
      await client.query(
        `UPDATE accounts SET membership_track='network',constituency_work_status=NULL,membership_status='active',hub_access_status='active',renewal_due_at=NULL,role=CASE WHEN role IN ('wg_contact','focal_point') THEN 'member' ELSE role END WHERE id=$1`,
        [id],
      )
      // Every authority record — mandate or participation — ends with the
      // membership it derives from (S17).
      await client.query(
        "UPDATE authority_records SET status='expired',ends_at=now(),updated_at=now() WHERE account_id=$1 AND status='active'",
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
    if (kind !== 'body') fail(400, 'Decision publication is handled by the decision engine bridge.')
    const result = await client.query(
      'UPDATE platform_bodies SET public_snapshot=NULL,published_version=NULL,published_by=NULL WHERE id=$1 AND version=$2 RETURNING id',
      [id, input.version],
    )
    if (!result.rowCount) fail(409, 'The record changed. Reload first.')
    await audit(client, actor, `${kind}.publication_withdrawn`, id, reason)
  })
}
