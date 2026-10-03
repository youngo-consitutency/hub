import { accountView } from './accounts'
import { requirePgPool } from './pg'
import { MEMBERSHIP_STATUSES } from './membership'
import { AUTHORITY_ROLES } from './authority'
import type { Doc } from './domain'

// Admin account surface: sortable account lists filtered by status or
// authority-record role.

// Ports of server/lib/lifecycle.js queryAccountsForAdmin/listAccountsForAdmin.

const ACCOUNT_SORTS: Record<string, string> = {
  newest: 'created_at DESC',
  oldest: 'created_at ASC',
  name: 'name ASC, email ASC',
  recent_login: 'last_login_at DESC NULLS LAST, created_at DESC',
}

const ADMIN_COLUMNS = `id, email, name, first_name, last_name, entity_type,
  organization_name, organization_type, is_unfccc_admitted, member_status, role,
  (SELECT COALESCE(jsonb_agg(DISTINCT ar.scope_id), '[]'::jsonb) FROM authority_records ar WHERE ar.account_id=accounts.id AND ar.scope_type='team' AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now())) AS team_roles, region, country, nationality, wg_interests, course_passed_at,
  course_score, verified_at, membership_track, constituency_work_status,
  hub_access_status, membership_status, onboarding_cohort, renewal_due_at,
  membership_ended_at, membership_end_reason, created_at, last_login_at, phone,
  email_verified_at`

export async function listAccountsForAdmin() {
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `SELECT ${ADMIN_COLUMNS} FROM accounts ORDER BY created_at DESC LIMIT 500`,
  )
  return rows.map(accountView)
}

export async function queryAccountsForAdmin({
  search = '',
  entityType = '',
  status = '',
  role = '',
  sort = 'newest',
  page = 1,
  pageSize = 12,
}: any = {}) {
  const cleanSearch = String(search).trim().slice(0, 120)
  const cleanEntityType = ['individual', 'organization'].includes(entityType) ? entityType : ''
  const cleanStatus = MEMBERSHIP_STATUSES.includes(status) ? status : ''
  // The role filter matches active authority records, not an account flag.
  const cleanRole = role === 'member' || AUTHORITY_ROLES[role] ? String(role) : ''
  const cleanSort = ACCOUNT_SORTS[sort] ? sort : 'newest'
  const cleanPage = Math.min(100_000, Math.max(1, Number.parseInt(page, 10) || 1))
  const cleanPageSize = Math.min(50, Math.max(1, Number.parseInt(pageSize, 10) || 12))
  const pool = requirePgPool()
  const values: Doc[] = []
  const where: string[] = []
  const add = (clause: string, value: any) => {
    values.push(value)
    where.push(clause.replace('?', `$${values.length}`))
  }
  if (cleanSearch)
    add(`concat_ws(' ', name, email, organization_name, country) ILIKE ?`, `%${cleanSearch}%`)
  if (cleanEntityType) add('entity_type = ?', cleanEntityType)
  if (cleanStatus) add('membership_status = ?', cleanStatus)
  if (cleanRole === 'member')
    where.push(
      `NOT EXISTS (SELECT 1 FROM authority_records ar WHERE ar.account_id=accounts.id AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now()))`,
    )
  else if (cleanRole)
    add(
      `EXISTS (SELECT 1 FROM authority_records ar WHERE ar.account_id=accounts.id AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now()) AND ar.role = ?)`,
      cleanRole,
    )
  const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const count = await pool.query(`SELECT count(*)::int AS total FROM accounts ${filter}`, values)
  const total = count.rows[0]?.total || 0
  const pages = Math.max(1, Math.ceil(total / cleanPageSize))
  const currentPage = Math.min(cleanPage, pages)
  const limitIndex = values.length + 1
  const offsetIndex = values.length + 2
  const { rows } = await pool.query(
    `SELECT ${ADMIN_COLUMNS} FROM accounts
     ${filter}
     ORDER BY ${ACCOUNT_SORTS[cleanSort]}
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    [...values, cleanPageSize, (currentPage - 1) * cleanPageSize],
  )
  return {
    items: rows.map(accountView),
    total,
    page: currentPage,
    pageSize: cleanPageSize,
    pages,
  }
}

// Organisation ownership lives in authority_records (org-scope records) and
// ngo_seats — there is no account-level shortcut to maintain here.
