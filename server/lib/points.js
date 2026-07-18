/**
 * NGO contribution points — staff-awarded ledger for badge support
 * and UNFCCC / constituency submissions.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import { getAccessProfile } from './access.js'

const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data')
const ledgerPath = path.join(dataDir, 'ngo-point-ledger.json')

export const POINT_REASONS = {
  badge_support: {
    code: 'badge_support',
    label: 'Badge support',
    description: 'Supported a YOUNGO pool badge allocation or badge process.',
    defaultPoints: 10,
  },
  unfccc_submission: {
    code: 'unfccc_submission',
    label: 'UNFCCC submission support',
    description: 'Supported, co-authored, or endorsed a UNFCCC-facing submission.',
    defaultPoints: 15,
  },
  endorse_document: {
    code: 'endorse_document',
    label: 'Document endorsement',
    description: 'Endorsed a constituency document or draft.',
    defaultPoints: 10,
  },
  submit_on_behalf: {
    code: 'submit_on_behalf',
    label: 'Submit on behalf of NGO',
    description: 'Formally submitted material on behalf of the organisation.',
    defaultPoints: 20,
  },
  represent: {
    code: 'represent',
    label: 'Representation',
    description: 'Represented the NGO in a formal YOUNGO / UNFCCC process.',
    defaultPoints: 5,
  },
  other: {
    code: 'other',
    label: 'Other contribution',
    description: 'Other verified contribution.',
    defaultPoints: 5,
  },
  adjustment: {
    code: 'adjustment',
    label: 'Adjustment',
    description: 'Manual correction (positive or negative).',
    defaultPoints: 0,
  },
}

/** Soft recognition tiers — not UNFCCC credentials; hub recognition only. */
export const RECOGNITION_TIERS = [
  { id: 'contributor', label: 'Contributor', minPoints: 25, blurb: 'First verified contributions logged.' },
  { id: 'active_partner', label: 'Active partner', minPoints: 50, blurb: 'Regular support for submissions or badges.' },
  { id: 'core_partner', label: 'Core partner', minPoints: 100, blurb: 'Sustained contribution to constituency work.' },
  { id: 'steward', label: 'Steward', minPoints: 200, blurb: 'Deep, ongoing support for YOUNGO processes.' },
]

function readJson(file, fallback = []) {
  try {
    if (!existsSync(file)) return fallback
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

export function publicLedgerEntry(row) {
  if (!row) return null
  const reason = POINT_REASONS[row.reason_code ?? row.reasonCode] || POINT_REASONS.other
  return {
    id: row.id,
    orgAccountId: row.org_account_id ?? row.orgAccountId,
    points: Number(row.points),
    reasonCode: row.reason_code ?? row.reasonCode,
    reasonLabel: reason.label,
    title: row.title,
    note: row.note || null,
    relatedType: row.related_type ?? row.relatedType ?? null,
    relatedId: row.related_id ?? row.relatedId ?? null,
    awardedBy: row.awarded_by ?? row.awardedBy ?? null,
    awardedByName: row.awarded_by_name ?? row.awardedByName ?? null,
    awardedByEmail: row.awarded_by_email ?? row.awardedByEmail ?? null,
    status: row.status || 'posted',
    createdAt: row.created_at ?? row.createdAt,
    orgName: row.org_name ?? row.orgName ?? null,
    organizationName: row.organization_name ?? row.organizationName ?? null,
  }
}

export function tiersForBalance(balance) {
  const earned = RECOGNITION_TIERS.filter((t) => balance >= t.minPoints)
  const next = RECOGNITION_TIERS.find((t) => balance < t.minPoints) || null
  const current = earned[earned.length - 1] || null
  return {
    balance,
    current,
    earned,
    next,
    pointsToNext: next ? next.minPoints - balance : 0,
  }
}

export async function canAwardPoints(account) {
  if (!account) return false
  if (account.role === 'admin' || account.role === 'focal_point') return true
  const access = await getAccessProfile(account)
  return access.teamRoles.includes('membership_team')
}

export async function getOrgPointsBalance(orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(points), 0)::int AS balance
       FROM ngo_point_ledger
       WHERE org_account_id = $1 AND status = 'posted'`,
      [orgAccountId],
    )
    return Number(rows[0]?.balance || 0)
  }
  const list = readJson(ledgerPath, [])
  return list
    .filter((r) => (r.org_account_id || r.orgAccountId) === orgAccountId && (r.status || 'posted') === 'posted')
    .reduce((sum, r) => sum + Number(r.points || 0), 0)
}

export async function listOrgPointsLedger(orgAccountId, { limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT l.*, a.name AS awarded_by_name, a.email AS awarded_by_email
       FROM ngo_point_ledger l
       LEFT JOIN hub_accounts a ON a.id = l.awarded_by
       WHERE l.org_account_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2`,
      [orgAccountId, safeLimit],
    )
    return rows.map(publicLedgerEntry)
  }
  return readJson(ledgerPath, [])
    .filter((r) => (r.org_account_id || r.orgAccountId) === orgAccountId)
    .sort((a, b) => String(b.created_at || b.createdAt).localeCompare(String(a.created_at || a.createdAt)))
    .slice(0, safeLimit)
    .map(publicLedgerEntry)
}

export async function listRecentPointAwards({ limit = 40 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 200)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT l.*,
              a.name AS awarded_by_name, a.email AS awarded_by_email,
              o.name AS org_name, o.organization_name
       FROM ngo_point_ledger l
       LEFT JOIN hub_accounts a ON a.id = l.awarded_by
       LEFT JOIN hub_accounts o ON o.id = l.org_account_id
       WHERE l.status = 'posted'
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [safeLimit],
    )
    return rows.map(publicLedgerEntry)
  }
  return readJson(ledgerPath, [])
    .filter((r) => (r.status || 'posted') === 'posted')
    .sort((a, b) => String(b.created_at || b.createdAt).localeCompare(String(a.created_at || a.createdAt)))
    .slice(0, safeLimit)
    .map(publicLedgerEntry)
}

export async function listOrgPointBalances() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT o.id AS org_account_id,
              o.name AS org_name,
              o.organization_name,
              o.email,
              o.member_status,
              COALESCE(SUM(l.points) FILTER (WHERE l.status = 'posted'), 0)::int AS balance
       FROM hub_accounts o
       LEFT JOIN ngo_point_ledger l ON l.org_account_id = o.id
       WHERE o.entity_type = 'organization'
       GROUP BY o.id
       ORDER BY balance DESC, o.organization_name NULLS LAST, o.name
       LIMIT 200`,
    )
    return rows.map((r) => ({
      orgAccountId: r.org_account_id,
      name: r.organization_name || r.org_name,
      email: r.email,
      memberStatus: r.member_status,
      balance: Number(r.balance || 0),
      recognition: tiersForBalance(Number(r.balance || 0)),
    }))
  }
  // Fixture mode: no org directory — return ledger aggregates only
  const list = readJson(ledgerPath, [])
  const byOrg = new Map()
  for (const row of list) {
    if ((row.status || 'posted') !== 'posted') continue
    const id = row.org_account_id || row.orgAccountId
    byOrg.set(id, (byOrg.get(id) || 0) + Number(row.points || 0))
  }
  return [...byOrg.entries()].map(([orgAccountId, balance]) => ({
    orgAccountId,
    name: orgAccountId,
    email: null,
    memberStatus: null,
    balance,
    recognition: tiersForBalance(balance),
  }))
}

/**
 * Award (or adjust) points for an organisation.
 * @returns {Promise<{ entry: object, balance: number, recognition: object }>}
 */
export async function awardOrgPoints({
  orgAccountId,
  points,
  reasonCode,
  title,
  note = null,
  relatedType = null,
  relatedId = null,
  awardedBy = null,
}) {
  if (!orgAccountId) throw Object.assign(new Error('Organisation is required.'), { code: 'validation' })
  const reason = POINT_REASONS[reasonCode]
  if (!reason) throw Object.assign(new Error('Unknown contribution type.'), { code: 'validation' })

  let pts = Number(points)
  if (!Number.isFinite(pts) || pts === 0) {
    pts = reason.defaultPoints
  }
  if (!Number.isFinite(pts) || pts === 0) {
    throw Object.assign(new Error('Points must be a non-zero number.'), { code: 'validation' })
  }
  if (Math.abs(pts) > 500) {
    throw Object.assign(new Error('Single award cannot exceed ±500 points.'), { code: 'validation' })
  }

  const cleanTitle = String(title || reason.label).trim().slice(0, 200)
  if (!cleanTitle) throw Object.assign(new Error('Title is required.'), { code: 'validation' })

  const pool = getPool()
  if (pool) {
    const org = await pool.query(
      `SELECT id FROM hub_accounts WHERE id = $1 AND entity_type = 'organization'`,
      [orgAccountId],
    )
    if (!org.rows[0]) {
      throw Object.assign(new Error('Organisation account not found.'), { code: 'not_found' })
    }

    const { rows } = await pool.query(
      `INSERT INTO ngo_point_ledger
         (org_account_id, points, reason_code, title, note, related_type, related_id, awarded_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'posted')
       RETURNING *`,
      [
        orgAccountId,
        pts,
        reasonCode,
        cleanTitle,
        note ? String(note).slice(0, 2000) : null,
        relatedType || null,
        relatedId ? String(relatedId) : null,
        awardedBy || null,
      ],
    )
    const balance = await getOrgPointsBalance(orgAccountId)
    return {
      entry: publicLedgerEntry(rows[0]),
      balance,
      recognition: tiersForBalance(balance),
    }
  }

  const entry = {
    id: randomUUID(),
    org_account_id: orgAccountId,
    points: pts,
    reason_code: reasonCode,
    title: cleanTitle,
    note: note ? String(note).slice(0, 2000) : null,
    related_type: relatedType || null,
    related_id: relatedId ? String(relatedId) : null,
    awarded_by: awardedBy || null,
    status: 'posted',
    created_at: new Date().toISOString(),
  }
  const list = readJson(ledgerPath, [])
  list.unshift(entry)
  writeJson(ledgerPath, list)
  const balance = await getOrgPointsBalance(orgAccountId)
  return {
    entry: publicLedgerEntry(entry),
    balance,
    recognition: tiersForBalance(balance),
  }
}

/** Map NGO request kinds → default reason codes for staff convenience. */
export function reasonFromNgoRequestKind(kind) {
  switch (kind) {
    case 'endorse': return 'endorse_document'
    case 'submit': return 'unfccc_submission'
    case 'badge_support': return 'badge_support'
    case 'represent': return 'represent'
    case 'deadline': return 'other'
    default: return 'other'
  }
}

/**
 * Done NGO requests that have not yet received a linked points award.
 * Staff use these as one-click award suggestions (still human-verified).
 */
export async function listAwardSuggestions({ limit = 40 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT r.id,
              r.org_account_id,
              r.kind,
              r.title,
              r.body,
              r.status,
              r.created_at,
              r.deadline_at,
              o.name AS org_name,
              o.organization_name,
              o.email AS org_email
       FROM ngo_requests r
       JOIN hub_accounts o ON o.id = r.org_account_id
       WHERE r.status = 'done'
         AND NOT EXISTS (
           SELECT 1 FROM ngo_point_ledger l
           WHERE l.related_type = 'ngo_request'
             AND l.related_id = r.id::text
             AND l.status = 'posted'
         )
       ORDER BY r.created_at DESC
       LIMIT $1`,
      [safeLimit],
    )
    return rows.map((r) => {
      const reasonCode = reasonFromNgoRequestKind(r.kind)
      const reason = POINT_REASONS[reasonCode] || POINT_REASONS.other
      return {
        requestId: r.id,
        orgAccountId: r.org_account_id,
        orgName: r.organization_name || r.org_name,
        orgEmail: r.org_email,
        kind: r.kind,
        title: r.title,
        body: r.body,
        createdAt: r.created_at,
        deadlineAt: r.deadline_at,
        suggestedReasonCode: reasonCode,
        suggestedReasonLabel: reason.label,
        suggestedPoints: reason.defaultPoints,
      }
    })
  }

  // Fixture fallback: scan local JSON request + ledger files
  const reqPath = path.join(dataDir, 'ngo-requests.json')
  const requests = readJson(reqPath, [])
  const ledger = readJson(ledgerPath, [])
  const awardedIds = new Set(
    ledger
      .filter((e) => (e.related_type || e.relatedType) === 'ngo_request' && (e.status || 'posted') === 'posted')
      .map((e) => String(e.related_id || e.relatedId)),
  )
  return requests
    .filter((r) => r.status === 'done' && !awardedIds.has(String(r.id)))
    .slice(0, safeLimit)
    .map((r) => {
      const reasonCode = reasonFromNgoRequestKind(r.kind)
      const reason = POINT_REASONS[reasonCode] || POINT_REASONS.other
      return {
        requestId: r.id,
        orgAccountId: r.org_account_id || r.orgAccountId,
        orgName: r.org_name || r.organization_name || r.org_account_id,
        orgEmail: null,
        kind: r.kind,
        title: r.title,
        body: r.body,
        createdAt: r.created_at || r.createdAt,
        deadlineAt: r.deadline_at || r.deadlineAt,
        suggestedReasonCode: reasonCode,
        suggestedReasonLabel: reason.label,
        suggestedPoints: reason.defaultPoints,
      }
    })
}

/** Public board: org display name + points only (no emails). */
export async function listPublicRecognitionBoard({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100)
  const orgs = await listOrgPointBalances()
  return orgs
    .filter((o) => o.balance > 0)
    .slice(0, safeLimit)
    .map((o, index) => ({
      rank: index + 1,
      name: o.name || 'Organisation',
      balance: o.balance,
      tier: o.recognition?.current?.label || null,
      tierId: o.recognition?.current?.id || null,
    }))
}
