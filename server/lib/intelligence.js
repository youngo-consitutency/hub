import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './store.js'
import { getPool } from './db.js'
import { hasCapability } from './access.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const writebacksPath = path.join(
  here,
  '../../data/intelligence-writebacks.json',
)
const queriesPath = path.join(here, '../../data/intelligence-queries.json')

export const INTELLIGENCE_FIELD_POLICY = Object.freeze({
  public: [
    'title',
    'description',
    'summary',
    'status',
    'dates',
    'working_group',
    'public_contact',
    'canonical_url',
  ],
  member: ['public', 'own_role', 'own_assignments'],
  mandate: ['member', 'directory_person_name', 'directory_channel'],
  operations: ['mandate', 'workflow_state', 'operational_deadlines'],
  alwaysExcluded: [
    'password_hash',
    'password_salt',
    'session_token',
    'email',
    'phone',
    'date_of_birth',
    'guardian_name',
    'guardian_email',
    'minority_groups',
    'coi_details',
    'raw_account_record',
  ],
})

const TYPE_PATH = {
  event: '/calendar/',
  submission: '/submissions/',
  decision: '/council/',
  coy: '/coys/',
  group: '/groups/',
  contact: '/directory',
  statement: '/gys',
  assignment: '/search',
}

function stableId(type, sourceId) {
  return `youngo-hub:${type}:${createHash('sha256').update(String(sourceId)).digest('hex').slice(0, 16)}`
}

function text(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(' ')
  if (value && typeof value === 'object')
    return Object.values(value).map(text).join(' ')
  return value == null ? '' : String(value)
}

function makeEvidence(type, sourceId, title, body, options = {}) {
  const cleanBody = text(body).replace(/\s+/g, ' ').trim()
  return {
    id: stableId(type, sourceId),
    source: 'youngo-hub',
    sourceType: type,
    sourceId: String(sourceId),
    title: String(title || sourceId),
    text: cleanBody,
    snippet: cleanBody.slice(0, 420),
    url: `${TYPE_PATH[type] || '/'}${TYPE_PATH[type]?.endsWith('/') ? encodeURIComponent(sourceId) : ''}`,
    timestamp: options.timestamp || null,
    audience: options.audience || 'public',
    metadata: options.metadata || {},
  }
}

export function buildPublicEvidence() {
  const evidence = []
  for (const item of store.listEvents())
    evidence.push(
      makeEvidence(
        'event',
        item.slug,
        item.title,
        [
          item.description,
          item.type,
          item.wg?.name,
          item.startsAt,
          item.endsAt,
        ],
        {
          timestamp: item.startsAt,
          metadata: { status: 'scheduled', wg: item.wg?.slug || null },
        },
      ),
    )
  for (const item of [
    ...store.listSubmissions('open'),
    ...store.listSubmissions('archive'),
  ])
    evidence.push(
      makeEvidence(
        'submission',
        item.slug,
        item.title,
        [item.status, item.contributeNote, item.wg?.name, item.deadlineAt],
        {
          timestamp: item.deadlineAt,
          metadata: { status: item.status, wg: item.wg?.slug || null },
        },
      ),
    )
  for (const state of ['active', 'decided'])
    for (const item of store.listCouncil(state))
      evidence.push(
        makeEvidence(
          'decision',
          item.slug,
          item.title,
          [
            item.summary,
            item.status,
            item.proposer,
            item.respondNote,
            item.outcomeNote,
          ],
          {
            timestamp:
              item.decidedAt || item.inputDeadline || item.objectionDeadline,
            metadata: { status: item.status },
          },
        ),
      )
  for (const item of store.listCoys())
    evidence.push(
      makeEvidence(
        'coy',
        item.slug,
        item.title,
        [
          item.type,
          item.status,
          item.city,
          item.country,
          item.region,
          item.startsOn,
          item.endsOn,
        ],
        {
          timestamp: item.startsOn || null,
          metadata: { status: item.status, region: item.region || null },
        },
      ),
    )
  for (const item of store.listGroups())
    evidence.push(
      makeEvidence(
        'group',
        item.slug,
        item.name,
        [item.focusLine, item.description],
        { metadata: { status: item.isActive ? 'active' : 'inactive' } },
      ),
    )
  for (const [index, item] of store.listDirectory({ member: false }).entries())
    evidence.push(
      makeEvidence(
        'contact',
        `${item.wg?.slug || 'general'}-${index}`,
        item.roleTitle,
        [item.description, item.group, item.publicEmail, item.wg?.name],
        { metadata: { wg: item.wg?.slug || null, publicContact: true } },
      ),
    )
  const gys = store.getGys()
  if (gys)
    evidence.push(
      makeEvidence(
        'statement',
        gys.slug || 'global-youth-statement',
        gys.title || 'Global Youth Statement',
        gys,
        { metadata: { status: gys.status || 'reference' } },
      ),
    )
  return dedupe(evidence)
}

export function buildPrivateEvidence({ account, access }) {
  const evidence = []
  if (account && access) {
    evidence.push(
      makeEvidence(
        'assignment',
        account.id,
        'My YOUNGO Hub roles and assignments',
        [
          `Platform role ${account.role || 'member'}.`,
          access.teamRoles?.length
            ? `Team assignments: ${access.teamRoles.join(', ')}.`
            : 'No team assignments.',
          access.wgAssignments?.length
            ? `Working group assignments: ${access.wgAssignments.map((x) => `${x.wgSlug} (${x.role})`).join(', ')}.`
            : 'No working group management assignments.',
        ],
        { audience: 'member', metadata: { ownerAccountId: account.id } },
      ),
    )
  }
  if (hasCapability(access, 'intelligence.contacts.read')) {
    for (const [index, item] of store
      .listDirectory({ member: true })
      .entries()) {
      evidence.push(
        makeEvidence(
          'contact',
          `member-${item.wg?.slug || 'general'}-${index}`,
          item.roleTitle,
          [
            item.description,
            item.group,
            item.personName,
            item.channelValue,
            item.wg?.name,
          ],
          {
            audience: 'mandate',
            metadata: { wg: item.wg?.slug || null, memberContact: true },
          },
        ),
      )
    }
  }
  return evidence
}

function dedupe(items) {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

function tokens(value) {
  return text(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((x) => x.length > 1)
}

function rankList(items, scoreFn) {
  return items
    .map((value) => ({ item: value.item || value, raw: scoreFn(value) }))
    .filter((x) => x.raw > 0)
    .sort((a, b) => b.raw - a.raw || a.item.id.localeCompare(b.item.id))
}

export function retrieveEvidence(query, evidence, { limit = 8 } = {}) {
  const q = String(query || '').trim()
  const qTokens = [...new Set(tokens(q))]
  if (!qTokens.length) return []
  const corpus = evidence.map((item) => ({
    item,
    haystack: `${item.title} ${item.text}`.toLowerCase(),
    itemTokens: tokens(`${item.title} ${item.text}`),
  }))
  const documentFrequency = new Map(
    qTokens.map((token) => [
      token,
      corpus.filter((x) => x.itemTokens.includes(token)).length,
    ]),
  )
  const lists = [
    rankList(corpus, (x) => (x.haystack.includes(q.toLowerCase()) ? 4 : 0)),
    rankList(
      corpus,
      (x) =>
        qTokens.filter((token) => x.itemTokens.includes(token)).length /
        qTokens.length,
    ),
    rankList(corpus, (x) =>
      qTokens.reduce(
        (sum, token) =>
          sum +
          (x.itemTokens.includes(token)
            ? Math.log(
                (corpus.length + 1) / ((documentFrequency.get(token) || 0) + 1),
              ) + 1
            : 0),
        0,
      ),
    ),
    rankList(corpus, (x) =>
      qTokens.reduce(
        (sum, token) =>
          sum + (x.item.title.toLowerCase().includes(token) ? 1 : 0),
        0,
      ),
    ),
  ]
  const merged = new Map()
  for (const list of lists)
    list.slice(0, 40).forEach(({ item }, rank) => {
      const current = merged.get(item.id) || { ...item, score: 0, signals: [] }
      current.score += 1 / (60 + rank + 1)
      current.signals.push(
        ['phrase', 'coverage', 'idf', 'title'][lists.indexOf(list)],
      )
      merged.set(item.id, current)
    })
  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.min(Math.max(Number(limit) || 8, 1), 20))
    .map((item) => ({ ...item, score: Number(item.score.toFixed(6)) }))
}

export function synthesizeEvidence(
  query,
  evidence,
  { audience = 'public' } = {},
) {
  const citations = evidence.slice(0, 5).map((item, index) => ({
    index: index + 1,
    evidenceId: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
  }))
  const bullets = evidence.slice(0, 5).map((item, index) => ({
    text: `${item.title}: ${item.snippet || 'Relevant Hub record.'}`,
    citationIndexes: [index + 1],
  }))
  return {
    answer: bullets.length
      ? `The Hub found ${evidence.length} relevant evidence item${evidence.length === 1 ? '' : 's'} for “${String(query).trim()}”.`
      : `The Hub did not find evidence for “${String(query).trim()}”.`,
    bullets,
    citations,
    confidence:
      evidence.length >= 3
        ? 'medium'
        : evidence.length
          ? 'low'
          : 'insufficient',
    caveat:
      'This is extractive synthesis from indexed Hub records, not an authoritative decision. Open the citations and verify dates and status before acting.',
    audience,
  }
}

export function queryIntelligence({
  query,
  account = null,
  access = null,
  limit = 8,
}) {
  const privateEvidence = account
    ? buildPrivateEvidence({ account, access })
    : []
  const evidence = retrieveEvidence(
    query,
    [...buildPublicEvidence(), ...privateEvidence],
    { limit },
  )
  const audience = hasCapability(access, 'intelligence.operations.read')
    ? 'operations'
    : hasCapability(access, 'intelligence.contacts.read')
      ? 'mandate'
      : account
        ? 'member'
        : 'public'
  return {
    query: String(query).trim(),
    audience,
    evidence,
    synthesis: synthesizeEvidence(query, evidence, { audience }),
    policy: {
      audience,
      alwaysExcluded: INTELLIGENCE_FIELD_POLICY.alwaysExcluded,
      indexedSources: [
        'events',
        'submissions',
        'council',
        'coys',
        'working_groups',
        'directory',
        'gys',
        ...(account ? ['own_assignments'] : []),
      ],
    },
  }
}

export async function recordIntelligenceQuery({
  actorId = null,
  audience,
  query,
  resultCount,
  requestId,
}) {
  const entry = {
    actorId,
    audience,
    query: String(query),
    resultCount: Number(resultCount) || 0,
    requestId: requestId || null,
    createdAt: new Date().toISOString(),
  }
  const pool = getPool()
  if (pool) {
    await pool.query(
      'INSERT INTO intelligence_queries(actor_id,audience,query_text,result_count,request_id) VALUES($1,$2,$3,$4,$5)',
      [actorId, audience, entry.query, entry.resultCount, entry.requestId],
    )
    return entry
  }
  const items = readJsonArray(queriesPath)
  items.unshift(entry)
  writeFileSync(queriesPath, JSON.stringify(items.slice(0, 2000), null, 2))
  return entry
}

export async function getIntelligenceMetrics() {
  const pool = getPool()
  if (pool) {
    const [queries, writebacks] = await Promise.all([
      pool.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS last_24h, round(avg(result_count)::numeric,2) AS average_results FROM intelligence_queries`,
      ),
      pool.query(
        `SELECT status, count(*)::int AS count FROM intelligence_writebacks GROUP BY status ORDER BY status`,
      ),
    ])
    return {
      queries: queries.rows[0],
      writebacks: writebacks.rows,
      generatedAt: new Date().toISOString(),
    }
  }
  const queries = readJsonArray(queriesPath)
  const writebacks = readWritebacks()
  const counts = new Map()
  for (const item of writebacks)
    counts.set(item.status, (counts.get(item.status) || 0) + 1)
  return {
    queries: {
      total: queries.length,
      last_24h: queries.filter(
        (x) => Date.now() - new Date(x.createdAt) < 86_400_000,
      ).length,
      average_results: queries.length
        ? Number(
            (
              queries.reduce((sum, x) => sum + x.resultCount, 0) /
              queries.length
            ).toFixed(2),
          )
        : 0,
    },
    writebacks: [...counts].map(([status, count]) => ({ status, count })),
    generatedAt: new Date().toISOString(),
  }
}

function readJsonArray(filePath) {
  try {
    const value = existsSync(filePath)
      ? JSON.parse(readFileSync(filePath, 'utf8'))
      : []
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
function readWritebacks() {
  return readJsonArray(writebacksPath)
}
function saveWritebacks(items) {
  writeFileSync(writebacksPath, JSON.stringify(items, null, 2))
}

export function validateWritebackPayload(payload) {
  if (payload?.action !== 'save_research_note')
    return { ok: false, error: 'Only save_research_note is allowed.' }
  const title = String(payload.title || '').trim()
  const body = String(payload.body || '').trim()
  const citations = Array.isArray(payload.citations)
    ? payload.citations.map(String).filter(Boolean).slice(0, 20)
    : []
  if (title.length < 3 || title.length > 160)
    return { ok: false, error: 'Title must be 3–160 characters.' }
  if (body.length < 10 || body.length > 5000)
    return { ok: false, error: 'Body must be 10–5000 characters.' }
  if (!citations.length)
    return { ok: false, error: 'At least one evidence citation is required.' }
  return {
    ok: true,
    value: { action: 'save_research_note', title, body, citations },
  }
}

export function canApproveWriteback(writeback, actorId) {
  return Boolean(
    writeback &&
    writeback.status === 'proposed' &&
    actorId &&
    writeback.proposedBy !== actorId,
  )
}

export async function createWriteback({ actorId, idempotencyKey, payload }) {
  const validated = validateWritebackPayload(payload)
  if (!validated.ok) {
    const error = new Error(validated.error)
    error.code = 'validation'
    throw error
  }
  const key = String(idempotencyKey || '').trim()
  if (key.length < 8 || key.length > 160) {
    const error = new Error(
      'An idempotency key of 8–160 characters is required.',
    )
    error.code = 'validation'
    throw error
  }
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO intelligence_writebacks(proposed_by,idempotency_key,action,payload) VALUES($1,$2,$3,$4) ON CONFLICT(proposed_by,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING *`,
      [actorId, key, validated.value.action, validated.value],
    )
    return rows[0]
  }
  const items = readWritebacks()
  const existing = items.find(
    (x) => x.proposedBy === actorId && x.idempotencyKey === key,
  )
  if (existing) return existing
  const item = {
    id: randomUUID(),
    proposedBy: actorId,
    idempotencyKey: key,
    action: validated.value.action,
    payload: validated.value,
    status: 'proposed',
    proposedAt: new Date().toISOString(),
  }
  items.unshift(item)
  saveWritebacks(items)
  return item
}

export async function getWriteback(id) {
  const pool = getPool()
  if (pool)
    return (
      (
        await pool.query('SELECT * FROM intelligence_writebacks WHERE id=$1', [
          id,
        ])
      ).rows[0] || null
    )
  return readWritebacks().find((x) => x.id === id) || null
}

export async function listWritebacks({
  actorId,
  canReview = false,
  limit = 100,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT * FROM intelligence_writebacks WHERE ($1::boolean OR proposed_by=$2) ORDER BY proposed_at DESC LIMIT $3`,
      [Boolean(canReview), actorId, safeLimit],
    )
    return rows
  }
  return readWritebacks()
    .filter((item) => canReview || item.proposedBy === actorId)
    .slice(0, safeLimit)
}

export async function approveWriteback({ id, actorId, reason }) {
  const current = await getWriteback(id)
  const proposedBy = current?.proposed_by || current?.proposedBy
  if (
    !canApproveWriteback(
      current && { ...current, proposedBy, status: current.status },
      actorId,
    )
  ) {
    const error = new Error(
      'A different admin must approve a proposed writeback.',
    )
    error.code = 'separation_of_duties'
    throw error
  }
  const cleanReason = String(reason || '').trim()
  if (cleanReason.length < 8) {
    const error = new Error('Approval reason must be at least 8 characters.')
    error.code = 'validation'
    throw error
  }
  const pool = getPool()
  if (pool)
    return (
      await pool.query(
        `UPDATE intelligence_writebacks SET status='approved',approved_by=$2,approval_reason=$3,approved_at=now(),updated_at=now() WHERE id=$1 AND status='proposed' RETURNING *`,
        [id, actorId, cleanReason],
      )
    ).rows[0]
  const items = readWritebacks()
  const item = items.find((x) => x.id === id)
  Object.assign(item, {
    status: 'approved',
    approvedBy: actorId,
    approvalReason: cleanReason,
    approvedAt: new Date().toISOString(),
  })
  saveWritebacks(items)
  return item
}

export async function applyWriteback({ id, actorId }) {
  const current = await getWriteback(id)
  if (!current || current.status !== 'approved') {
    const error = new Error(
      'Writeback must be approved before it can be applied.',
    )
    error.code = 'not_approved'
    throw error
  }
  const payload = current.payload
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const note = (
        await client.query(
          `INSERT INTO intelligence_notes(title,body,citations,created_by,writeback_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(writeback_id) DO UPDATE SET writeback_id=EXCLUDED.writeback_id RETURNING *`,
          [payload.title, payload.body, payload.citations, actorId, id],
        )
      ).rows[0]
      const writeback = (
        await client.query(
          `UPDATE intelligence_writebacks SET status='applied',applied_by=$2,applied_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,
          [id, actorId],
        )
      ).rows[0]
      await client.query('COMMIT')
      return { writeback, note }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  const items = readWritebacks()
  const item = items.find((x) => x.id === id)
  Object.assign(item, {
    status: 'applied',
    appliedBy: actorId,
    appliedAt: new Date().toISOString(),
    note: { id: stableId('note', id), ...payload },
  })
  saveWritebacks(items)
  return { writeback: item, note: item.note }
}
