// Submission projects: creation, immutable draft versions and scoped reads.
import { type Pool } from 'pg'
import {
  ContributionError,
  assertCitations,
  assertExpectedVersion,
  assertProjectWrite,
  beginIdempotentMutation,
  contentHash,
  insertEvidence,
  requirePool,
  saveIdempotency,
  writeAudit,
} from './contributionShared'
import { normalizeDraftVersionInput, normalizeProjectInput } from './contributionInputs'
import { getPgPool } from '../../lib/pg'

export async function createSubmissionProject({
  account,
  input,
  pool = getPgPool(),
}: {
  account: any
  input: any
  pool?: Pool | null
}) {
  const data = normalizeProjectInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = 'project.create'
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const track = await client.query(
      "SELECT id FROM negotiation_tracks WHERE id=$1 AND publication_status='published'",
      [data.trackId],
    )
    if (!track.rows[0]) throw new ContributionError(404, 'not_found', 'Track not found.')
    if (data.callId) {
      const call = await client.query(
        `SELECT 1 FROM negotiation_calls c JOIN negotiation_track_calls tc ON tc.call_id=c.id
         WHERE c.id=$1 AND tc.track_id=$2 AND c.publication_status='published'`,
        [data.callId, data.trackId],
      )
      if (!call.rows[0])
        throw new ContributionError(
          422,
          'invalid_call',
          'Call is not a published call for this track.',
        )
    }
    await assertCitations(client, data.citations)
    const project = await client.query(
      `INSERT INTO negotiation_submission_projects(
        track_id,call_id,title,purpose,working_group_slug,
        intended_submitting_entity,external_draft_url,is_initiative,created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,title,is_initiative,lifecycle_status,current_version`,
      [
        data.trackId,
        data.callId,
        data.title,
        data.purpose,
        data.workingGroupSlug,
        data.intendedSubmittingEntity,
        data.externalDraftUrl,
        data.isInitiative,
        account.id,
      ],
    )
    await client.query(
      `INSERT INTO negotiation_submission_project_members(project_id,account_id,role,added_by)
       VALUES($1,$2,'owner',$2)`,
      [project.rows[0].id, account.id],
    )
    const hash = contentHash({
      contentText: data.contentText,
      citations: data.citations,
    })
    const version = await client.query(
      `INSERT INTO negotiation_submission_versions(
        project_id,version,content_text,content_hash,external_snapshot_url,authored_by
       ) VALUES($1,1,$2,$3,$4,$5) RETURNING id,version,content_hash,created_at`,
      [project.rows[0].id, data.contentText, hash, data.externalDraftUrl, account.id],
    )
    await insertEvidence(
      client,
      'negotiation_submission_evidence',
      'project_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_submission_projects SET current_version=1,updated_at=now() WHERE id=$1`,
      [project.rows[0].id],
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.project.created',
      targetType: 'negotiation_submission_project',
      targetId: project.rows[0].id,
      detail: {
        trackId: data.trackId,
        callId: data.callId,
        isInitiative: data.isInitiative,
        versionId: version.rows[0].id,
        contentHash: hash,
      },
    })
    const response = {
      ...project.rows[0],
      current_version: 1,
      version: version.rows[0],
    }
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response,
    })
    await client.query('COMMIT')
    return response
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function appendSubmissionVersion({
  account,
  projectId,
  input,
  pool = getPgPool(),
}: {
  account: any
  projectId: string
  input: any
  pool?: Pool | null
}) {
  const data = normalizeDraftVersionInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `project.version.create:${projectId}`
    const idempotency = await beginIdempotentMutation(
      client,
      operation,
      account.id,
      data.idempotencyKey,
      data,
    )
    if (idempotency.response) {
      await client.query('COMMIT')
      return idempotency.response
    }
    const project = await assertProjectWrite(client, projectId, account.id)
    assertExpectedVersion(project.current_version, data.expectedVersion)
    await assertCitations(client, data.citations)
    const base = await client.query(
      `SELECT id FROM negotiation_submission_versions WHERE project_id=$1 AND version=$2`,
      [projectId, data.expectedVersion],
    )
    const nextVersion = data.expectedVersion + 1
    const hash = contentHash({
      contentText: data.contentText,
      citations: data.citations,
    })
    const version = await client.query(
      `INSERT INTO negotiation_submission_versions(
        project_id,version,base_version_id,content_text,content_hash,
        external_snapshot_url,authored_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7)
       RETURNING id,version,content_hash,created_at`,
      [
        projectId,
        nextVersion,
        base.rows[0].id,
        data.contentText,
        hash,
        data.externalSnapshotUrl,
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_submission_evidence',
      'project_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_submission_projects SET current_version=$2,
       lifecycle_status=CASE WHEN lifecycle_status IN ('endorsed','ready_for_transmission') THEN 'drafting' ELSE lifecycle_status END,
       updated_at=now() WHERE id=$1`,
      [projectId, nextVersion],
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.project.version_created',
      targetType: 'negotiation_submission_project',
      targetId: projectId,
      detail: {
        versionId: version.rows[0].id,
        version: nextVersion,
        baseVersion: data.expectedVersion,
        contentHash: hash,
      },
    })
    await saveIdempotency(client, {
      operation,
      actorId: account.id,
      key: data.idempotencyKey,
      requestHash: idempotency.requestHash,
      response: version.rows[0],
    })
    await client.query('COMMIT')
    return version.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listAccessibleProjects({
  account,
  pool = getPgPool(),
}: {
  account: any
  pool?: Pool | null
}) {
  const db = requirePool(pool)
  const { rows } = await db.query(
    `SELECT DISTINCT p.id,p.title,p.purpose,p.is_initiative,p.lifecycle_status,
      p.current_version,p.updated_at,t.slug AS track_slug,t.topic AS track_topic
     FROM negotiation_submission_projects p
     JOIN negotiation_tracks t ON t.id=p.track_id
     LEFT JOIN negotiation_submission_project_members m
       ON m.project_id=p.id AND m.account_id=$1
     LEFT JOIN assignments a
       ON a.account_id=$1 AND a.scope_type='negotiation_project'
       AND a.scope_id=p.id::text AND a.status='active'
       AND (a.ends_at IS NULL OR a.ends_at>now())
     WHERE m.account_id IS NOT NULL OR a.id IS NOT NULL
     ORDER BY p.updated_at DESC`,
    [account.id],
  )
  return rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    isInitiative: row.is_initiative,
    lifecycleStatus: row.lifecycle_status,
    currentVersion: row.current_version,
    updatedAt: row.updated_at,
    track: { slug: row.track_slug, topic: row.track_topic },
  }))
}

export async function getAccessibleProject({
  account,
  projectId,
  pool = getPgPool(),
}: {
  account: any
  projectId: string
  pool?: Pool | null
}) {
  const db = requirePool(pool)
  const projectResult = await db.query(
    `SELECT p.*,t.slug AS track_slug,t.topic AS track_topic,c.title AS call_title
     FROM negotiation_submission_projects p
     JOIN negotiation_tracks t ON t.id=p.track_id
     LEFT JOIN negotiation_calls c ON c.id=p.call_id
     WHERE p.id=$2 AND (
       EXISTS (SELECT 1 FROM negotiation_submission_project_members m
         WHERE m.project_id=p.id AND m.account_id=$1)
       OR EXISTS (SELECT 1 FROM assignments a
         WHERE a.account_id=$1 AND a.scope_type='negotiation_project'
           AND a.scope_id=p.id::text AND a.status='active'
           AND (a.ends_at IS NULL OR a.ends_at>now()))
     )`,
    [account.id, projectId],
  )
  const project = projectResult.rows[0]
  if (!project) throw new ContributionError(404, 'not_found', 'Project not found.')
  const [versions, amendments] = await Promise.all([
    db.query(
      `SELECT v.id,v.version,v.base_version_id,v.content_text,v.content_hash,
        v.external_snapshot_url,v.authored_by,v.created_at,
        COALESCE(jsonb_agg(jsonb_build_object(
          'sourceVersionId',e.source_version_id,'location',e.location,'quote',e.quote
        )) FILTER (WHERE e.source_version_id IS NOT NULL),'[]'::jsonb) AS citations
       FROM negotiation_submission_versions v
       LEFT JOIN negotiation_submission_evidence e ON e.project_version_id=v.id
       WHERE v.project_id=$1 GROUP BY v.id ORDER BY v.version DESC`,
      [projectId],
    ),
    db.query(
      `SELECT a.id,a.target_type,a.target_document_version_id,
        a.target_project_version_id,a.stable_anchor,a.operation,a.original_text,
        a.proposed_text,a.rationale,a.decision_status,a.reconciliation_status,
        a.author_id,a.current_version,a.created_at,a.updated_at
       FROM negotiation_amendments a WHERE a.project_id=$1
       ORDER BY a.updated_at DESC`,
      [projectId],
    ),
  ])
  return {
    id: project.id,
    title: project.title,
    purpose: project.purpose,
    isInitiative: project.is_initiative,
    lifecycleStatus: project.lifecycle_status,
    currentVersion: project.current_version,
    workingGroupSlug: project.working_group_slug,
    intendedSubmittingEntity: project.intended_submitting_entity,
    externalDraftUrl: project.external_draft_url,
    track: {
      id: project.track_id,
      slug: project.track_slug,
      topic: project.track_topic,
    },
    call: project.call_id ? { id: project.call_id, title: project.call_title } : null,
    versions: versions.rows.map((row: any) => ({
      id: row.id,
      version: row.version,
      baseVersionId: row.base_version_id,
      contentText: row.content_text,
      contentHash: row.content_hash,
      externalSnapshotUrl: row.external_snapshot_url,
      authoredBy: row.authored_by,
      createdAt: row.created_at,
      citations: row.citations,
    })),
    amendments: amendments.rows.map((row: any) => ({
      id: row.id,
      targetType: row.target_type,
      targetDocumentVersionId: row.target_document_version_id,
      targetProjectVersionId: row.target_project_version_id,
      stableAnchor: row.stable_anchor,
      operation: row.operation,
      originalText: row.original_text,
      proposedText: row.proposed_text,
      rationale: row.rationale,
      decisionStatus: row.decision_status,
      reconciliationStatus: row.reconciliation_status,
      authorId: row.author_id,
      currentVersion: row.current_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  }
}
