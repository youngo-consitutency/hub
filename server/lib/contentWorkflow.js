import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import {
  getLiveContent,
  setPublishedContent,
  setUnpublishedContent,
} from './store.js'
import {
  ANNOUNCEMENT_PATCH_FIELDS,
  EVENT_PATCH_FIELDS,
  LIVE_CONTENT_TYPES,
  normalizeWorkingGroupRef,
  validateEditableContent,
} from '../../shared/contentValidation.js'

const defaultDataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data',
)

function dataDir() {
  return process.env.CONTENT_WORKFLOW_DIR || defaultDataDir
}

function revisionsPath() {
  return path.join(dataDir(), 'content-revisions.json')
}

function publicationsPath() {
  return path.join(dataDir(), 'content-publications.json')
}

function readArray(file) {
  try {
    const value = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeArray(file, value) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 2))
}

function rowView(row) {
  if (!row) return null
  return {
    id: row.id,
    contentType: row.content_type ?? row.contentType,
    contentKey: row.content_key ?? row.contentKey,
    payload: row.payload,
    status: row.status,
    createdBy: row.created_by ?? row.createdBy,
    creatorName: row.creator_name ?? row.creatorName ?? null,
    creatorEmail: row.creator_email ?? row.creatorEmail ?? null,
    reviewedBy: row.reviewed_by ?? row.reviewedBy ?? null,
    reviewerName: row.reviewer_name ?? row.reviewerName ?? null,
    reviewNote: row.review_note ?? row.reviewNote ?? null,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    submittedAt: row.submitted_at ?? row.submittedAt ?? null,
    reviewedAt: row.reviewed_at ?? row.reviewedAt ?? null,
    publishedAt: row.published_at ?? row.publishedAt ?? null,
  }
}

function publicationView(row) {
  if (!row) return null
  return {
    contentType: row.content_type ?? row.contentType,
    contentKey: row.content_key ?? row.contentKey,
    payload: row.payload,
    revisionId: row.revision_id ?? row.revisionId,
    publishedBy: row.published_by ?? row.publishedBy,
    publishedAt: row.published_at ?? row.publishedAt,
    status: row.status || 'published',
    unpublishedBy: row.unpublished_by ?? row.unpublishedBy ?? null,
    unpublishedAt: row.unpublished_at ?? row.unpublishedAt ?? null,
    unpublishReason: row.unpublish_reason ?? row.unpublishReason ?? null,
  }
}

function workflowError(code, message, fields = null) {
  const error = new Error(message)
  error.code = code
  if (fields) error.fields = fields
  return error
}

function validatedPayload(contentType, payload, groupSlugs) {
  const result = validateEditableContent(contentType, payload, { groupSlugs })
  if (!result.ok) {
    throw workflowError(
      'validation',
      'Please correct the highlighted content fields.',
      result.errors,
    )
  }
  return result.value
}

function assertLiveContentType(contentType) {
  if (!LIVE_CONTENT_TYPES.includes(contentType)) {
    throw workflowError('validation', 'Choose event or announcement.', {
      contentType: 'contentType must be event or announcement.',
    })
  }
}

function patchFieldsFor(contentType) {
  return contentType === 'event'
    ? EVENT_PATCH_FIELDS
    : ANNOUNCEMENT_PATCH_FIELDS
}

function liveEditablePayload(contentType, live) {
  if (contentType === 'event') {
    return {
      slug: live.slug,
      title: live.title,
      type: live.type,
      startsAt: live.startsAt,
      endsAt: live.endsAt,
      description: live.description || '',
      wg: live.wg?.slug || live.wg || '',
      meetingUrl: live.meetingUrl || '',
      recordingUrl: live.recordingUrl || '',
    }
  }
  return {
    slug: live.slug,
    title: live.title,
    body: live.body,
    pinned: Boolean(live.pinned),
    ctaUrl: live.ctaUrl || '',
    ctaLabel: live.ctaLabel || '',
    ctaDeadlineAt: live.ctaDeadlineAt || '',
  }
}

function normalizePatch(contentType, slug, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw workflowError('validation', 'Send an object of fields to change.', {
      payload: 'Payload must be an object with at least one field.',
    })
  }
  const allowed = new Set(patchFieldsFor(contentType))
  const extra = Object.keys(payload).filter(
    (key) => key !== 'slug' && !allowed.has(key),
  )
  if (extra.length) {
    throw workflowError('validation', 'Unknown fields cannot be applied.', {
      payload: `Unsupported fields: ${extra.join(', ')}.`,
    })
  }
  const providedSlug = String(payload.slug || '')
    .trim()
    .toLowerCase()
  if (providedSlug && providedSlug !== slug) {
    throw workflowError(
      'validation',
      'Slug identifies the live item and cannot change.',
      { slug: 'Omit slug or send the existing live slug.' },
    )
  }
  const patch = {}
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue
    if (key === 'wg') {
      patch.wg = normalizeWorkingGroupRef(payload.wg)
      continue
    }
    if (key === 'pinned') {
      if (typeof payload.pinned !== 'boolean') {
        throw workflowError(
          'validation',
          'Please correct the highlighted content fields.',
          {
            pinned: 'pinned must be true or false.',
          },
        )
      }
      patch.pinned = payload.pinned
      continue
    }
    patch[key] = payload[key]
  }
  if (Object.keys(patch).length === 0) {
    throw workflowError('validation', 'Send at least one field to change.', {
      payload: 'Payload is empty.',
    })
  }
  return patch
}

function requireLiveItem(contentType, slug) {
  const live = getLiveContent(contentType, slug)
  if (!live) {
    throw workflowError('not_found', 'Live content not found.', {
      slug: `No live ${contentType} with slug "${slug}".`,
    })
  }
  return live
}

async function refreshLiveContent() {
  const items = await listContentPublications()
  setPublishedContent(items.filter((item) => item.status !== 'unpublished'))
  setUnpublishedContent(items.filter((item) => item.status === 'unpublished'))
  return items
}

function findPublicationIndex(publications, contentType, slug) {
  return publications.findIndex(
    (item) => item.contentType === contentType && item.contentKey === slug,
  )
}

async function getPublication(contentType, slug) {
  const pool = getPool()
  if (pool) {
    return publicationView(
      (
        await pool.query(
          `SELECT * FROM hub_content_publications
           WHERE content_type=$1 AND content_key=$2`,
          [contentType, slug],
        )
      ).rows[0],
    )
  }
  return publicationView(
    readArray(publicationsPath()).find(
      (item) => item.contentType === contentType && item.contentKey === slug,
    ),
  )
}

const UPSERT_PUBLICATION_SQL = `
INSERT INTO hub_content_publications(
  content_type,content_key,payload,revision_id,published_by,published_at,status,
  unpublished_by,unpublished_at,unpublish_reason
)
VALUES($1,$2,$3,$4,$5,now(),'published',NULL,NULL,NULL)
ON CONFLICT(content_type,content_key)
DO UPDATE SET payload=EXCLUDED.payload,revision_id=EXCLUDED.revision_id,
              published_by=EXCLUDED.published_by,published_at=now(),
              status='published',unpublished_by=NULL,unpublished_at=NULL,
              unpublish_reason=NULL
RETURNING *`

function publishedRecord({
  contentType,
  slug,
  payload,
  revisionId,
  actorId,
  now,
}) {
  return {
    contentType,
    contentKey: slug,
    payload,
    revisionId,
    publishedBy: actorId,
    publishedAt: now,
    status: 'published',
    unpublishedBy: null,
    unpublishedAt: null,
    unpublishReason: null,
  }
}

export async function listContentRevisions({
  actorId,
  canReview = false,
  contentType = null,
  limit = 200,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT r.*, creator.name AS creator_name, creator.email AS creator_email,
              reviewer.name AS reviewer_name
       FROM hub_content_revisions r
       JOIN hub_accounts creator ON creator.id=r.created_by
       LEFT JOIN hub_accounts reviewer ON reviewer.id=r.reviewed_by
       WHERE ($1::boolean OR r.created_by=$2) AND ($4::text IS NULL OR r.content_type=$4)
       ORDER BY r.updated_at DESC
       LIMIT $3`,
      [canReview, actorId, safeLimit, contentType],
    )
    return rows.map(rowView)
  }
  return readArray(revisionsPath())
    .filter(
      (item) =>
        (canReview || item.createdBy === actorId) &&
        (!contentType ||
          (item.contentType || item.content_type) === contentType),
    )
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, safeLimit)
    .map(rowView)
}

export async function getContentRevision(id) {
  const pool = getPool()
  if (pool) {
    return rowView(
      (
        await pool.query('SELECT * FROM hub_content_revisions WHERE id=$1', [
          id,
        ])
      ).rows[0],
    )
  }
  return rowView(readArray(revisionsPath()).find((item) => item.id === id))
}

export async function createContentRevision({
  actorId,
  contentType,
  payload,
  groupSlugs = [],
}) {
  const value = validatedPayload(contentType, payload, groupSlugs)
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO hub_content_revisions(content_type,content_key,payload,created_by)
       VALUES($1,$2,$3,$4)
       RETURNING *`,
      [contentType, value.slug, value, actorId],
    )
    return rowView(rows[0])
  }
  const items = readArray(revisionsPath())
  const item = {
    id: randomUUID(),
    contentType,
    contentKey: value.slug,
    payload: value,
    status: 'draft',
    createdBy: actorId,
    reviewedBy: null,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    reviewedAt: null,
    publishedAt: null,
  }
  items.unshift(item)
  writeArray(revisionsPath(), items)
  return rowView(item)
}

export async function updateContentRevision({
  id,
  actorId,
  payload,
  groupSlugs = [],
}) {
  const current = await getContentRevision(id)
  if (!current) throw workflowError('not_found', 'Content draft not found.')
  if (current.createdBy !== actorId)
    throw workflowError('forbidden', 'Only the draft author can edit it.')
  if (!['draft', 'changes_requested'].includes(current.status)) {
    throw workflowError(
      'invalid_status',
      'Only drafts or requested changes can be edited.',
    )
  }
  const value = validatedPayload(current.contentType, payload, groupSlugs)
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE hub_content_revisions
       SET content_key=$1,payload=$2,status='draft',reviewed_by=NULL,review_note=NULL,
           reviewed_at=NULL,updated_at=now()
       WHERE id=$3 AND created_by=$4 AND status IN ('draft','changes_requested')
       RETURNING *`,
      [value.slug, value, id, actorId],
    )
    if (!rows[0])
      throw workflowError(
        'conflict',
        'The draft changed before it could be saved.',
      )
    return rowView(rows[0])
  }
  const items = readArray(revisionsPath())
  const index = items.findIndex((item) => item.id === id)
  items[index] = {
    ...items[index],
    contentKey: value.slug,
    payload: value,
    status: 'draft',
    reviewedBy: null,
    reviewNote: null,
    reviewedAt: null,
    updatedAt: now,
  }
  writeArray(revisionsPath(), items)
  return rowView(items[index])
}

export async function submitContentRevision({ id, actorId }) {
  const current = await getContentRevision(id)
  if (!current) throw workflowError('not_found', 'Content draft not found.')
  if (current.createdBy !== actorId)
    throw workflowError('forbidden', 'Only the draft author can submit it.')
  if (!['draft', 'changes_requested'].includes(current.status)) {
    throw workflowError('invalid_status', 'This item is not ready to submit.')
  }
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE hub_content_revisions
       SET status='in_review',submitted_at=now(),updated_at=now()
       WHERE id=$1 AND created_by=$2 AND status IN ('draft','changes_requested')
       RETURNING *`,
      [id, actorId],
    )
    if (!rows[0])
      throw workflowError(
        'conflict',
        'The draft changed before it could be submitted.',
      )
    return rowView(rows[0])
  }
  const items = readArray(revisionsPath())
  const index = items.findIndex((item) => item.id === id)
  items[index] = {
    ...items[index],
    status: 'in_review',
    submittedAt: now,
    updatedAt: now,
  }
  writeArray(revisionsPath(), items)
  return rowView(items[index])
}

export async function reviewContentRevision({
  id,
  actorId,
  decision,
  note = '',
}) {
  const current = await getContentRevision(id)
  if (!current) throw workflowError('not_found', 'Content draft not found.')
  if (current.createdBy === actorId) {
    throw workflowError(
      'separation_of_duties',
      'A different publisher must review this draft.',
    )
  }
  if (current.status !== 'in_review')
    throw workflowError(
      'invalid_status',
      'Only submitted drafts can be reviewed.',
    )
  const cleanNote = String(note || '').trim()
  const status = {
    approve: 'approved',
    request_changes: 'changes_requested',
    reject: 'rejected',
  }[decision]
  if (!status)
    throw workflowError(
      'validation',
      'Choose approve, request changes, or reject.',
    )
  if (decision !== 'approve' && cleanNote.length < 3) {
    throw workflowError(
      'validation',
      'Explain the requested change or rejection.',
      { note: 'Add a short review note.' },
    )
  }
  if (cleanNote.length > 2000)
    throw workflowError(
      'validation',
      'Review note must be 2,000 characters or fewer.',
    )
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE hub_content_revisions
       SET status=$1,reviewed_by=$2,review_note=$3,reviewed_at=now(),updated_at=now()
       WHERE id=$4 AND status='in_review' AND created_by<>$2
       RETURNING *`,
      [status, actorId, cleanNote || null, id],
    )
    if (!rows[0])
      throw workflowError(
        'conflict',
        'The draft changed before the review was saved.',
      )
    return rowView(rows[0])
  }
  const items = readArray(revisionsPath())
  const index = items.findIndex((item) => item.id === id)
  items[index] = {
    ...items[index],
    status,
    reviewedBy: actorId,
    reviewNote: cleanNote || null,
    reviewedAt: now,
    updatedAt: now,
  }
  writeArray(revisionsPath(), items)
  return rowView(items[index])
}

export async function listContentPublications() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT * FROM hub_content_publications
       ORDER BY published_at DESC`,
    )
    return rows.map(publicationView)
  }
  return readArray(publicationsPath()).map(publicationView)
}

export async function publishContentRevision({ id, actorId }) {
  const current = await getContentRevision(id)
  if (!current) throw workflowError('not_found', 'Approved content not found.')
  if (current.createdBy === actorId) {
    throw workflowError(
      'separation_of_duties',
      'A different publisher must publish this draft.',
    )
  }
  if (current.status !== 'approved')
    throw workflowError(
      'invalid_status',
      'Only approved content can be published.',
    )
  const now = new Date().toISOString()
  const pool = getPool()
  let result
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const locked = rowView(
        (
          await client.query(
            `SELECT * FROM hub_content_revisions WHERE id=$1 FOR UPDATE`,
            [id],
          )
        ).rows[0],
      )
      if (!locked)
        throw workflowError('not_found', 'Approved content not found.')
      if (locked.createdBy === actorId)
        throw workflowError(
          'separation_of_duties',
          'A different publisher must publish this draft.',
        )
      if (locked.status !== 'approved')
        throw workflowError(
          'conflict',
          'The approval changed before publication.',
        )
      const { rows } = await client.query(UPSERT_PUBLICATION_SQL, [
        locked.contentType,
        locked.contentKey,
        locked.payload,
        locked.id,
        actorId,
      ])
      await client.query(
        `UPDATE hub_content_revisions
         SET status='published',published_at=now(),updated_at=now()
         WHERE id=$1`,
        [id],
      )
      await client.query('COMMIT')
      result = publicationView(rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    const revisions = readArray(revisionsPath())
    const revisionIndex = revisions.findIndex((item) => item.id === id)
    const publications = readArray(publicationsPath())
    const item = publishedRecord({
      contentType: current.contentType,
      slug: current.contentKey,
      payload: current.payload,
      revisionId: current.id,
      actorId,
      now,
    })
    const publicationIndex = findPublicationIndex(
      publications,
      item.contentType,
      item.contentKey,
    )
    if (publicationIndex >= 0) publications[publicationIndex] = item
    else publications.unshift(item)
    revisions[revisionIndex] = {
      ...revisions[revisionIndex],
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    }
    writeArray(publicationsPath(), publications)
    writeArray(revisionsPath(), revisions)
    result = publicationView(item)
  }
  await refreshLiveContent()
  return result
}

export async function getLiveContentRecord(contentType, slug) {
  assertLiveContentType(contentType)
  const key = String(slug || '').trim()
  const item = getLiveContent(contentType, key)
  if (!item) {
    throw workflowError('not_found', 'Live content not found.', {
      slug: `No live ${contentType} with slug "${key}".`,
    })
  }
  return {
    contentType,
    slug: item.slug,
    item,
    publication: await getPublication(contentType, item.slug),
  }
}

export async function draftLiveContentUpdate({
  contentType,
  slug,
  payload,
  actorId,
  groupSlugs = [],
}) {
  assertLiveContentType(contentType)
  const key = String(slug || '').trim()
  const live = requireLiveItem(contentType, key)
  const patch = normalizePatch(contentType, live.slug, payload)
  const value = validatedPayload(
    contentType,
    { ...liveEditablePayload(contentType, live), ...patch, slug: live.slug },
    groupSlugs,
  )
  return createContentRevision({
    actorId,
    contentType,
    payload: value,
    groupSlugs,
  })
}

export async function applyLiveContentUpdate({
  contentType,
  slug,
  payload,
  actorId,
  groupSlugs = [],
}) {
  assertLiveContentType(contentType)
  const key = String(slug || '').trim()
  const live = requireLiveItem(contentType, key)
  const before = liveEditablePayload(contentType, live)
  const patch = normalizePatch(contentType, live.slug, payload)
  const value = validatedPayload(
    contentType,
    { ...before, ...patch, slug: live.slug },
    groupSlugs,
  )
  const now = new Date().toISOString()
  const pool = getPool()
  let publication
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const revision = (
        await client.query(
          `INSERT INTO hub_content_revisions(
             content_type,content_key,payload,created_by,status,
             reviewed_by,reviewed_at,published_at
           )
           VALUES($1,$2,$3,$4,'published',$4,now(),now())
           RETURNING *`,
          [contentType, live.slug, value, actorId],
        )
      ).rows[0]
      const { rows } = await client.query(UPSERT_PUBLICATION_SQL, [
        contentType,
        live.slug,
        value,
        revision.id,
        actorId,
      ])
      await client.query('COMMIT')
      publication = publicationView(rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    const revision = {
      id: randomUUID(),
      contentType,
      contentKey: live.slug,
      payload: value,
      status: 'published',
      createdBy: actorId,
      reviewedBy: actorId,
      reviewNote: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      reviewedAt: now,
      publishedAt: now,
    }
    const revisions = readArray(revisionsPath())
    revisions.unshift(revision)
    writeArray(revisionsPath(), revisions)
    const publications = readArray(publicationsPath())
    const item = publishedRecord({
      contentType,
      slug: live.slug,
      payload: value,
      revisionId: revision.id,
      actorId,
      now,
    })
    const publicationIndex = findPublicationIndex(
      publications,
      contentType,
      live.slug,
    )
    if (publicationIndex >= 0) publications[publicationIndex] = item
    else publications.unshift(item)
    writeArray(publicationsPath(), publications)
    publication = publicationView(item)
  }
  await refreshLiveContent()
  return {
    mode: 'apply',
    contentType,
    slug: live.slug,
    item: getLiveContent(contentType, live.slug),
    publication,
    before,
    after: value,
  }
}

export async function unpublishLiveContent({
  contentType,
  slug,
  actorId,
  reason = '',
}) {
  assertLiveContentType(contentType)
  const key = String(slug || '').trim()
  const live = requireLiveItem(contentType, key)
  const before = liveEditablePayload(contentType, live)
  const cleanReason =
    String(reason || '')
      .trim()
      .slice(0, 500) || null
  const now = new Date().toISOString()
  const pool = getPool()
  let publication
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      let current = (
        await client.query(
          `SELECT * FROM hub_content_publications
           WHERE content_type=$1 AND content_key=$2
           FOR UPDATE`,
          [contentType, live.slug],
        )
      ).rows[0]
      if (!current) {
        const revision = (
          await client.query(
            `INSERT INTO hub_content_revisions(
               content_type,content_key,payload,created_by,status,published_at
             )
             VALUES($1,$2,$3,$4,'published',now())
             RETURNING *`,
            [contentType, live.slug, before, actorId],
          )
        ).rows[0]
        current = (
          await client.query(
            `INSERT INTO hub_content_publications(
               content_type,content_key,payload,revision_id,published_by,
               published_at,status
             )
             VALUES($1,$2,$3,$4,$5,now(),'published')
             RETURNING *`,
            [contentType, live.slug, before, revision.id, actorId],
          )
        ).rows[0]
      }
      const { rows } = await client.query(
        `UPDATE hub_content_publications
         SET status='unpublished',unpublished_by=$3,unpublished_at=now(),
             unpublish_reason=$4
         WHERE content_type=$1 AND content_key=$2
         RETURNING *`,
        [contentType, live.slug, actorId, cleanReason],
      )
      await client.query('COMMIT')
      publication = publicationView(rows[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    const publications = readArray(publicationsPath())
    let index = findPublicationIndex(publications, contentType, live.slug)
    if (index < 0) {
      const revision = {
        id: randomUUID(),
        contentType,
        contentKey: live.slug,
        payload: before,
        status: 'published',
        createdBy: actorId,
        reviewedBy: null,
        reviewNote: null,
        createdAt: now,
        updatedAt: now,
        submittedAt: null,
        reviewedAt: null,
        publishedAt: now,
      }
      const revisions = readArray(revisionsPath())
      revisions.unshift(revision)
      writeArray(revisionsPath(), revisions)
      publications.unshift(
        publishedRecord({
          contentType,
          slug: live.slug,
          payload: before,
          revisionId: revision.id,
          actorId,
          now,
        }),
      )
      index = 0
    }
    publications[index] = {
      ...publications[index],
      status: 'unpublished',
      unpublishedBy: actorId,
      unpublishedAt: now,
      unpublishReason: cleanReason,
    }
    writeArray(publicationsPath(), publications)
    publication = publicationView(publications[index])
  }
  await refreshLiveContent()
  return {
    contentType,
    slug: live.slug,
    unpublished: true,
    publication,
    before,
    reason: cleanReason,
  }
}

export async function initializeContentWorkflow() {
  return refreshLiveContent()
}
