// Amendment reconciliation: suggest field-level merges against a new target
// version, then confirm or reject them.
import { type Pool } from 'pg'
import {
  ContributionError,
  assertAmendmentWrite,
  assertCitations,
  assertExpectedVersion,
  beginIdempotentMutation,
  contentHash,
  insertEvidence,
  requirePool,
  saveIdempotency,
  writeAudit,
} from './contributionShared'
import {
  normalizeReconciliationConfirmationInput,
  normalizeReconciliationSuggestionInput,
} from './contributionInputs'
import { getPgPool } from '../../lib/pg'

export async function suggestAmendmentReconciliation({
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
  const data = normalizeReconciliationSuggestionInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `amendment.reconciliation.suggest:${amendmentId}`
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
    const amendment = await assertAmendmentWrite(
      client,
      amendmentId,
      account.id,
    )
    if (amendment.target_type !== 'official_document')
      throw new ContributionError(
        422,
        'invalid_target',
        'Only official-document amendments use document reconciliation.',
      )
    assertExpectedVersion(
      amendment.current_version,
      data.expectedAmendmentVersion,
    )
    const target = await client.query(
      `SELECT 1 FROM negotiation_document_versions old
       JOIN negotiation_document_versions proposed
         ON proposed.document_id=old.document_id
       JOIN negotiation_documents d ON d.id=proposed.document_id
       JOIN negotiation_sources s ON s.id=d.source_id
       WHERE old.id=$1 AND proposed.id=$2
         AND d.publication_status='published' AND s.publication_status='published'`,
      [amendment.target_document_version_id, data.suggestedDocumentVersionId],
    )
    if (!target.rows[0])
      throw new ContributionError(
        422,
        'invalid_mapping_target',
        'Suggested target must be a published version of the same document.',
      )
    const inserted = await client.query(
      `INSERT INTO negotiation_amendment_reconciliations(
        amendment_id,from_document_version_id,suggested_document_version_id,
        suggested_anchor,mapping_evidence,confidence
       ) VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,status,confidence,created_at`,
      [
        amendmentId,
        amendment.target_document_version_id,
        data.suggestedDocumentVersionId,
        JSON.stringify(data.suggestedAnchor),
        JSON.stringify(data.mappingEvidence),
        data.confidence,
      ],
    )
    await client.query(
      `UPDATE negotiation_amendments SET reconciliation_status='mapping_suggested',
       updated_at=now() WHERE id=$1`,
      [amendmentId],
    )
    const response = {
      ...inserted.rows[0],
      suggestedDocumentVersionId: data.suggestedDocumentVersionId,
      suggestedAnchor: data.suggestedAnchor,
    }
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.reconciliation_suggested',
      targetType: 'negotiation_amendment',
      targetId: amendmentId,
      detail: {
        reconciliationId: inserted.rows[0].id,
        fromVersionId: amendment.target_document_version_id,
        suggestedVersionId: data.suggestedDocumentVersionId,
        confidence: data.confidence,
      },
    })
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

export async function confirmAmendmentReconciliation({
  account,
  amendmentId,
  reconciliationId,
  input,
  pool = getPgPool(),
}: {
  account: any
  amendmentId: string
  reconciliationId: string
  input: any
  pool?: Pool | null
}) {
  const data = normalizeReconciliationConfirmationInput(input)
  const client = await requirePool(pool).connect()
  try {
    await client.query('BEGIN')
    const operation = `amendment.reconciliation.confirm:${reconciliationId}`
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
    const amendment = await assertAmendmentWrite(
      client,
      amendmentId,
      account.id,
    )
    assertExpectedVersion(
      amendment.current_version,
      data.expectedAmendmentVersion,
    )
    const reconciliation = await client.query(
      `SELECT * FROM negotiation_amendment_reconciliations
       WHERE id=$1 AND amendment_id=$2 AND status='suggested' FOR UPDATE`,
      [reconciliationId, amendmentId],
    )
    if (!reconciliation.rows[0])
      throw new ContributionError(
        409,
        'reconciliation_conflict',
        'Mapping is no longer pending.',
      )
    if (
      !data.citations.some(
        (citation: any) =>
          citation.sourceVersionId ===
          String(reconciliation.rows[0].suggested_document_version_id),
      )
    )
      throw new ContributionError(
        422,
        'new_version_citation_required',
        'Confirmation requires evidence from the suggested source version.',
      )
    await assertCitations(client, data.citations)
    const currentVersion = await client.query(
      `SELECT * FROM negotiation_amendment_versions
       WHERE amendment_id=$1 AND version=$2`,
      [amendmentId, data.expectedAmendmentVersion],
    )
    const nextVersion = data.expectedAmendmentVersion + 1
    const current = currentVersion.rows[0]
    if (!current)
      throw new ContributionError(
        409,
        'version_conflict',
        'The amendment version is no longer available.',
      )
    const versionPayload = {
      operation: current.operation,
      originalText: current.original_text,
      proposedText: current.proposed_text,
      rationale: current.rationale,
      stableAnchor: reconciliation.rows[0].suggested_anchor,
      citations: data.citations,
    }
    const hash = contentHash(versionPayload)
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
        current.operation,
        current.original_text,
        current.proposed_text,
        current.rationale,
        JSON.stringify(reconciliation.rows[0].suggested_anchor),
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
      `UPDATE negotiation_amendment_reconciliations SET status='confirmed',
       confirmed_by=$2,confirmed_at=now() WHERE id=$1`,
      [reconciliationId, account.id],
    )
    await client.query(
      `UPDATE negotiation_amendments SET target_document_version_id=$2,
       stable_anchor=$3,current_version=$4,reconciliation_status='confirmed',
       decision_status='draft',updated_at=now() WHERE id=$1`,
      [
        amendmentId,
        reconciliation.rows[0].suggested_document_version_id,
        JSON.stringify(reconciliation.rows[0].suggested_anchor),
        nextVersion,
      ],
    )
    const response = {
      reconciliationId,
      status: 'confirmed',
      targetDocumentVersionId:
        reconciliation.rows[0].suggested_document_version_id,
      version: version.rows[0],
      reviewRequired: true,
      note: data.note,
    }
    await writeAudit(client, {
      accountId: account.id,
      action: 'negotiation.amendment.reconciliation_confirmed',
      targetType: 'negotiation_amendment',
      targetId: amendmentId,
      detail: {
        reconciliationId,
        targetDocumentVersionId: response.targetDocumentVersionId,
        amendmentVersion: nextVersion,
        contentHash: hash,
        reviewRequired: true,
      },
    })
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