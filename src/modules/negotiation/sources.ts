// Extraction review — assesses reviewed extraction text for sensitive
// markers and records the review transactionally with an audit entry.
import { createHash } from 'node:crypto'
import { type Pool } from 'pg'
import { getPgPool } from '../../lib/pg'
import { getAccessProfile, hasCapability } from '../../lib/access'

export class SourceIngestionError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SourceIngestionError'
    this.code = code
  }
}

const EXTRACTION_MAX_CHARS = 1_000_000
const EXTRACTION_RISKS: [string, RegExp][] = [
  [
    'credential_marker',
    /\b(?:password|passwd|api[_ -]?key|access[_ -]?token|session[_ -]?token|private[_ -]?key)\b/i,
  ],
  ['contact_email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['contact_phone', /(?:\+?\d[\d ()-]{7,}\d)/],
]

/** Validate reviewed extraction text and flag any sensitive-content markers it contains. */
function assessExtractionText(value: any) {
  const text = String(value || '')
  if (!text.trim())
    throw new SourceIngestionError('invalid_extraction', 'Reviewed extraction text is required.')
  if (text.length > EXTRACTION_MAX_CHARS)
    throw new SourceIngestionError(
      'extraction_too_large',
      'Reviewed extraction exceeds the text limit.',
    )
  const reasonCodes = EXTRACTION_RISKS.filter(([, pattern]) => pattern.test(text)).map(
    ([code]) => code,
  )
  return {
    contentHash: `sha256:${createHash('sha256').update(text).digest('hex')}`,
    reviewStatus: reasonCodes.length ? 'quarantined' : 'safe',
    reasonCodes,
    textContent: reasonCodes.length ? null : text,
  }
}

export async function reviewDocumentExtraction({
  req,
  account,
  documentId,
  versionId,
  expectedRevision,
  text,
  method,
  confidence,
  note,
  requestId,
  pool = getPgPool(),
}: {
  account: any
  documentId: string
  versionId: string
  expectedRevision: number
  text: string
  method?: string
  confidence: number
  note: string
  requestId?: string | null
  pool?: Pool | null
  req: any
}) {
  if (!pool)
    throw new SourceIngestionError(
      'database_required',
      'Extraction review requires persistent storage.',
    )
  if (!account || account.principalType === 'service')
    throw new SourceIngestionError('human_required', 'A scoped human reviewer is required.')
  const reviewNote = String(note || '').trim()
  if (reviewNote.length < 8 || reviewNote.length > 1000)
    throw new SourceIngestionError(
      'invalid_review_note',
      'Review note must contain 8 to 1000 characters.',
    )
  const extractionMethod = String(method || 'manual_correction').trim()
  if (!['manual_review', 'manual_correction', 'verified_ocr'].includes(extractionMethod))
    throw new SourceIngestionError(
      'invalid_extraction_method',
      'Extraction method is not permitted.',
    )
  const numericConfidence = Number(confidence)
  if (!Number.isFinite(numericConfidence) || numericConfidence < 0 || numericConfidence > 1)
    throw new SourceIngestionError(
      'invalid_confidence',
      'Extraction confidence must be between 0 and 1.',
    )
  const assessed = assessExtractionText(text)
  const access = await getAccessProfile(req, account)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const target = await client.query(
      `SELECT v.id
       FROM negotiation_document_versions v
       JOIN negotiation_documents d ON d.id=v.document_id
       WHERE d.id=$1 AND v.id=$2 FOR UPDATE OF v`,
      [documentId, versionId],
    )
    if (!target.rows[0])
      throw new SourceIngestionError('version_not_found', 'Document version not found.')
    const trackResult = await client.query(
      `SELECT DISTINCT track_id::text FROM negotiation_track_documents
       WHERE document_id=$1`,
      [documentId],
    )
    const trackIds = trackResult.rows.map((row: any) => row.track_id)
    if (
      !trackIds.length ||
      trackIds.some(
        (trackId: string) =>
          !hasCapability(access, `negotiations.evidence.review:negotiation_track:${trackId}`),
      )
    )
      throw new SourceIngestionError(
        'review_scope_denied',
        'Reviewer is not assigned to every linked track.',
      )
    const latest = await client.query(
      `SELECT revision FROM negotiation_document_extractions
       WHERE document_version_id=$1 ORDER BY revision DESC LIMIT 1 FOR UPDATE`,
      [versionId],
    )
    const latestRevision = latest.rows[0]?.revision || 0
    if (Number(expectedRevision) !== latestRevision)
      throw new SourceIngestionError(
        'revision_conflict',
        'Extraction changed; inspect the latest revision before retrying.',
      )
    const revision = latestRevision + 1
    const inserted = await client.query(
      `INSERT INTO negotiation_document_extractions(
        document_version_id,revision,content_hash,text_content,
        extraction_method,extraction_confidence,review_status,reason_codes,
        reviewed_by,review_note
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,revision,content_hash,review_status,reason_codes,reviewed_at`,
      [
        versionId,
        revision,
        assessed.contentHash,
        assessed.textContent,
        extractionMethod,
        numericConfidence,
        assessed.reviewStatus,
        assessed.reasonCodes,
        account.id,
        reviewNote,
      ],
    )
    await client.query(
      `INSERT INTO audit_log(
        actor_id,action,target_type,target_id,"after",reason,request_id
       ) VALUES($1,'negotiation.extraction.reviewed','negotiation_document_version',$2,$3,$4,$5)`,
      [
        account.id,
        versionId,
        JSON.stringify({
          extractionId: inserted.rows[0].id,
          revision,
          contentHash: assessed.contentHash,
          reviewStatus: assessed.reviewStatus,
          reasonCodes: assessed.reasonCodes,
        }),
        reviewNote,
        requestId || null,
      ],
    )
    await client.query('COMMIT')
    return inserted.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
