// who currently holds a role in a scope, by the same rules that grant its
// permissions: a current authority record, plus active constituency work
// where the role requires it. the directory reads this instead of storing names
import { AUTHORITY_ROLES, recordCurrent, resolveRecordRole } from './authority'
import { isCwActive } from './accountStatus'
import { getPgPool } from './pg'

export interface RoleTarget {
  role: string
  scopeId: string
}

export interface RoleHolder {
  id: number
  displayName: string
}

export const holderKey = ({ role, scopeId }: RoleTarget) => `${role}@${scopeId}`

export async function holdersFor(targets: RoleTarget[]): Promise<Map<string, RoleHolder[]>> {
  const holders = new Map<string, RoleHolder[]>()
  const pool = getPgPool()
  if (!pool || !targets.length) return holders
  const wanted = new Set(targets.map(holderKey))
  const { rows } = await pool.query(
    `SELECT ar.role, ar.scope_type, ar.scope_id, ar.status, ar.starts_at, ar.ends_at,
            a.id, a.membership_track, a.constituency_work_status, a.membership_status,
            a.hub_access_status, COALESCE(NULLIF(p.display_name, ''), a.name) AS display_name
       FROM authority_records ar
       JOIN accounts a ON a.id = ar.account_id
       LEFT JOIN member_profiles p ON p.account_id = a.id
      WHERE ar.scope_id = ANY($1)
      ORDER BY display_name`,
    [[...new Set(targets.map((target) => target.scopeId))]],
  )
  for (const row of rows) {
    const record = {
      role: row.role,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    }
    if (!recordCurrent(record)) continue
    // legacy rows store old role names; resolve them like deriveAuthority does
    const role = resolveRecordRole(record)
    if (!role) continue
    const key = holderKey({ role, scopeId: row.scope_id })
    if (!wanted.has(key)) continue
    if (AUTHORITY_ROLES[role]?.requiresCw && !isCwActive(row)) continue
    const list = holders.get(key) ?? []
    if (!list.some((holder) => holder.id === row.id)) {
      list.push({ id: row.id, displayName: row.display_name })
    }
    holders.set(key, list)
  }
  return holders
}
