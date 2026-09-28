// Google Forms CSV → GYS contribution mapping (heuristic + override).
import { createHash } from 'node:crypto'
import Papa from 'papaparse'

const FIELD_PATTERNS = {
  timestamp: [/^timestamp$/i, /^submitted?\s*at$/i],
  email: [/^email/i, /e-?mail\s*address/i],
  name: [/^name$/i, /^full\s*name$/i, /^your\s*name$/i],
  country: [/^country/i, /country\s*of\s*residence/i],
  region: [/^region/i, /^unfccc\s*region/i, /geographic\s*region/i],
  organization: [
    /^organisation$/i,
    /^organization$/i,
    /organisation\s*name/i,
    /organization\s*name/i,
  ],
  submitterType: [
    /submitter\s*type/i,
    /type\s*of\s*submission/i,
    /are\s*you\s*submitting/i,
    /submitting\s*as/i,
  ],
  theme: [
    /^theme$/i,
    /^topic$/i,
    /thematic\s*area/i,
    /policy\s*area/i,
    /working\s*group/i,
  ],
  body: [
    /policy\s*recommend/i,
    /demand/i,
    /proposal/i,
    /input/i,
    /contribution/i,
    /what\s*should/i,
    /your\s*(message|statement|text)/i,
    /describe/i,
  ],
  title: [/^title$/i, /headline/i, /summary\s*title/i],
}

export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  if (!source.trim()) return { headers: [], rows: [] }
  const { data } = Papa.parse(source, { skipEmptyLines: 'greedy' })
  const headers = (data.shift() || []).map((h) => String(h || '').trim())
  const objects = data.map((cells) => {
    const obj = {}
    headers.forEach((header, index) => {
      obj[header] = String(cells[index] ?? '').trim()
    })
    return obj
  })
  return { headers, rows: objects }
}

function matchField(header, patterns) {
  return patterns.some((pattern) => pattern.test(header))
}

export function detectColumnMap(headers, overrides = {}) {
  const map = {
    timestamp: null,
    email: null,
    name: null,
    country: null,
    region: null,
    organization: null,
    submitterType: null,
    theme: null,
    body: null,
    title: null,
    ...Object.fromEntries(
      Object.entries(overrides || {}).filter(([, value]) => value != null),
    ),
  }

  for (const header of headers) {
    for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
      if (map[field]) continue
      if (matchField(header, patterns)) map[field] = header
    }
  }

  // Prefer the longest unmatched free-text column for body if still unset.
  if (!map.body) {
    const used = new Set(Object.values(map).filter(Boolean))
    const candidates = headers.filter((header) => !used.has(header))
    map.body =
      candidates.sort((a, b) => b.length - a.length)[0] ||
      headers[headers.length - 1] ||
      null
  }

  return map
}

function cell(row, key) {
  if (!key) return ''
  return String(row[key] ?? '').trim()
}

export function externalIdForRow(row, map) {
  const parts = [
    cell(row, map.timestamp),
    cell(row, map.email),
    cell(row, map.name),
    cell(row, map.body),
    cell(row, map.title),
  ]
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32)
}

export function mapRowToContribution(row, map, index = 0) {
  const body = cell(row, map.body)
  const name = cell(row, map.name)
  const theme = cell(row, map.theme)
  const title =
    cell(row, map.title) ||
    (theme ? `${theme} input` : null) ||
    (name ? `Input from ${name}` : null) ||
    `Imported input ${index + 1}`

  if (!body) {
    return {
      ok: false,
      error: 'Missing contribution text (body column).',
    }
  }

  const externalId = externalIdForRow(row, map)
  return {
    ok: true,
    contribution: {
      title: title.slice(0, 240),
      body: body.slice(0, 20000),
      theme: theme.slice(0, 120) || null,
      region: cell(row, map.region).slice(0, 120) || null,
      country: cell(row, map.country).slice(0, 120) || null,
      submitterType: cell(row, map.submitterType).slice(0, 120) || null,
      organization: cell(row, map.organization).slice(0, 240) || null,
      source: 'google_form_csv',
      externalId,
      rawAnswers: { ...row },
    },
  }
}

export function previewCsvImport(csvText, columnMap = {}) {
  const { headers, rows } = parseCsv(csvText)
  if (!headers.length) {
    return {
      ok: false,
      error: 'CSV is empty or missing a header row.',
      headers: [],
      columnMap: {},
      preview: [],
    }
  }
  const map = detectColumnMap(headers, columnMap)
  const preview = []
  const errors = []
  rows.slice(0, 8).forEach((row, index) => {
    const mapped = mapRowToContribution(row, map, index)
    if (!mapped.ok) {
      errors.push({ row: index + 2, message: mapped.error })
      return
    }
    preview.push({
      externalId: mapped.contribution.externalId,
      title: mapped.contribution.title,
      theme: mapped.contribution.theme,
      region: mapped.contribution.region,
      country: mapped.contribution.country,
      submitterType: mapped.contribution.submitterType,
      organization: mapped.contribution.organization,
      bodyPreview: mapped.contribution.body.slice(0, 180),
    })
  })
  return {
    ok: true,
    headers,
    columnMap: map,
    rowCount: rows.length,
    preview,
    errors,
  }
}

export function contributionsFromCsv(csvText, columnMap = {}) {
  const { headers, rows } = parseCsv(csvText)
  if (!headers.length) {
    const error = new Error('CSV is empty or missing a header row.')
    error.code = 'validation'
    throw error
  }
  const map = detectColumnMap(headers, columnMap)
  const contributions = []
  const errors = []
  rows.forEach((row, index) => {
    const mapped = mapRowToContribution(row, map, index)
    if (!mapped.ok) {
      errors.push({ row: index + 2, message: mapped.error })
      return
    }
    contributions.push(mapped.contribution)
  })
  return { columnMap: map, contributions, errors }
}
