// Public negotiation tracking reads — ported from server/lib/negotiations.js.
// Relational model only; the JSON-fixture fallback path is not carried over.
import { getPgPool } from '../../lib/pg'

const MAX_PAGE_SIZE = 50

export function pagination(query: Record<string, any> = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(query.pageSize, 10) || 20),
  )
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function normalizeFollowPreferences(input: any = {}) {
  const digestFrequency = ['none', 'daily', 'weekly'].includes(
    input.digestFrequency,
  )
    ? input.digestFrequency
    : 'weekly'
  return {
    deadlineAlerts: input.deadlineAlerts !== false,
    substantiveChangeAlerts: input.substantiveChangeAlerts !== false,
    digestFrequency,
  }
}

export async function listPublicTracks(filters: Record<string, any> = {}) {
  const pool = getPgPool()
  const paging = pagination(filters)
  if (!pool) {
    return { items: [], page: paging.page, pageSize: paging.pageSize, total: 0 }
  }

  const values: any[] = []
  const where = ["t.publication_status = 'published'"]
  const add = (sql: string, value: any) => {
    values.push(value)
    where.push(sql.replace('?', `$${values.length}`))
  }
  if (filters.topic) add('t.topic ILIKE ?', `%${filters.topic}%`)
  if (filters.activity) add('t.activity_status = ?', filters.activity)
  if (filters.workingGroup)
    add(
      'EXISTS (SELECT 1 FROM negotiation_track_working_groups tw WHERE tw.track_id=t.id AND tw.working_group_slug=?)',
      filters.workingGroup,
    )
  if (filters.body)
    add(
      'EXISTS (SELECT 1 FROM negotiation_track_agenda_items ta JOIN negotiation_agenda_items a ON a.id=ta.agenda_item_id WHERE ta.track_id=t.id AND a.body ILIKE ?)',
      `%${filters.body}%`,
    )
  if (filters.session)
    add(
      'EXISTS (SELECT 1 FROM negotiation_track_agenda_items ta JOIN negotiation_agenda_items a ON a.id=ta.agenda_item_id WHERE ta.track_id=t.id AND a.session ILIKE ?)',
      `%${filters.session}%`,
    )
  if (filters.openCalls === 'true')
    where.push(
      "EXISTS (SELECT 1 FROM negotiation_track_calls tc JOIN negotiation_calls c ON c.id=tc.call_id WHERE tc.track_id=t.id AND c.publication_status='published' AND c.status='open')",
    )

  const count = await pool.query(
    `SELECT count(*)::int AS total FROM negotiation_tracks t WHERE ${where.join(' AND ')}`,
    values,
  )
  const rows = await pool.query(
    `SELECT t.id, t.slug, t.topic, t.summary, t.activity_status,
       COALESCE(array_agg(DISTINCT tw.working_group_slug) FILTER (WHERE tw.working_group_slug IS NOT NULL), '{}') AS working_group_slugs,
       count(DISTINCT c.id) FILTER (WHERE c.status='open' AND c.publication_status='published')::int AS open_calls
     FROM negotiation_tracks t
     LEFT JOIN negotiation_track_working_groups tw ON tw.track_id=t.id
     LEFT JOIN negotiation_track_calls tc ON tc.track_id=t.id
     LEFT JOIN negotiation_calls c ON c.id=tc.call_id
     WHERE ${where.join(' AND ')}
     GROUP BY t.id
     ORDER BY t.topic
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, paging.pageSize, paging.offset],
  )
  return {
    items: rows.rows.map((row: any) => ({
      id: row.id,
      slug: row.slug,
      topic: row.topic,
      summary: row.summary,
      activityStatus: row.activity_status,
      workingGroupSlugs: row.working_group_slugs,
      openCalls: row.open_calls,
    })),
    page: paging.page,
    pageSize: paging.pageSize,
    total: count.rows[0].total,
  }
}

export async function getPublicTrack(slug: string) {
  const pool = getPgPool()
  if (!pool) return null
  const { rows } = await pool.query(
    `SELECT id, slug, topic, summary, activity_status
     FROM negotiation_tracks
     WHERE slug=$1 AND publication_status='published'`,
    [slug],
  )
  if (!rows[0]) return null
  const track = rows[0]
  const [agenda, documents, calls] = await Promise.all([
    pool.query(
      `SELECT a.id, a.body, a.session, a.item_number, a.sub_item_number, a.official_title,
        COALESCE(array_agg(l.from_agenda_item_id) FILTER (WHERE l.from_agenda_item_id IS NOT NULL), '{}') AS lineage_from
       FROM negotiation_track_agenda_items ta
       JOIN negotiation_agenda_items a ON a.id=ta.agenda_item_id
       LEFT JOIN negotiation_agenda_lineage l ON l.to_agenda_item_id=a.id
       WHERE ta.track_id=$1 GROUP BY a.id ORDER BY a.session, a.item_number`,
      [track.id],
    ),
    pool.query(
      `SELECT d.id, d.title, d.source_identifier, d.document_status, d.status_verified,
        s.source_url, s.last_successful_check_at, s.last_attempt_at,
        s.last_attempt_status, s.coverage_state, s.safe_diagnostic,
        v.id AS version_id, v.content_hash, v.language, v.original_reference,
        v.published_at, v.retrieved_at, v.extraction_method,
        v.extraction_version, v.extraction_confidence,
        count(allv.id)::int AS version_count
       FROM negotiation_track_documents td
       JOIN negotiation_documents d ON d.id=td.document_id AND d.publication_status='published'
       JOIN negotiation_sources s ON s.id=d.source_id AND s.publication_status='published'
       JOIN LATERAL (SELECT * FROM negotiation_document_versions x WHERE x.document_id=d.id ORDER BY x.retrieved_at DESC LIMIT 1) v ON true
       JOIN negotiation_document_versions allv ON allv.document_id=d.id
       WHERE td.track_id=$1 GROUP BY d.id,s.id,v.id ORDER BY d.title`,
      [track.id],
    ),
    pool.query(
      `SELECT c.id,c.title,c.mandate,c.eligibility,c.submitting_channel,c.status,
        c.source_version_id,c.external_deadline_date,c.external_deadline_time,
        c.external_deadline_timezone,c.external_deadline_precision
       FROM negotiation_track_calls tc JOIN negotiation_calls c ON c.id=tc.call_id
       WHERE tc.track_id=$1 AND c.publication_status='published'
       ORDER BY c.external_deadline_date NULLS LAST`,
      [track.id],
    ),
  ])
  return {
    id: track.id,
    slug: track.slug,
    topic: track.topic,
    summary: track.summary,
    activityStatus: track.activity_status,
    agendaItems: agenda.rows.map((row: any) => ({
      id: row.id,
      body: row.body,
      session: row.session,
      item: row.item_number,
      subItem: row.sub_item_number,
      title: row.official_title,
      lineageFrom: row.lineage_from,
    })),
    documents: documents.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      sourceIdentifier: row.source_identifier,
      sourceUrl: row.source_url,
      documentStatus: row.document_status,
      statusVerified: row.status_verified,
      versionCount: row.version_count,
      latestVersion: {
        id: row.version_id,
        contentHash: row.content_hash,
        language: row.language,
        originalReference: row.original_reference,
        publishedAt: row.published_at,
        retrievedAt: row.retrieved_at,
        extraction: {
          method: row.extraction_method,
          version: row.extraction_version,
          confidence: row.extraction_confidence,
        },
      },
      health: {
        lastSuccessfulCheckAt: row.last_successful_check_at,
        lastAttemptAt: row.last_attempt_at,
        lastAttemptStatus: row.last_attempt_status,
        coverageState: row.coverage_state,
        safeDiagnostic: row.safe_diagnostic,
      },
    })),
    calls: calls.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      mandate: row.mandate,
      eligibility: row.eligibility,
      submittingChannel: row.submitting_channel,
      status: row.status,
      sourceVersionId: row.source_version_id,
      externalDeadline: {
        date: row.external_deadline_date,
        precision: row.external_deadline_precision,
        ...(row.external_deadline_precision === 'time'
          ? {
              time: row.external_deadline_time,
              timezone: row.external_deadline_timezone,
            }
          : {}),
      },
    })),
  }
}

export async function listPublicCalls(filters: Record<string, any> = {}) {
  const tracks = await listPublicTracks({ ...filters, pageSize: MAX_PAGE_SIZE })
  const details = await Promise.all(
    tracks.items.map((item: any) => getPublicTrack(item.slug)),
  )
  const byId = new Map()
  details
    .flatMap((item: any) => item.calls)
    .forEach((call: any) => byId.set(call.id, call))
  return { items: [...byId.values()] }
}

export async function getPublicDocumentVersion(
  documentId: string,
  versionId: string,
) {
  const pool = getPgPool()
  if (!pool) return null
  const { rows } = await pool.query(
    `SELECT d.id AS document_id,d.source_identifier,d.document_status,d.status_verified,
      s.source_url,v.id AS version_id,v.content_hash,v.language,v.original_reference,
      v.published_at,v.retrieved_at,v.extraction_method,v.extraction_version,v.extraction_confidence
     FROM negotiation_documents d
     JOIN negotiation_sources s ON s.id=d.source_id
     JOIN negotiation_document_versions v ON v.document_id=d.id
     WHERE d.id=$1 AND v.id=$2 AND d.publication_status='published' AND s.publication_status='published'`,
    [documentId, versionId],
  )
  const row = rows[0]
  if (!row) return null
  return {
    documentId: row.document_id,
    sourceIdentifier: row.source_identifier,
    sourceUrl: row.source_url,
    documentStatus: row.document_status,
    statusVerified: row.status_verified,
    version: {
      id: row.version_id,
      contentHash: row.content_hash,
      language: row.language,
      originalReference: row.original_reference,
      publishedAt: row.published_at,
      retrievedAt: row.retrieved_at,
      extraction: {
        method: row.extraction_method,
        version: row.extraction_version,
        confidence: row.extraction_confidence,
      },
    },
    extractionUncertain: Number(row.extraction_confidence) < 0.9,
  }
}

export async function putFollow({
  accountId,
  slug,
  preferences,
}: {
  accountId: number
  slug: string
  preferences: any
}) {
  const pool = getPgPool()
  if (!pool) return { unavailable: true }
  const track = await pool.query(
    "SELECT id FROM negotiation_tracks WHERE slug=$1 AND publication_status='published'",
    [slug],
  )
  if (!track.rows[0]) return null
  const normalized = normalizeFollowPreferences(preferences)
  const { rows } = await pool.query(
    `INSERT INTO negotiation_follows(account_id,track_id,deadline_alerts,substantive_change_alerts,digest_frequency)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(account_id,track_id) DO UPDATE SET
       deadline_alerts=EXCLUDED.deadline_alerts,
       substantive_change_alerts=EXCLUDED.substantive_change_alerts,
       digest_frequency=EXCLUDED.digest_frequency,
       updated_at=now()
     RETURNING deadline_alerts,substantive_change_alerts,digest_frequency`,
    [
      accountId,
      track.rows[0].id,
      normalized.deadlineAlerts,
      normalized.substantiveChangeAlerts,
      normalized.digestFrequency,
    ],
  )
  return {
    deadlineAlerts: rows[0].deadline_alerts,
    substantiveChangeAlerts: rows[0].substantive_change_alerts,
    digestFrequency: rows[0].digest_frequency,
  }
}

export async function getFollow(accountId: number, slug: string) {
  const pool = getPgPool()
  if (!pool) return null
  const { rows } = await pool.query(
    `SELECT f.deadline_alerts,f.substantive_change_alerts,f.digest_frequency
     FROM negotiation_follows f JOIN negotiation_tracks t ON t.id=f.track_id
     WHERE f.account_id=$1 AND t.slug=$2`,
    [accountId, slug],
  )
  const row = rows[0]
  return row
    ? {
        deadlineAlerts: row.deadline_alerts,
        substantiveChangeAlerts: row.substantive_change_alerts,
        digestFrequency: row.digest_frequency,
      }
    : null
}

export async function deleteFollow({
  accountId,
  slug,
}: {
  accountId: number
  slug: string
}) {
  const pool = getPgPool()
  if (!pool) return { unavailable: true }
  await pool.query(
    `DELETE FROM negotiation_follows f USING negotiation_tracks t
     WHERE f.track_id=t.id AND f.account_id=$1 AND t.slug=$2`,
    [accountId, slug],
  )
  return { ok: true }
}
