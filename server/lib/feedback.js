// Feedback tickets raised by members from anywhere in the Hub.
// PostgreSQL when configured, a local JSON file in fixture mode.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { readJson, writeJson } from './jsonFile.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const ticketsPath = path.join(here, '../../data/feedback-tickets.json')

export const FEEDBACK_KINDS = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'ui_ux', label: 'Design or usability' },
  { value: 'feature', label: 'Feature idea' },
  { value: 'blocker', label: 'I am blocked' },
  { value: 'content', label: 'Wrong or missing content' },
  { value: 'other', label: 'Something else' },
]

export const FEEDBACK_SEVERITIES = [
  { value: 'low', label: 'Minor' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Serious' },
  { value: 'critical', label: 'Cannot use the Hub' },
]

export const FEEDBACK_STATUSES = [
  'new',
  'triaged',
  'in_progress',
  'resolved',
  'declined',
]

const KIND_VALUES = new Set(FEEDBACK_KINDS.map((k) => k.value))
const SEVERITY_VALUES = new Set(FEEDBACK_SEVERITIES.map((s) => s.value))

function trimmed(value, max) {
  return String(value ?? '')
    .trim()
    .slice(0, max)
}

/**
 * Normalise and validate a submitted ticket. Throws with `.code = 'validation'`
 * so the route can map it to a 400 without inspecting the message.
 */
export function normalizeTicketInput(input = {}) {
  const title = trimmed(input.title, 200)
  if (title.length < 6) {
    throw Object.assign(
      new Error('Give the report a title of at least 6 characters.'),
      { code: 'validation' },
    )
  }
  const kind = String(input.kind || 'other')
  if (!KIND_VALUES.has(kind)) {
    throw Object.assign(new Error('Choose a valid feedback type.'), {
      code: 'validation',
    })
  }
  const severity = String(input.severity || 'normal')
  if (!SEVERITY_VALUES.has(severity)) {
    throw Object.assign(new Error('Choose a valid severity.'), {
      code: 'validation',
    })
  }
  return {
    kind,
    severity,
    title,
    body: trimmed(input.body, 4000) || null,
    // Only same-origin paths are stored, so a crafted payload cannot turn the
    // triage queue into a link to somewhere else. The second character must not
    // be a slash: "//host" is protocol-relative and would leave the origin.
    pagePath: /^\/(?!\/)[\w\-/.?=&%]*$/.test(String(input.pagePath || ''))
      ? trimmed(input.pagePath, 300)
      : null,
    userAgent: trimmed(input.userAgent, 300) || null,
    viewport: /^\d{1,5}x\d{1,5}$/.test(String(input.viewport || ''))
      ? String(input.viewport)
      : null,
  }
}

function publicTicket(row) {
  if (!row) return null
  return {
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body,
    pagePath: row.page_path,
    userAgent: row.user_agent,
    viewport: row.viewport,
    status: row.status,
    triageNote: row.triage_note,
    githubIssueUrl: row.github_issue_url,
    reporterAccountId: row.reporter_account_id,
    reporterName: row.reporter_name || null,
    reporterEmail: row.reporter_email || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createTicket(ticket, reporterAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO feedback_tickets
         (reporter_account_id, kind, severity, title, body, page_path, user_agent, viewport)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        reporterAccountId,
        ticket.kind,
        ticket.severity,
        ticket.title,
        ticket.body,
        ticket.pagePath,
        ticket.userAgent,
        ticket.viewport,
      ],
    )
    return publicTicket(rows[0])
  }
  const now = new Date().toISOString()
  const row = {
    id: randomUUID(),
    reporter_account_id: reporterAccountId,
    kind: ticket.kind,
    severity: ticket.severity,
    title: ticket.title,
    body: ticket.body,
    page_path: ticket.pagePath,
    user_agent: ticket.userAgent,
    viewport: ticket.viewport,
    status: 'new',
    triage_note: null,
    github_issue_url: null,
    created_at: now,
    updated_at: now,
  }
  const list = readJson(ticketsPath, [])
  list.unshift(row)
  writeJson(ticketsPath, list)
  return publicTicket(row)
}

export async function listMyTickets(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM feedback_tickets WHERE reporter_account_id = $1 ORDER BY created_at DESC LIMIT 50',
      [accountId],
    )
    return rows.map(publicTicket)
  }
  return readJson(ticketsPath, [])
    .filter((row) => row.reporter_account_id === accountId)
    .slice(0, 50)
    .map(publicTicket)
}

/** Triage queue. Reporter identity is joined in so the team can follow up. */
export async function listTickets({ status, kind, limit = 100 } = {}) {
  const capped = Math.min(Number(limit) || 100, 200)
  const pool = getPool()
  if (pool) {
    const filters = []
    const values = []
    if (status && FEEDBACK_STATUSES.includes(status)) {
      values.push(status)
      filters.push(`t.status = $${values.length}`)
    }
    if (kind && KIND_VALUES.has(kind)) {
      values.push(kind)
      filters.push(`t.kind = $${values.length}`)
    }
    values.push(capped)
    const { rows } = await pool.query(
      `SELECT t.*, a.name AS reporter_name, a.email AS reporter_email
         FROM feedback_tickets t
         LEFT JOIN hub_accounts a ON a.id = t.reporter_account_id
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY t.created_at DESC
        LIMIT $${values.length}`,
      values,
    )
    return rows.map(publicTicket)
  }
  const accounts = readJson(path.join(here, '../../data/hub-accounts.json'), [])
  return readJson(ticketsPath, [])
    .filter((row) => !status || row.status === status)
    .filter((row) => !kind || row.kind === kind)
    .slice(0, capped)
    .map((row) => {
      const reporter = accounts.find((a) => a.id === row.reporter_account_id)
      return publicTicket({
        ...row,
        reporter_name: reporter?.name || null,
        reporter_email: reporter?.email || null,
      })
    })
}

export async function updateTicket(id, { status, triageNote }) {
  if (status && !FEEDBACK_STATUSES.includes(status)) {
    throw Object.assign(new Error('Invalid ticket status.'), {
      code: 'validation',
    })
  }
  const note = triageNote == null ? undefined : trimmed(triageNote, 2000)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE feedback_tickets
          SET status = COALESCE($2, status),
              triage_note = COALESCE($3, triage_note),
              updated_at = now()
        WHERE id = $1 RETURNING *`,
      [id, status || null, note ?? null],
    )
    return publicTicket(rows[0])
  }
  const list = readJson(ticketsPath, [])
  const row = list.find((item) => item.id === id)
  if (!row) return null
  if (status) row.status = status
  if (note !== undefined) row.triage_note = note
  row.updated_at = new Date().toISOString()
  writeJson(ticketsPath, list)
  return publicTicket(row)
}

export async function attachGithubIssue(id, issueUrl) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'UPDATE feedback_tickets SET github_issue_url = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, issueUrl],
    )
    return publicTicket(rows[0])
  }
  const list = readJson(ticketsPath, [])
  const row = list.find((item) => item.id === id)
  if (!row) return null
  row.github_issue_url = issueUrl
  row.updated_at = new Date().toISOString()
  writeJson(ticketsPath, list)
  return publicTicket(row)
}
