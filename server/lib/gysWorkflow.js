import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { contributionsFromCsv } from './gysImport.js'
import { synthesizeGysContributions } from './gysSynthesis.js'

const file = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/gys-workflow.json',
)
const STATUSES = [
  'submitted',
  'triaged',
  'drafting',
  'needs_review',
  'approved',
  'rejected',
  'published',
]
const TRANSITIONS = {
  submitted: ['triaged', 'rejected'],
  triaged: ['drafting', 'rejected'],
  drafting: ['needs_review'],
  needs_review: ['drafting', 'approved', 'rejected'],
  approved: ['published', 'drafting'],
  rejected: ['triaged'],
  published: [],
}

function readFixture() {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* empty */
  }
  return { cycles: [], contributions: [], reviews: [], statusLog: [] }
}

function writeFixture(data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function publicContribution(row) {
  return {
    id: row.id,
    cycleId: row.cycle_id ?? row.cycleId,
    title: row.title,
    body: row.body,
    theme: row.theme || null,
    region: row.region || null,
    country: row.country || null,
    submitterType: row.submitter_type ?? row.submitterType ?? null,
    organization: row.organization || null,
    source: row.source || 'manual',
    externalId: row.external_id ?? row.externalId ?? null,
    authorId: row.author_id ?? row.authorId ?? null,
    reviewerId: row.reviewer_id ?? row.reviewerId ?? null,
    status: row.status,
    version: row.version,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
}

function publicCycle(row) {
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    year: row.year,
    status: row.status,
    opensAt: row.opens_at ?? row.opensAt ?? null,
    closesAt: row.closes_at ?? row.closesAt ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
}

export async function getGysWorkflow() {
  const pool = getPool()
  if (pool) {
    let cycle = (
      await pool.query(
        `SELECT * FROM gys_cycles WHERE status != 'archived' ORDER BY year DESC, created_at DESC LIMIT 1`,
      )
    ).rows[0]
    if (!cycle) {
      cycle = (
        await pool.query(
          `INSERT INTO gys_cycles(code,title,year,status) VALUES($1,$2,$3,'intake')
         ON CONFLICT(code) DO UPDATE SET title=EXCLUDED.title RETURNING *`,
          [
            `gys-${new Date().getFullYear()}`,
            `Global Youth Statement ${new Date().getFullYear()}`,
            new Date().getFullYear(),
          ],
        )
      ).rows[0]
    }
    const { rows } = await pool.query(
      `SELECT * FROM gys_contributions WHERE cycle_id=$1 ORDER BY updated_at DESC`,
      [cycle.id],
    )
    const contributions = rows.map(publicContribution)
    return {
      cycle: publicCycle(cycle),
      contributions,
      statuses: STATUSES,
      synthesis: synthesizeGysContributions(contributions),
    }
  }
  const data = readFixture()
  let cycle = data.cycles.find((item) => item.status !== 'archived')
  if (!cycle) {
    cycle = {
      id: randomUUID(),
      code: `gys-${new Date().getFullYear()}`,
      title: `Global Youth Statement ${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      status: 'intake',
      createdAt: new Date().toISOString(),
    }
    data.cycles.push(cycle)
    writeFixture(data)
  }
  const contributions = data.contributions
    .filter((item) => item.cycleId === cycle.id)
    .map(publicContribution)
  return {
    cycle: publicCycle(cycle),
    contributions,
    statuses: STATUSES,
    synthesis: synthesizeGysContributions(contributions),
  }
}

function cleanContributionInput({
  title,
  body,
  theme,
  region,
  country,
  submitterType,
  organization,
  source = 'manual',
  externalId = null,
  rawAnswers = null,
}) {
  if (!String(title || '').trim() || !String(body || '').trim()) {
    const error = new Error('Title and contribution text are required.')
    error.code = 'validation'
    throw error
  }
  return {
    title: String(title).trim().slice(0, 240),
    body: String(body).trim().slice(0, 20000),
    theme:
      String(theme || '')
        .trim()
        .slice(0, 120) || null,
    region:
      String(region || '')
        .trim()
        .slice(0, 120) || null,
    country:
      String(country || '')
        .trim()
        .slice(0, 120) || null,
    submitterType:
      String(submitterType || '')
        .trim()
        .slice(0, 120) || null,
    organization:
      String(organization || '')
        .trim()
        .slice(0, 240) || null,
    source: source === 'google_form_csv' ? 'google_form_csv' : 'manual',
    externalId: externalId ? String(externalId).slice(0, 64) : null,
    rawAnswers:
      rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : null,
  }
}

export async function createGysContribution({
  title,
  body,
  theme,
  region,
  country,
  submitterType,
  organization,
  source,
  externalId,
  rawAnswers,
  authorId,
}) {
  const clean = cleanContributionInput({
    title,
    body,
    theme,
    region,
    country,
    submitterType,
    organization,
    source,
    externalId,
    rawAnswers,
  })
  const { cycle } = await getGysWorkflow()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO gys_contributions(
         cycle_id,title,body,theme,region,country,author_id,
         source,external_id,submitter_type,organization,raw_answers
       )
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        cycle.id,
        clean.title,
        clean.body,
        clean.theme,
        clean.region,
        clean.country,
        authorId,
        clean.source,
        clean.externalId,
        clean.submitterType,
        clean.organization,
        clean.rawAnswers,
      ],
    )
    await pool.query(
      `INSERT INTO gys_status_log(contribution_id,to_status,changed_by) VALUES($1,'submitted',$2)`,
      [rows[0].id, authorId],
    )
    return publicContribution(rows[0])
  }
  const data = readFixture()
  const now = new Date().toISOString()
  const row = {
    id: randomUUID(),
    cycleId: cycle.id,
    ...clean,
    authorId,
    reviewerId: null,
    status: 'submitted',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  data.contributions.unshift(row)
  data.statusLog.unshift({
    contributionId: row.id,
    fromStatus: null,
    toStatus: 'submitted',
    changedBy: authorId,
    createdAt: now,
  })
  writeFixture(data)
  return publicContribution(row)
}

export async function importGysContributionsFromCsv({
  csvText,
  columnMap,
  authorId,
}) {
  const parsed = contributionsFromCsv(csvText, columnMap)
  const { cycle } = await getGysWorkflow()
  let imported = 0
  let skipped = 0
  const created = []
  const pool = getPool()

  if (pool) {
    for (const item of parsed.contributions) {
      const existing = await pool.query(
        `SELECT id FROM gys_contributions WHERE cycle_id=$1 AND external_id=$2 LIMIT 1`,
        [cycle.id, item.externalId],
      )
      if (existing.rows[0]) {
        skipped += 1
        continue
      }
      try {
        const { rows } = await pool.query(
          `INSERT INTO gys_contributions(
             cycle_id,title,body,theme,region,country,author_id,
             source,external_id,submitter_type,organization,raw_answers
           )
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [
            cycle.id,
            item.title,
            item.body,
            item.theme,
            item.region,
            item.country,
            authorId,
            item.source,
            item.externalId,
            item.submitterType,
            item.organization,
            item.rawAnswers,
          ],
        )
        await pool.query(
          `INSERT INTO gys_status_log(contribution_id,to_status,changed_by) VALUES($1,'submitted',$2)`,
          [rows[0].id, authorId],
        )
        created.push(publicContribution(rows[0]))
        imported += 1
      } catch (error) {
        if (error.code === '23505') {
          skipped += 1
          continue
        }
        throw error
      }
    }
  } else {
    const data = readFixture()
    const existing = new Set(
      data.contributions
        .filter((item) => item.cycleId === cycle.id && item.externalId)
        .map((item) => item.externalId),
    )
    const now = new Date().toISOString()
    for (const item of parsed.contributions) {
      if (existing.has(item.externalId)) {
        skipped += 1
        continue
      }
      const row = {
        id: randomUUID(),
        cycleId: cycle.id,
        title: item.title,
        body: item.body,
        theme: item.theme,
        region: item.region,
        country: item.country,
        submitterType: item.submitterType,
        organization: item.organization,
        source: item.source,
        externalId: item.externalId,
        rawAnswers: item.rawAnswers,
        authorId,
        reviewerId: null,
        status: 'submitted',
        version: 1,
        createdAt: now,
        updatedAt: now,
      }
      data.contributions.unshift(row)
      data.statusLog.unshift({
        contributionId: row.id,
        fromStatus: null,
        toStatus: 'submitted',
        changedBy: authorId,
        createdAt: now,
      })
      existing.add(item.externalId)
      created.push(publicContribution(row))
      imported += 1
    }
    writeFixture(data)
  }

  if (imported > 0) await setGysCycleStatus('synthesis')

  return {
    imported,
    skipped,
    errors: parsed.errors,
    columnMap: parsed.columnMap,
    contributions: created,
  }
}

export async function setGysCycleStatus(status) {
  const allowed = [
    'planning',
    'intake',
    'synthesis',
    'review',
    'consultation',
    'approved',
    'published',
    'archived',
  ]
  if (!allowed.includes(status)) {
    const error = new Error('Invalid cycle status.')
    error.code = 'validation'
    throw error
  }
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE gys_cycles SET status=$1, updated_at=now()
       WHERE id = (
         SELECT id FROM gys_cycles WHERE status != 'archived'
         ORDER BY year DESC, created_at DESC LIMIT 1
       )
       RETURNING *`,
      [status],
    )
    return publicCycle(rows[0] || null)
  }
  const data = readFixture()
  const cycle = data.cycles.find((item) => item.status !== 'archived')
  if (!cycle) return null
  cycle.status = status
  cycle.updatedAt = new Date().toISOString()
  writeFixture(data)
  return publicCycle(cycle)
}

export async function updateGysContribution({
  id,
  status,
  reviewerId,
  actorId,
  note,
  decision,
}) {
  if (!STATUSES.includes(status)) {
    const error = new Error('Invalid contribution status.')
    error.code = 'validation'
    throw error
  }
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const current = (
        await client.query(
          'SELECT * FROM gys_contributions WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0]
      if (!current) {
        await client.query('ROLLBACK')
        return null
      }
      if (
        status !== current.status &&
        !TRANSITIONS[current.status]?.includes(status)
      ) {
        const error = new Error(
          `Cannot move from ${current.status} to ${status}.`,
        )
        error.code = 'validation'
        throw error
      }
      const updated = (
        await client.query(
          `UPDATE gys_contributions SET status=$2, reviewer_id=COALESCE($3,reviewer_id), version=version+1, updated_at=now() WHERE id=$1 RETURNING *`,
          [id, status, reviewerId || null],
        )
      ).rows[0]
      if (status !== current.status)
        await client.query(
          `INSERT INTO gys_status_log(contribution_id,from_status,to_status,changed_by,note) VALUES($1,$2,$3,$4,$5)`,
          [id, current.status, status, actorId, note || null],
        )
      if (decision)
        await client.query(
          `INSERT INTO gys_reviews(contribution_id,reviewer_id,decision,note) VALUES($1,$2,$3,$4)`,
          [id, actorId, decision, note || null],
        )
      await client.query('COMMIT')
      return {
        before: publicContribution(current),
        contribution: publicContribution(updated),
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  const data = readFixture()
  const row = data.contributions.find((item) => item.id === id)
  if (!row) return null
  if (status !== row.status && !TRANSITIONS[row.status]?.includes(status)) {
    const error = new Error(`Cannot move from ${row.status} to ${status}.`)
    error.code = 'validation'
    throw error
  }
  const before = publicContribution(row)
  const now = new Date().toISOString()
  if (status !== row.status)
    data.statusLog.unshift({
      contributionId: id,
      fromStatus: row.status,
      toStatus: status,
      changedBy: actorId,
      note: note || null,
      createdAt: now,
    })
  row.status = status
  row.reviewerId = reviewerId || row.reviewerId
  row.version += 1
  row.updatedAt = now
  if (decision)
    data.reviews.unshift({
      id: randomUUID(),
      contributionId: id,
      reviewerId: actorId,
      decision,
      note: note || null,
      createdAt: now,
    })
  writeFixture(data)
  return { before, contribution: publicContribution(row) }
}
