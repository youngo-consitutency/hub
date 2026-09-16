import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { localDemoEnabled } from './config.js'
import { listContentPublications } from './contentWorkflow.js'
import {
  RESOURCE_ISSUE_KINDS,
  canonicalResourceUrl,
} from '../../shared/resourceHub.js'

const baseline = JSON.parse(
  readFileSync(
    new URL(
      localDemoEnabled()
        ? '../../.local-demo/data/resource-hub.json'
        : '../../data/resource-hub.json',
      import.meta.url,
    ),
    'utf8',
  ),
)
const fail = (code, message) => Object.assign(new Error(message), { code })
function database() {
  const pool = getPool()
  if (!pool)
    throw fail(
      'unavailable',
      'Link verification requires the database. Please try again later.',
    )
  return pool
}

export function resourceFingerprint(item) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        item.slug,
        item.title,
        item.url,
        item.summary,
        item.publisher || null,
        item.pathway,
        item.type,
        [...(item.topics || [item.topic])].sort(),
        item.topic,
        item.region,
        item.language,
      ]),
    )
    .digest('hex')
}

export async function listResourceCatalogue({ includeRetired = false } = {}) {
  const bySlug = new Map(baseline.map((item) => [item.slug, { ...item }]))
  for (const publication of await listContentPublications()) {
    if (publication.contentType !== 'resource') continue
    if (publication.status !== 'published') {
      bySlug.delete(publication.contentKey)
      continue
    }
    bySlug.set(publication.contentKey, {
      ...publication.payload,
      source: bySlug.get(publication.contentKey)?.source,
      publishedAt: publication.publishedAt,
    })
  }
  const pool = getPool()
  const reviews = pool
    ? (
        await pool.query(
          'SELECT DISTINCT ON (resource_slug) resource_slug, fingerprint, status, reviewed_at FROM resource_reviews ORDER BY resource_slug, reviewed_at DESC, id DESC',
        )
      ).rows
    : []
  const reports = pool
    ? (
        await pool.query(
          'SELECT resource_slug, count(*)::int AS count FROM resource_issues WHERE resolved_at IS NULL GROUP BY resource_slug',
        )
      ).rows
    : []
  const checks = new Map(reviews.map((row) => [row.resource_slug, row]))
  const counts = new Map(reports.map((row) => [row.resource_slug, row.count]))
  return [...bySlug.values()]
    .map((item) => {
      const fingerprint = resourceFingerprint(item)
      const review = checks.get(item.slug)
      const current = review?.fingerprint === fingerprint
      return {
        ...item,
        topics: item.topics || [item.topic],
        fingerprint,
        verification: {
          status: current ? review.status : 'needs_verification',
          checkedAt: current ? review.reviewed_at : null,
          openIssues: counts.get(item.slug) || 0,
        },
      }
    })
    .filter((item) => includeRetired || item.verification.status !== 'retired')
    .sort((a, b) => a.title.localeCompare(b.title))
}

export async function requireResource(slug) {
  const resource = (await listResourceCatalogue({ includeRetired: true })).find(
    (item) => item.slug === slug,
  )
  if (!resource) throw fail('not_found', 'Resource not found.')
  return resource
}

export async function checkResourceDuplicate(url, exceptSlug) {
  let canonical
  try {
    canonical = canonicalResourceUrl(url)
  } catch {
    throw fail('validation', 'Enter a valid public HTTP or HTTPS link.')
  }
  if (
    (await listResourceCatalogue({ includeRetired: true })).some(
      (item) =>
        item.slug !== exceptSlug &&
        canonicalResourceUrl(item.url) === canonical,
    )
  ) {
    throw fail(
      'conflict',
      'This link is already in the catalogue. Report an issue or suggest a correction on its resource card.',
    )
  }
}

export async function reportResourceIssue({ slug, actorId, kind, detail }) {
  const pool = database()
  await requireResource(slug)
  if (
    !RESOURCE_ISSUE_KINDS.some((item) => item.value === kind) ||
    typeof detail !== 'string' ||
    detail.trim().length < 8 ||
    detail.length > 2000
  ) {
    throw fail(
      'validation',
      'Choose an issue type and explain the concern in 8–2,000 characters.',
    )
  }
  const result = await pool.query(
    `INSERT INTO resource_issues(id,resource_slug,kind,detail,reported_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,
    [randomUUID(), slug, kind, detail.trim(), actorId],
  )
  if (!result.rows.length)
    throw fail('conflict', 'You already have an open report for this resource.')
  return result.rows[0]
}

export async function listResourceIssues() {
  return (
    await database().query(
      `SELECT id,resource_slug AS "resourceSlug",kind,detail,created_at AS "createdAt" FROM resource_issues WHERE resolved_at IS NULL ORDER BY created_at`,
    )
  ).rows
}

export async function verifyResource({
  slug,
  actorId,
  fingerprint,
  status,
  note,
  checks,
  resolvedIssueIds = [],
}) {
  const pool = database()
  if (
    !['verified', 'needs_changes', 'retired'].includes(status) ||
    typeof note !== 'string' ||
    note.trim().length < 8 ||
    note.length > 2000
  )
    throw fail(
      'validation',
      'Choose a result and leave a review note of 8–2,000 characters.',
    )
  if (
    status === 'verified' &&
    !['link', 'description', 'tags'].every((key) => checks?.[key] === true)
  )
    throw fail(
      'validation',
      'Check the destination, description, and tags before marking a link verified.',
    )
  if (
    !Array.isArray(resolvedIssueIds) ||
    resolvedIssueIds.length > 200 ||
    resolvedIssueIds.some(
      (id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id),
    )
  )
    throw fail('validation', 'Invalid issue selection.')
  const resource = await requireResource(slug)
  if (resource.fingerprint !== fingerprint)
    throw fail(
      'conflict',
      'This resource changed. Reload it and review the current version.',
    )
  const own = await pool.query(
    `SELECT 1 FROM hub_content_publications p JOIN hub_content_revisions r ON r.id=p.revision_id WHERE p.content_type='resource' AND p.content_key=$1 AND r.created_by=$2`,
    [slug, actorId],
  )
  if (own.rows.length)
    throw fail(
      'separation_of_duties',
      'Another Content Publisher must verify your own submission.',
    )
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const id = randomUUID()
    await client.query(
      `INSERT INTO resource_reviews(id,resource_slug,fingerprint,status,note,checks,reviewed_by) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        slug,
        fingerprint,
        status,
        note.trim(),
        JSON.stringify({
          link: checks?.link === true,
          description: checks?.description === true,
          tags: checks?.tags === true,
        }),
        actorId,
      ],
    )
    // Only resolve reports explicitly seen and selected by this reviewer.
    if (status !== 'needs_changes')
      await client.query(
        `UPDATE resource_issues SET resolved_at=now(),resolved_by=$1,review_id=$2 WHERE resource_slug=$3 AND id=ANY($4::uuid[]) AND resolved_at IS NULL`,
        [actorId, id, slug, resolvedIssueIds],
      )
    await client.query('COMMIT')
    return { id, status }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
