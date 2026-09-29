// Exact-version paragraph amendments and their version chain.
import { type Pool } from 'pg'
import {
  ContributionError,
  assertAmendmentWrite,
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
import { normalizeAmendmentInput, normalizeAmendmentRevisionInput } from './contributionInputs'
import { getPgPool } from '../../lib/pg'

export async function createAmendment({
  account,
  input,
  pool = getPgPool(),
}: {
  account: any
  input: any
  pool?: Pool | null
}) {
  const data = normalizeAmendmentInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = 'amendment.create'
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
    if (data.projectId) await assertProjectWrite(client, data.projectId, account.id)
    if (data.targetType === 'official_document') {
      const target = await client.query(
        `SELECT 1 FROM negotiation_document_versions v
         JOIN negotiation_documents d ON d.id=v.document_id
         JOIN negotiation_sources s ON s.id=d.source_id
         WHERE v.id=$1 AND d.publication_status='published' AND s.publication_status='published'`,
        [data.targetDocumentVersionId],
      )
      if (!target.rows[0])
        throw new ContributionError(404, 'not_found', 'Target version not found.')
    } else {
      const target = await client.query(
        `SELECT 1 FROM negotiation_submission_versions v
         JOIN negotiation_submission_project_members m ON m.project_id=v.project_id
         WHERE v.id=$1 AND m.account_id=$2`,
        [data.targetProjectVersionId, account.id],
      )
      if (!target.rows[0])
        throw new ContributionError(404, 'not_found', 'Target version not found.')
    }
    await assertCitations(client, data.citations)
    const amendment = await client.query(
      `INSERT INTO negotiation_amendments(
        project_id,target_type,target_document_version_id,target_project_version_id,
        stable_anchor,operation,original_text,proposed_text,rationale,author_id
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,current_version`,
      [
        data.projectId,
        data.targetType,
        data.targetDocumentVersionId,
        data.targetProjectVersionId,
        JSON.stringify(data.stableAnchor),
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
        account.id,
      ],
    )
    const hash = contentHash(data)
    const version = await client.query(
      `INSERT INTO negotiation_amendment_versions(
        amendment_id,version,content_hash,operation,original_text,
        proposed_text,rationale,stable_anchor,authored_by
       ) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,version,content_hash,created_at`,
      [
        amendment.rows[0].id,
        hash,
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
        JSON.stringify(data.stableAnchor),
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_amendment_evidence',
      'amendment_version_id',
      version.rows[0].id,
      data.citations,
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.created',
      targetType: 'negotiation_amendment',
      targetId: amendment.rows[0].id,
      detail: {
        targetType: data.targetType,
        targetDocumentVersionId: data.targetDocumentVersionId,
        targetProjectVersionId: data.targetProjectVersionId,
        versionId: version.rows[0].id,
        contentHash: hash,
        operation: data.operation,
      },
    })
    const response = { ...amendment.rows[0], version: version.rows[0] }
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

export async function appendAmendmentVersion({
  account,
  amendmentId,
  input,
  pool = getPgPool(),
}: {
  account: any
  amendmentId: string
  input: any
  pool?: Pool | null
}) {
  const data = normalizeAmendmentRevisionInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `amendment.version.create:${amendmentId}`
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
    const amendment = await assertAmendmentWrite(client, amendmentId, account.id)
    assertExpectedVersion(amendment.current_version, data.expectedVersion)
    await assertCitations(client, data.citations)
    const nextVersion = data.expectedVersion + 1
    const hash = contentHash(data)
    const version = await client.query(
      `INSERT INTO negotiation_amendment_versions(
        amendment_id,version,content_hash,operation,original_text,
        proposed_text,rationale,stable_anchor,authored_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,version,content_hash,created_at`,
      [
        amendmentId,
        nextVersion,
        hash,
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
        JSON.stringify(data.stableAnchor),
        account.id,
      ],
    )
    await insertEvidence(
      client,
      'negotiation_amendment_evidence',
      'amendment_version_id',
      version.rows[0].id,
      data.citations,
    )
    await client.query(
      `UPDATE negotiation_amendments SET current_version=$2,stable_anchor=$3,
       operation=$4,original_text=$5,proposed_text=$6,rationale=$7,
       decision_status='draft',updated_at=now() WHERE id=$1`,
      [
        amendmentId,
        nextVersion,
        JSON.stringify(data.stableAnchor),
        data.operation,
        data.originalText,
        data.proposedText,
        data.rationale,
      ],
    )
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.version_created',
      targetType: 'negotiation_amendment',
      targetId: amendmentId,
      detail: {
        versionId: version.rows[0].id,
        version: nextVersion,
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
