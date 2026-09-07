// Public consultation contributions. PostgreSQL in production, JSON in fixture mode.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { readJson, writeJson } from './jsonFile.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const storePath = path.join(here, '../../data/consultation-contributions.json')

export const CONTRIBUTION_KINDS = [
  { value: 'question', label: 'Question' },
  { value: 'concern', label: 'Concern' },
  { value: 'comment', label: 'Comment' },
  { value: 'feature', label: 'New feature' },
]

export const CONTRIBUTION_SECTIONS = [
  { value: 'general', label: 'Whole consultation' },
  { value: 'open', label: 'Open' },
  { value: 'aims', label: 'Aims' },
  { value: 'need', label: 'Need' },
  { value: 'security', label: 'Security' },
  { value: 'concerns', label: 'Concerns' },
  { value: 'uses', label: 'Features' },
  { value: 'serve', label: 'Who it serves' },
  { value: 'safeguards', label: 'Safeguards' },
  { value: 'agree', label: 'Agree' },
  { value: 'next', label: 'Next steps' },
]

const KIND_VALUES = new Set(CONTRIBUTION_KINDS.map((kind) => kind.value))
const SECTION_VALUES = new Set(
  CONTRIBUTION_SECTIONS.map((section) => section.value),
)
const BODY_MIN = 8
const BODY_MAX = 800
const NAME_MAX = 80

function trimmed(value, max) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export function normalizeContributionInput(input = {}) {
  const kind = String(input.kind || '')
  if (!KIND_VALUES.has(kind)) {
    throw Object.assign(
      new Error('Choose question, concern, comment, or new feature.'),
      {
        code: 'validation',
      },
    )
  }
  const body = trimmed(input.body, BODY_MAX)
  if (body.length < BODY_MIN) {
    throw Object.assign(
      new Error('Write at least a short sentence so the room can use it.'),
      { code: 'validation' },
    )
  }
  const displayName = trimmed(input.name, NAME_MAX)
  const section = SECTION_VALUES.has(String(input.section || ''))
    ? String(input.section)
    : 'general'
  return {
    kind,
    body,
    displayName: displayName || null,
    section,
  }
}

function publicContribution(row) {
  if (!row) return null
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    name: row.display_name || null,
    section: SECTION_VALUES.has(row.section) ? row.section : 'general',
    createdAt: row.created_at,
  }
}

export async function createContribution(input) {
  const payload = normalizeContributionInput(input)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO consultation_contributions (kind, body, display_name, section)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payload.kind, payload.body, payload.displayName, payload.section],
    )
    return publicContribution(rows[0])
  }
  const row = {
    id: randomUUID(),
    kind: payload.kind,
    body: payload.body,
    display_name: payload.displayName,
    section: payload.section,
    created_at: new Date().toISOString(),
  }
  const list = readJson(storePath, [])
  list.unshift(row)
  writeJson(storePath, list.slice(0, 500))
  return publicContribution(row)
}

export async function listContributions({ kind, section, limit = 100 } = {}) {
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 200)
  const pool = getPool()
  if (pool) {
    const values = []
    const filters = []
    if (kind && KIND_VALUES.has(kind)) {
      values.push(kind)
      filters.push(`kind = $${values.length}`)
    }
    if (section && SECTION_VALUES.has(section)) {
      values.push(section)
      filters.push(`section = $${values.length}`)
    }
    values.push(capped)
    const { rows } = await pool.query(
      `SELECT id, kind, body, display_name, section, created_at
         FROM consultation_contributions
        ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
        ORDER BY created_at DESC
        LIMIT $${values.length}`,
      values,
    )
    return rows.map(publicContribution)
  }
  return readJson(storePath, [])
    .filter((row) => !kind || row.kind === kind)
    .filter((row) => !section || row.section === section)
    .slice(0, capped)
    .map(publicContribution)
}
