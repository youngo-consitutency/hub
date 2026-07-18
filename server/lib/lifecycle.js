import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { getPool } from './db.js'
import { publicAccount, findAccountByEmail, findAccountById } from './accounts.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../data')
const accountsPath = path.join(dataDir, 'hub-accounts.json')
const progressPath = path.join(dataDir, 'wg-progress.json')
const activitiesPath = path.join(dataDir, 'wg-activities.json')
const requestsPath = path.join(dataDir, 'ngo-requests.json')

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch { /* empty */ }
  return fallback
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/** Promote configured admin emails on login/me if needed. */
export async function ensureAdminRole(account) {
  if (!account) return account
  const emails = adminEmails()
  if (!emails.includes(String(account.email).toLowerCase())) return account
  if (account.role === 'admin') return account
  return setAccountFields(account.id, { role: 'admin', member_status: 'verified', verified_at: new Date().toISOString(), verified_by: 'admin_email' })
}

export async function setAccountFields(id, fields) {
  const pool = getPool()
  if (pool) {
    const sets = []
    const vals = []
    let i = 1
    for (const [k, v] of Object.entries(fields)) {
      sets.push(`${k} = $${i++}`)
      vals.push(v)
    }
    vals.push(id)
    const { rows } = await pool.query(
      `UPDATE hub_accounts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    )
    return publicAccount(rows[0])
  }
  const list = readJson(accountsPath, [])
  const idx = list.findIndex((a) => a.id === id)
  if (idx < 0) return null
  Object.assign(list[idx], fields)
  writeJson(accountsPath, list)
  return publicAccount(list[idx])
}

export async function completeCourse(accountId, { score }) {
  const now = new Date().toISOString()
  const account = await findAccountById(accountId)
  const membershipStatus = account?.membershipTrack === 'constituency_work' ? 'awaiting_onboarding' : 'course_passed'
  return setAccountFields(accountId, {
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: membershipStatus,
    course_passed_at: now,
    course_score: score,
    verified_at: now,
    verified_by: 'course',
  })
}

export async function listAccountsForAdmin() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT id, email, name, first_name, last_name, entity_type, organization_name,
              organization_type, is_unfccc_admitted, member_status, role, team_roles, region, country,
              nationality, wg_interests, course_passed_at, course_score, verified_at,
              membership_track, constituency_work_status, hub_access_status, membership_status,
              onboarding_cohort, renewal_due_at, membership_ended_at, membership_end_reason,
              created_at, last_login_at, phone
       FROM hub_accounts
       ORDER BY created_at DESC
       LIMIT 500`
    )
    return rows.map((r) => publicAccount(r))
  }
  return readJson(accountsPath, []).map(publicAccount)
}

export async function getWgProgress(accountId, wgSlug) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM wg_workspace_progress WHERE account_id = $1 AND wg_slug = $2',
      [accountId, wgSlug]
    )
    return rows[0] || null
  }
  return readJson(progressPath, []).find((p) => p.account_id === accountId && p.wg_slug === wgSlug) || null
}

export async function listMyWgProgress(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM wg_workspace_progress WHERE account_id = $1 ORDER BY joined_at DESC',
      [accountId]
    )
    return rows
  }
  return readJson(progressPath, []).filter((p) => p.account_id === accountId)
}

export async function upsertWgProgress(accountId, wgSlug, patch) {
  const pool = getPool()
  if (pool) {
    const existing = await getWgProgress(accountId, wgSlug)
    if (!existing) {
      const presentation = Boolean(patch.presentation_ok)
      const rules = Boolean(patch.rules_ok)
      const unlocked = presentation && rules ? new Date().toISOString() : null
      const status = presentation && rules ? (patch.status || 'active') : (patch.status || 'interested')
      const { rows } = await pool.query(
        `INSERT INTO wg_workspace_progress (account_id, wg_slug, presentation_ok, rules_ok, unlocked_at, status, role_in_wg)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          accountId, wgSlug,
          presentation, rules, unlocked, status, patch.role_in_wg || 'member',
        ]
      )
      return rows[0]
    }
    const presentation = patch.presentation_ok ?? existing.presentation_ok
    const rules = patch.rules_ok ?? existing.rules_ok
    const unlocked = presentation && rules ? (existing.unlocked_at || new Date().toISOString()) : existing.unlocked_at
    const status = presentation && rules ? (patch.status || 'active') : (patch.status || existing.status)
    const { rows } = await pool.query(
      `UPDATE wg_workspace_progress SET
        presentation_ok = $3, rules_ok = $4, unlocked_at = $5, status = $6,
        role_in_wg = COALESCE($7, role_in_wg)
       WHERE account_id = $1 AND wg_slug = $2 RETURNING *`,
      [accountId, wgSlug, presentation, rules, unlocked, status, patch.role_in_wg || null]
    )
    return rows[0]
  }
  const list = readJson(progressPath, [])
  let row = list.find((p) => p.account_id === accountId && p.wg_slug === wgSlug)
  if (!row) {
    row = {
      account_id: accountId, wg_slug: wgSlug,
      presentation_ok: false, rules_ok: false, unlocked_at: null,
      joined_at: new Date().toISOString(), role_in_wg: 'member', status: 'interested',
    }
    list.push(row)
  }
  Object.assign(row, patch)
  if (row.presentation_ok && row.rules_ok) {
    row.unlocked_at = row.unlocked_at || new Date().toISOString()
    row.status = row.status === 'interested' ? 'active' : row.status
  }
  writeJson(progressPath, list)
  return row
}

export async function listWgJoiners(wgSlug) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT p.*, a.name, a.email, a.member_status, a.wg_interests
       FROM wg_workspace_progress p
       JOIN hub_accounts a ON a.id = p.account_id
       WHERE p.wg_slug = $1
       ORDER BY p.joined_at DESC
       LIMIT 100`,
      [wgSlug]
    )
    return rows
  }
  const progress = readJson(progressPath, []).filter((p) => p.wg_slug === wgSlug)
  const accounts = readJson(accountsPath, [])
  return progress.map((p) => {
    const a = accounts.find((x) => x.id === p.account_id) || {}
    return { ...p, name: a.name, email: a.email, member_status: a.member_status }
  })
}

export async function addWgActivity(activity) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO wg_activities (wg_slug, kind, title, body, starts_at, ends_at, url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        activity.wgSlug, activity.kind, activity.title, activity.body || null,
        activity.startsAt || null, activity.endsAt || null, activity.url || null, activity.createdBy,
      ]
    )
    return rows[0]
  }
  const row = {
    id: randomUUID(),
    wg_slug: activity.wgSlug,
    kind: activity.kind,
    title: activity.title,
    body: activity.body || null,
    starts_at: activity.startsAt || null,
    ends_at: activity.endsAt || null,
    url: activity.url || null,
    created_by: activity.createdBy,
    created_at: new Date().toISOString(),
  }
  const list = readJson(activitiesPath, [])
  list.unshift(row)
  writeJson(activitiesPath, list)
  return row
}

export async function listWgActivities(wgSlug) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM wg_activities WHERE wg_slug = $1 ORDER BY created_at DESC LIMIT 50',
      [wgSlug]
    )
    return rows
  }
  return readJson(activitiesPath, []).filter((a) => a.wg_slug === wgSlug).slice(0, 50)
}

export async function listNgoRequests(orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM ngo_requests WHERE org_account_id = $1 ORDER BY created_at DESC LIMIT 100',
      [orgAccountId]
    )
    return rows
  }
  return readJson(requestsPath, []).filter((r) => r.org_account_id === orgAccountId)
}

export async function addNgoRequest(req) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO ngo_requests (org_account_id, kind, title, body, deadline_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.orgAccountId, req.kind, req.title, req.body || null, req.deadlineAt || null, req.createdBy]
    )
    return rows[0]
  }
  const row = {
    id: randomUUID(),
    org_account_id: req.orgAccountId,
    kind: req.kind,
    title: req.title,
    body: req.body || null,
    deadline_at: req.deadlineAt || null,
    status: 'open',
    created_by: req.createdBy,
    created_at: new Date().toISOString(),
  }
  const list = readJson(requestsPath, [])
  list.unshift(row)
  writeJson(requestsPath, list)
  return row
}

export async function updateNgoRequestStatus(id, status, orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'UPDATE ngo_requests SET status = $1 WHERE id = $2 AND org_account_id = $3 RETURNING *',
      [status, id, orgAccountId]
    )
    return rows[0] || null
  }
  const list = readJson(requestsPath, [])
  const row = list.find((r) => r.id === id && r.org_account_id === orgAccountId)
  if (!row) return null
  row.status = status
  writeJson(requestsPath, list)
  return row
}

const seatsPath = path.join(dataDir, 'ngo-seats.json')

function publicSeat(row) {
  if (!row) return null
  return {
    id: row.id,
    orgAccountId: row.org_account_id ?? row.orgAccountId,
    memberAccountId: row.member_account_id ?? row.memberAccountId ?? null,
    email: row.email,
    name: row.name || null,
    seatRole: row.seat_role ?? row.seatRole,
    status: row.status,
    inviteExpiresAt: row.invite_expires_at ?? row.inviteExpiresAt ?? null,
    createdAt: row.created_at ?? row.createdAt,
    acceptedAt: row.accepted_at ?? row.acceptedAt ?? null,
  }
}

/** Resolve organization scope and seat-level permissions. */
export async function resolveOrgContext(account, requestedOrgId = null) {
  if (!account) return null
  if (account.role === 'admin') {
    if (!requestedOrgId) return null
    return { orgAccountId: String(requestedOrgId), seatRole: 'admin', canManageRequests: true, canManageSeats: true }
  }
  if (account.entityType === 'organization') {
    return { orgAccountId: account.id, seatRole: 'owner', canManageRequests: true, canManageSeats: true }
  }
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT org_account_id, seat_role FROM ngo_seats
       WHERE member_account_id = $1 AND status = 'active'
       ORDER BY accepted_at DESC NULLS LAST
       LIMIT 1`,
      [account.id]
    )
    if (!rows[0]) return null
    return {
      orgAccountId: rows[0].org_account_id,
      seatRole: rows[0].seat_role,
      canManageRequests: ['owner', 'representative'].includes(rows[0].seat_role),
      canManageSeats: rows[0].seat_role === 'owner',
    }
  }
  const seats = readJson(seatsPath, [])
  const seat = seats.find((s) => s.member_account_id === account.id && s.status === 'active')
  if (!seat) return null
  return {
    orgAccountId: seat.org_account_id,
    seatRole: seat.seat_role,
    canManageRequests: ['owner', 'representative'].includes(seat.seat_role),
    canManageSeats: seat.seat_role === 'owner',
  }
}

export async function resolveOrgAccountId(account) {
  return (await resolveOrgContext(account))?.orgAccountId || null
}

export async function listNgoSeats(orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT s.*, a.name AS member_name, a.email AS member_email
       FROM ngo_seats s
       LEFT JOIN hub_accounts a ON a.id = s.member_account_id
       WHERE s.org_account_id = $1 AND s.status != 'revoked'
       ORDER BY s.created_at ASC`,
      [orgAccountId]
    )
    return rows.map((r) => ({
      ...publicSeat(r),
      memberName: r.member_name || r.name,
      memberEmail: r.member_email || r.email,
    }))
  }
  return readJson(seatsPath, [])
    .filter((s) => s.org_account_id === orgAccountId && s.status !== 'revoked')
    .map(publicSeat)
}

export async function ensureOwnerSeat(orgAccount, client = null) {
  if (!orgAccount || orgAccount.entityType !== 'organization') return null
  const pool = client || getPool()
  if (pool) {
    const existing = await pool.query(
      `SELECT * FROM ngo_seats WHERE org_account_id = $1 AND seat_role = 'owner' LIMIT 1`,
      [orgAccount.id]
    )
    if (existing.rowCount) return publicSeat(existing.rows[0])
    const { rows } = await pool.query(
      `INSERT INTO ngo_seats (org_account_id, member_account_id, email, name, seat_role, status, accepted_at)
       VALUES ($1,$2,$3,$4,'owner','active', now()) RETURNING *`,
      [orgAccount.id, orgAccount.id, orgAccount.email, orgAccount.name]
    )
    return publicSeat(rows[0])
  }
  const list = readJson(seatsPath, [])
  let row = list.find((s) => s.org_account_id === orgAccount.id && s.seat_role === 'owner')
  if (!row) {
    row = {
      id: randomUUID(),
      org_account_id: orgAccount.id,
      member_account_id: orgAccount.id,
      email: orgAccount.email,
      name: orgAccount.name,
      seat_role: 'owner',
      status: 'active',
      invite_token: null,
      created_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    }
    list.push(row)
    writeJson(seatsPath, list)
  }
  return publicSeat(row)
}

export async function inviteNgoSeat({ orgAccountId, email, name, seatRole, invitedBy }) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) {
    const err = new Error('Email is required.')
    err.code = 'validation'
    throw err
  }
  const token = randomUUID().replace(/-/g, '')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const role = ['owner', 'representative', 'viewer'].includes(seatRole) ? seatRole : 'representative'
  const pool = getPool()
  if (pool) {
    // Link if account already exists
    const existingUser = await pool.query(
      'SELECT id, name FROM hub_accounts WHERE lower(email) = lower($1) LIMIT 1',
      [normalized]
    )
    const memberId = existingUser.rows[0]?.id || null
    const memberName = name || existingUser.rows[0]?.name || null
    try {
      const { rows } = await pool.query(
        `INSERT INTO ngo_seats (org_account_id, member_account_id, email, name, seat_role, status, invite_token_hash, invite_expires_at, accepted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (org_account_id, email) DO UPDATE SET
           seat_role = EXCLUDED.seat_role,
           status = CASE WHEN ngo_seats.status = 'revoked' THEN 'invited' ELSE ngo_seats.status END,
           invite_token_hash = CASE WHEN ngo_seats.status = 'active' THEN NULL ELSE EXCLUDED.invite_token_hash END,
           invite_expires_at = CASE WHEN ngo_seats.status = 'active' THEN NULL ELSE EXCLUDED.invite_expires_at END,
           name = COALESCE(EXCLUDED.name, ngo_seats.name),
           member_account_id = COALESCE(ngo_seats.member_account_id, EXCLUDED.member_account_id)
         RETURNING *`,
        [
          orgAccountId, memberId, normalized, memberName, role,
          memberId ? 'active' : 'invited',
          memberId ? null : tokenHash,
          memberId ? null : expiresAt,
          memberId ? new Date().toISOString() : null,
        ]
      )
      return { seat: publicSeat(rows[0]), inviteToken: memberId ? null : token, invitedBy }
    } catch (e) {
      if (e.message?.includes('unique')) {
        const err = new Error('That email already has a seat.')
        err.code = 'duplicate'
        throw err
      }
      throw e
    }
  }
  const list = readJson(seatsPath, [])
  const accounts = readJson(accountsPath, [])
  const user = accounts.find((a) => a.email?.toLowerCase() === normalized)
  let row = list.find((s) => s.org_account_id === orgAccountId && s.email === normalized)
  if (row && row.status !== 'revoked') {
    const err = new Error('That email already has a seat.')
    err.code = 'duplicate'
    throw err
  }
  row = {
    id: randomUUID(),
    org_account_id: orgAccountId,
    member_account_id: user?.id || null,
    email: normalized,
    name: name || user?.name || null,
    seat_role: role,
    status: user ? 'active' : 'invited',
    invite_token_hash: user ? null : tokenHash,
    invite_expires_at: user ? null : expiresAt,
    created_at: new Date().toISOString(),
    accepted_at: user ? new Date().toISOString() : null,
  }
  list.push(row)
  writeJson(seatsPath, list)
  return { seat: publicSeat(row), inviteToken: user ? null : token, invitedBy }
}

export async function acceptNgoInvite(token, account) {
  const tokenHash = createHash('sha256').update(String(token)).digest('hex')
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE ngo_seats SET
         status = 'active',
         member_account_id = $2,
         name = COALESCE(name, $3),
         accepted_at = now(),
         invite_token = NULL,
         invite_token_hash = NULL,
         invite_expires_at = NULL
       WHERE (invite_token_hash = $1 OR invite_token = $4) AND status = 'invited'
         AND (invite_expires_at IS NULL OR invite_expires_at > now())
         AND lower(email) = lower($5)
       RETURNING *`,
      [tokenHash, account.id, account.name, token, account.email]
    )
    if (!rows[0]) return null
    return publicSeat(rows[0])
  }
  const list = readJson(seatsPath, [])
  const row = list.find((s) => (s.invite_token_hash === tokenHash || s.invite_token === token) && s.status === 'invited')
  if (!row) return null
  if (row.invite_expires_at && new Date(row.invite_expires_at) <= new Date()) return null
  if (String(row.email).toLowerCase() !== String(account.email).toLowerCase()) return null
  row.status = 'active'
  row.member_account_id = account.id
  row.name = row.name || account.name
  row.accepted_at = new Date().toISOString()
  row.invite_token = null
  row.invite_token_hash = null
  row.invite_expires_at = null
  writeJson(seatsPath, list)
  return publicSeat(row)
}

export async function revokeNgoSeat(seatId, orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE ngo_seats SET status = 'revoked', invite_token = NULL, invite_token_hash = NULL, invite_expires_at = NULL
       WHERE id = $1 AND org_account_id = $2 AND seat_role != 'owner'
       RETURNING *`,
      [seatId, orgAccountId]
    )
    return publicSeat(rows[0] || null)
  }
  const list = readJson(seatsPath, [])
  const row = list.find((s) => s.id === seatId && s.org_account_id === orgAccountId)
  if (!row || row.seat_role === 'owner') return null
  row.status = 'revoked'
  row.invite_token = null
  row.invite_token_hash = null
  row.invite_expires_at = null
  writeJson(seatsPath, list)
  return publicSeat(row)
}

export async function getSeatByToken(token) {
  const tokenHash = createHash('sha256').update(String(token)).digest('hex')
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT s.*, o.organization_name, o.name AS org_display
       FROM ngo_seats s
       JOIN hub_accounts o ON o.id = s.org_account_id
       WHERE (s.invite_token_hash = $1 OR s.invite_token = $2) AND s.status = 'invited'
         AND (s.invite_expires_at IS NULL OR s.invite_expires_at > now())
       LIMIT 1`,
      [tokenHash, token]
    )
    if (!rows[0]) return null
    return {
      ...publicSeat(rows[0]),
      organizationName: rows[0].organization_name || rows[0].org_display,
    }
  }
  const list = readJson(seatsPath, [])
  const row = list.find((s) => (s.invite_token_hash === tokenHash || s.invite_token === token) && s.status === 'invited')
  if (row?.invite_expires_at && new Date(row.invite_expires_at) <= new Date()) return null
  return publicSeat(row)
}

export { findAccountByEmail }
