// NGO postings: events, online workshops, hackathons and other opportunities
// organisations offer the constituency.
//
// Review model: an organisation's first posting is held for staff review. Once
// it has one published posting it is trusted and later postings go live
// immediately. Staff can override the derivation in either direction.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../data')
const postingsPath = path.join(dataDir, 'ngo-opportunities.json')
const trustPath = path.join(dataDir, 'ngo-opportunity-trust.json')
const accountsPath = path.join(dataDir, 'hub-accounts.json')

export const OPPORTUNITY_KINDS = [
  { value: 'event', label: 'Event' },
  { value: 'workshop', label: 'Online workshop' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'call', label: 'Open call' },
  { value: 'training', label: 'Training' },
]

export const OPPORTUNITY_FORMATS = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
]

const KIND_VALUES = new Set(OPPORTUNITY_KINDS.map((k) => k.value))
const FORMAT_VALUES = new Set(OPPORTUNITY_FORMATS.map((f) => f.value))

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* empty */
  }
  return fallback
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function validationError(message) {
  return Object.assign(new Error(message), { code: 'validation' })
}

function trimmed(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

function isoOrNull(value, field) {
  if (!value) return null
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed))
    throw validationError(`${field} is not a valid date.`)
  return new Date(parsed).toISOString()
}

/** Only absolute http(s) links are accepted, so a posting cannot smuggle in a
 *  javascript: URL that the member-facing board would render as a link. */
function safeUrl(value) {
  const raw = trimmed(value, 500)
  if (!raw) return null
  let url
  try {
    url = new URL(raw)
  } catch {
    throw validationError('The link must be a full http(s) URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw validationError('The link must be a full http(s) URL.')
  }
  return url.toString()
}

export function normalizeOpportunityInput(input = {}) {
  const title = trimmed(input.title, 200)
  if (title.length < 6) {
    throw validationError('Give the posting a title of at least 6 characters.')
  }
  const kind = String(input.kind || '')
  if (!KIND_VALUES.has(kind)) throw validationError('Choose a posting type.')
  const format = String(input.format || 'online')
  if (!FORMAT_VALUES.has(format)) throw validationError('Choose a format.')

  const startsAt = isoOrNull(input.startsAt, 'Start')
  const endsAt = isoOrNull(input.endsAt, 'End')
  if (startsAt && endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
    throw validationError('The end time cannot be before the start time.')
  }
  return {
    kind,
    title,
    summary: trimmed(input.summary, 300) || null,
    body: trimmed(input.body, 4000) || null,
    format,
    location: trimmed(input.location, 200) || null,
    region: trimmed(input.region, 60) || null,
    startsAt,
    endsAt,
    deadlineAt: isoOrNull(input.deadlineAt, 'Deadline'),
    linkUrl: safeUrl(input.linkUrl),
  }
}

function publicOpportunity(row) {
  if (!row) return null
  return {
    id: row.id,
    orgAccountId: row.org_account_id,
    organizationName: row.organization_name || null,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    body: row.body,
    format: row.format,
    location: row.location,
    region: row.region,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    deadlineAt: row.deadline_at,
    linkUrl: row.link_url,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }
}

function orgNameFor(accounts, orgAccountId) {
  const account = accounts.find((a) => a.id === orgAccountId)
  return account?.organization_name || account?.name || null
}

/**
 * Whether the organisation may publish without review. An explicit trust row
 * wins; otherwise trust is earned by having cleared review once.
 */
export async function orgPostingTrust(orgAccountId) {
  const pool = getPool()
  if (pool) {
    const override = await pool.query(
      'SELECT state FROM ngo_opportunity_trust WHERE org_account_id = $1',
      [orgAccountId],
    )
    if (override.rows[0]) return override.rows[0].state === 'trusted'
    const { rows } = await pool.query(
      `SELECT 1 FROM ngo_opportunities
        WHERE org_account_id = $1 AND status = 'published' LIMIT 1`,
      [orgAccountId],
    )
    return rows.length > 0
  }
  const override = readJson(trustPath, []).find(
    (row) => row.org_account_id === orgAccountId,
  )
  if (override) return override.state === 'trusted'
  return readJson(postingsPath, []).some(
    (row) => row.org_account_id === orgAccountId && row.status === 'published',
  )
}

export async function setOrgPostingTrust(orgAccountId, state, updatedBy, note) {
  if (!['trusted', 'review_required'].includes(state)) {
    throw validationError('Trust state must be trusted or review_required.')
  }
  const pool = getPool()
  if (pool) {
    await pool.query(
      `INSERT INTO ngo_opportunity_trust (org_account_id, state, note, updated_by, updated_at)
       VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (org_account_id) DO UPDATE
         SET state = EXCLUDED.state, note = EXCLUDED.note,
             updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [orgAccountId, state, trimmed(note, 500) || null, updatedBy],
    )
    return { orgAccountId, state }
  }
  const list = readJson(trustPath, [])
  const existing = list.find((row) => row.org_account_id === orgAccountId)
  const row = existing || { org_account_id: orgAccountId }
  row.state = state
  row.note = trimmed(note, 500) || null
  row.updated_by = updatedBy
  row.updated_at = new Date().toISOString()
  if (!existing) list.push(row)
  writeJson(trustPath, list)
  return { orgAccountId, state }
}

export async function createOpportunity(input, { orgAccountId, createdBy }) {
  const trusted = await orgPostingTrust(orgAccountId)
  const status = trusted ? 'published' : 'pending_review'
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO ngo_opportunities
         (org_account_id, kind, title, summary, body, format, location, region,
          starts_at, ends_at, deadline_at, link_url, status, created_by,
          reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               CASE WHEN $13 = 'published' THEN now() ELSE NULL END)
       RETURNING *`,
      [
        orgAccountId,
        input.kind,
        input.title,
        input.summary,
        input.body,
        input.format,
        input.location,
        input.region,
        input.startsAt,
        input.endsAt,
        input.deadlineAt,
        input.linkUrl,
        status,
        createdBy,
      ],
    )
    return publicOpportunity(rows[0])
  }
  const now = new Date().toISOString()
  const row = {
    id: randomUUID(),
    org_account_id: orgAccountId,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    body: input.body,
    format: input.format,
    location: input.location,
    region: input.region,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    deadline_at: input.deadlineAt,
    link_url: input.linkUrl,
    status,
    review_note: null,
    reviewed_by: null,
    reviewed_at: status === 'published' ? now : null,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  }
  const list = readJson(postingsPath, [])
  list.unshift(row)
  writeJson(postingsPath, list)
  return publicOpportunity(row)
}

const PAST_GRACE_MS = 86400000

/** The member-facing board: published postings that have not finished. */
export async function listPublishedOpportunities(
  { kind, format } = {},
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - PAST_GRACE_MS).toISOString()
  const pool = getPool()
  if (pool) {
    const values = [cutoff]
    const filters = [
      `o.status = 'published'`,
      `(o.ends_at IS NULL OR o.ends_at >= $1)`,
    ]
    if (kind && kind !== 'all' && KIND_VALUES.has(kind)) {
      values.push(kind)
      filters.push(`o.kind = $${values.length}`)
    }
    if (format && format !== 'all' && FORMAT_VALUES.has(format)) {
      values.push(format)
      filters.push(`o.format = $${values.length}`)
    }
    const { rows } = await pool.query(
      `SELECT o.*, a.organization_name
         FROM ngo_opportunities o
         JOIN hub_accounts a ON a.id = o.org_account_id
        WHERE ${filters.join(' AND ')}
        ORDER BY o.starts_at NULLS LAST, o.created_at DESC
        LIMIT 200`,
      values,
    )
    return rows.map(publicOpportunity)
  }
  const accounts = readJson(accountsPath, [])
  return readJson(postingsPath, [])
    .filter((row) => row.status === 'published')
    .filter((row) => !row.ends_at || row.ends_at >= cutoff)
    .filter((row) => !kind || kind === 'all' || row.kind === kind)
    .filter((row) => !format || format === 'all' || row.format === format)
    .sort((a, b) =>
      String(a.starts_at || '9999').localeCompare(
        String(b.starts_at || '9999'),
      ),
    )
    .map((row) =>
      publicOpportunity({
        ...row,
        organization_name: orgNameFor(accounts, row.org_account_id),
      }),
    )
}

/** Everything one organisation has posted, in any state. */
export async function listOrgOpportunities(orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT o.*, a.organization_name
         FROM ngo_opportunities o
         JOIN hub_accounts a ON a.id = o.org_account_id
        WHERE o.org_account_id = $1
        ORDER BY o.created_at DESC LIMIT 100`,
      [orgAccountId],
    )
    return rows.map(publicOpportunity)
  }
  const accounts = readJson(accountsPath, [])
  return readJson(postingsPath, [])
    .filter((row) => row.org_account_id === orgAccountId)
    .map((row) =>
      publicOpportunity({
        ...row,
        organization_name: orgNameFor(accounts, row.org_account_id),
      }),
    )
}

export async function listPendingOpportunities() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT o.*, a.organization_name
         FROM ngo_opportunities o
         JOIN hub_accounts a ON a.id = o.org_account_id
        WHERE o.status = 'pending_review'
        ORDER BY o.created_at ASC LIMIT 100`,
    )
    return rows.map(publicOpportunity)
  }
  const accounts = readJson(accountsPath, [])
  return readJson(postingsPath, [])
    .filter((row) => row.status === 'pending_review')
    .map((row) =>
      publicOpportunity({
        ...row,
        organization_name: orgNameFor(accounts, row.org_account_id),
      }),
    )
}

/** Live postings for staff moderation (includes ones past the member grace window). */
export async function listPublishedForStaff({ limit = 50 } = {}) {
  const capped = Math.min(Number(limit) || 50, 100)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT o.*, a.organization_name
         FROM ngo_opportunities o
         JOIN hub_accounts a ON a.id = o.org_account_id
        WHERE o.status = 'published'
        ORDER BY o.created_at DESC
        LIMIT $1`,
      [capped],
    )
    return rows.map(publicOpportunity)
  }
  const accounts = readJson(accountsPath, [])
  return readJson(postingsPath, [])
    .filter((row) => row.status === 'published')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, capped)
    .map((row) =>
      publicOpportunity({
        ...row,
        organization_name: orgNameFor(accounts, row.org_account_id),
      }),
    )
}

/**
 * Organisations that have posted, with the effective trust flag and any
 * explicit override — so staff can flip either direction without hunting IDs.
 */
export async function listPostingOrganisations() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT a.id AS org_account_id,
              a.organization_name,
              t.state AS override_state,
              t.note AS override_note,
              EXISTS (
                SELECT 1 FROM ngo_opportunities o
                 WHERE o.org_account_id = a.id AND o.status = 'published'
              ) AS has_published
         FROM hub_accounts a
         JOIN (
           SELECT DISTINCT org_account_id FROM ngo_opportunities
         ) posted ON posted.org_account_id = a.id
         LEFT JOIN ngo_opportunity_trust t ON t.org_account_id = a.id
        ORDER BY a.organization_name NULLS LAST, a.id
        LIMIT 200`,
    )
    return rows.map((row) => {
      const override = row.override_state || null
      const trusted =
        override === 'trusted' ||
        (override !== 'review_required' && Boolean(row.has_published))
      return {
        orgAccountId: row.org_account_id,
        organizationName: row.organization_name || null,
        trusted,
        override,
        overrideNote: row.override_note || null,
      }
    })
  }
  const accounts = readJson(accountsPath, [])
  const postings = readJson(postingsPath, [])
  const trust = readJson(trustPath, [])
  const orgIds = [...new Set(postings.map((row) => row.org_account_id))]
  return orgIds.map((orgAccountId) => {
    const override =
      trust.find((row) => row.org_account_id === orgAccountId)?.state || null
    const overrideNote =
      trust.find((row) => row.org_account_id === orgAccountId)?.note || null
    const hasPublished = postings.some(
      (row) =>
        row.org_account_id === orgAccountId && row.status === 'published',
    )
    const trusted =
      override === 'trusted' || (override !== 'review_required' && hasPublished)
    return {
      orgAccountId,
      organizationName: orgNameFor(accounts, orgAccountId),
      trusted,
      override,
      overrideNote,
    }
  })
}

/**
 * Approve or reject a pending posting. Approving is what earns the
 * organisation its standing trust, so later postings skip the queue.
 */
export async function reviewOpportunity(id, { approve, note, reviewerId }) {
  const status = approve ? 'published' : 'rejected'
  const reviewNote = trimmed(note, 1000) || null
  if (!approve && !reviewNote) {
    throw validationError('Give the organisation a reason for the rejection.')
  }
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE ngo_opportunities
          SET status = $2, review_note = $3, reviewed_by = $4,
              reviewed_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'pending_review'
        RETURNING *`,
      [id, status, reviewNote, reviewerId],
    )
    return publicOpportunity(rows[0])
  }
  const list = readJson(postingsPath, [])
  const row = list.find(
    (item) => item.id === id && item.status === 'pending_review',
  )
  if (!row) return null
  row.status = status
  row.review_note = reviewNote
  row.reviewed_by = reviewerId
  row.reviewed_at = new Date().toISOString()
  row.updated_at = row.reviewed_at
  writeJson(postingsPath, list)
  return publicOpportunity(row)
}

/** An organisation taking its own posting down. */
export async function withdrawOpportunity(id, orgAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE ngo_opportunities SET status = 'withdrawn', updated_at = now()
        WHERE id = $1 AND org_account_id = $2 AND status IN ('published', 'pending_review')
        RETURNING *`,
      [id, orgAccountId],
    )
    return publicOpportunity(rows[0])
  }
  const list = readJson(postingsPath, [])
  const row = list.find(
    (item) =>
      item.id === id &&
      item.org_account_id === orgAccountId &&
      ['published', 'pending_review'].includes(item.status),
  )
  if (!row) return null
  row.status = 'withdrawn'
  row.updated_at = new Date().toISOString()
  writeJson(postingsPath, list)
  return publicOpportunity(row)
}

/** Staff taking a published posting down. */
export async function unpublishOpportunity(id, { note, reviewerId }) {
  const reviewNote = trimmed(note, 1000) || null
  if (!reviewNote) throw validationError('Give a reason for unpublishing.')
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE ngo_opportunities
          SET status = 'rejected', review_note = $2, reviewed_by = $3,
              reviewed_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'published' RETURNING *`,
      [id, reviewNote, reviewerId],
    )
    return publicOpportunity(rows[0])
  }
  const list = readJson(postingsPath, [])
  const row = list.find((item) => item.id === id && item.status === 'published')
  if (!row) return null
  row.status = 'rejected'
  row.review_note = reviewNote
  row.reviewed_by = reviewerId
  row.reviewed_at = new Date().toISOString()
  row.updated_at = row.reviewed_at
  writeJson(postingsPath, list)
  return publicOpportunity(row)
}
