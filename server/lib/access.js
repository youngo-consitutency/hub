import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data',
)
const readJson = (name) => {
  try {
    const file = path.join(dataDir, name)
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
  } catch {
    return []
  }
}

export async function getAccessProfile(account) {
  if (!account)
    return {
      teamRoles: [],
      wgAssignments: [],
      negotiationAssignments: [],
      capabilities: [],
      manageAllWgs: false,
    }
  const pool = getPool()
  const teamRoles = new Set(pool ? [] : account.teamRoles || [])
  const wgAssignments = []
  const negotiationAssignments = [...(account.negotiationAssignments || [])]
  if (pool) {
    const { rows } = await pool.query(
      `SELECT scope_type, scope_id, role FROM account_assignments
       WHERE account_id=$1 AND status='active' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())`,
      [account.id],
    )
    for (const row of rows) {
      if (row.scope_type === 'team') teamRoles.add(row.scope_id)
      if (row.scope_type === 'working_group')
        wgAssignments.push({ wgSlug: row.scope_id, role: row.role })
      if (['negotiation_track', 'negotiation_project'].includes(row.scope_type))
        negotiationAssignments.push({
          scopeType: row.scope_type,
          scopeId: row.scope_id,
          role: row.role,
        })
    }
  } else {
    for (const row of readJson('wg-progress.json')) {
      if (
        row.account_id === account.id &&
        row.status === 'active' &&
        ['contact', 'lead'].includes(row.role_in_wg)
      )
        wgAssignments.push({ wgSlug: row.wg_slug, role: row.role_in_wg })
    }
  }
  if (!pool && account.role === 'wg_contact')
    for (const wgSlug of account.wgInterests || [])
      if (!wgAssignments.some((item) => item.wgSlug === wgSlug))
        wgAssignments.push({ wgSlug, role: 'contact' })
  if (!pool && account.role === 'admin') {
    teamRoles.add('membership_team')
    teamRoles.add('gys_policy_team')
  }
  const capabilities = new Set([
    'hub.read',
    'intelligence.query',
    'intelligence.writeback.propose',
  ])
  if (account.role === 'admin')
    [
      'platform.manage',
      'accounts.manage',
      'audit.read',
      'ngo.manage_all',
      'points.award',
      'content.draft',
      'content.review',
      'content.publish',
      'intelligence.operations.read',
      'intelligence.writeback.approve',
      'intelligence.writeback.apply',
      'notifications.send',
    ].forEach((x) => capabilities.add(x))
  if (account.role === 'focal_point') {
    capabilities.add('constituency.coordinate')
    capabilities.add('points.award')
  }
  if (teamRoles.has('membership_team')) {
    capabilities.add('membership.review')
    capabilities.add('points.award')
  }
  if (teamRoles.has('gys_policy_team')) {
    capabilities.add('gys.manage')
  }
  if (teamRoles.has('content_editor')) capabilities.add('content.draft')
  if (teamRoles.has('content_publisher')) {
    capabilities.add('content.review')
    capabilities.add('content.publish')
  }
  if (
    ['admin', 'focal_point', 'wg_contact', 'ngo_admin'].includes(
      account.role,
    ) ||
    wgAssignments.length ||
    teamRoles.has('membership_team') ||
    teamRoles.has('gys_policy_team')
  )
    capabilities.add('intelligence.contacts.read')
  for (const item of wgAssignments) capabilities.add(`wg.manage:${item.wgSlug}`)
  for (const item of negotiationAssignments) {
    const scope = `${item.scopeType}:${item.scopeId}`
    capabilities.add(`negotiations.read:${scope}`)
    if (item.role === 'reviewer') {
      capabilities.add(`negotiations.evidence.review:${scope}`)
      capabilities.add(`negotiations.candidates.review:${scope}`)
    }
    if (item.role === 'applier')
      capabilities.add(`negotiations.candidates.apply:${scope}`)
    if (item.role === 'grant_manager')
      capabilities.add(`negotiations.grants.manage:${scope}`)
    if (item.role === 'process_facilitator')
      capabilities.add(`negotiations.process.record:${scope}`)
    if (item.role === 'transmitter')
      capabilities.add(`negotiations.transmission.record:${scope}`)
  }
  return {
    teamRoles: [...teamRoles],
    wgAssignments,
    negotiationAssignments,
    capabilities: [...capabilities],
    manageAllWgs: account.role === 'admin',
    isFocalPoint: account.role === 'focal_point',
    isMandateHolder: capabilities.has('intelligence.contacts.read'),
  }
}

export function hasCapability(access, capability) {
  return Boolean(access?.capabilities?.includes(capability))
}
export async function canManageWg(account, wgSlug) {
  const access = await getAccessProfile(account)
  return access.manageAllWgs || hasCapability(access, `wg.manage:${wgSlug}`)
}

export async function setTeamAssignment({
  accountId,
  teamRole,
  enabled,
  assignedBy,
}) {
  const pool = getPool()
  if (!pool) return
  if (enabled) {
    await pool.query(
      `INSERT INTO account_assignments(account_id,scope_type,scope_id,role,status,assigned_by)
       VALUES($1,'team',$2,'member','active',$3)
       ON CONFLICT(account_id,scope_type,scope_id,role)
       DO UPDATE SET status='active', ends_at=NULL, assigned_by=EXCLUDED.assigned_by, updated_at=now()`,
      [accountId, teamRole, assignedBy || null],
    )
  } else {
    await pool.query(
      `UPDATE account_assignments SET status='inactive', ends_at=now(), updated_at=now()
       WHERE account_id=$1 AND scope_type='team' AND scope_id=$2`,
      [accountId, teamRole],
    )
  }
}

export async function syncWgAssignment({
  accountId,
  wgSlug,
  role,
  status,
  assignedBy,
}) {
  const pool = getPool()
  if (!pool) return
  if (status === 'active' && ['contact', 'lead'].includes(role)) {
    await pool.query(
      `WITH deactivated AS (
         UPDATE account_assignments
         SET status='inactive', ends_at=now(), updated_at=now()
         WHERE account_id=$1 AND scope_type='working_group' AND scope_id=$2
           AND role <> $3 AND status='active'
       )
       INSERT INTO account_assignments(account_id,scope_type,scope_id,role,status,assigned_by)
       VALUES($1,'working_group',$2,$3,'active',$4)
       ON CONFLICT(account_id,scope_type,scope_id,role)
       DO UPDATE SET status='active', ends_at=NULL, assigned_by=EXCLUDED.assigned_by, updated_at=now()`,
      [accountId, wgSlug, role, assignedBy || null],
    )
  } else {
    await pool.query(
      `UPDATE account_assignments SET status='inactive', ends_at=now(), updated_at=now()
       WHERE account_id=$1 AND scope_type='working_group' AND scope_id=$2`,
      [accountId, wgSlug],
    )
  }
}
