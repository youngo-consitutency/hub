// Extraction review + SSRF-guarded source fetch — ported from
// server/lib/negotiationSources.js (review/assessment surface; the recurring
// ingestion worker is out of scope for the rewrite).
import { createHash } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { type Pool } from 'pg'
import { getPgPool } from '../../lib/pg'
import { getAccessProfile, hasCapability } from '../../lib/access'

export const SOURCE_LIMITS = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  maxRedirects: 4,
  timeoutMs: 15_000,
})

const SAFE_MEDIA_TYPES = new Set([
  'application/pdf',
  'text/html',
  'text/plain',
  'application/xhtml+xml',
])

export class SourceIngestionError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SourceIngestionError'
    this.code = code
  }
}

function privateIpv4(address: string) {
  const [a, b, c] = address.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && [0, 2].includes(c)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = String(address || '')
    .toLocaleLowerCase()
    .split('%')[0]
  const family = isIP(normalized)
  if (family === 4) return privateIpv4(normalized)
  if (family !== 6) return true
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('ff') || normalized.startsWith('2001:db8:'))
    return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return privateIpv4(mapped[1])
  const mappedHex = normalized.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/)
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16)
    const low = Number.parseInt(mappedHex[2], 16)
    return privateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  return false
}

export async function validateSourceUrl(
  value: string | URL,
  { resolve = (hostname: string) => dnsLookup(hostname, { all: true }) } = {},
) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new SourceIngestionError('invalid_url', 'Source URL is invalid.')
  }
  if (!['http:', 'https:'].includes(url.protocol))
    throw new SourceIngestionError(
      'invalid_protocol',
      'Source URL must use HTTP or HTTPS.',
    )
  if (url.username || url.password)
    throw new SourceIngestionError(
      'embedded_credentials',
      'Source URLs cannot contain credentials.',
    )
  const records = await resolve(url.hostname)
  const addresses = (Array.isArray(records) ? records : [records]).map(
    (record: any) => (typeof record === 'string' ? record : record.address),
  )
  if (!addresses.length || addresses.some(isPrivateNetworkAddress))
    throw new SourceIngestionError(
      'private_network',
      'Source destination is not publicly routable.',
    )
  return url
}

function mediaType(response: Response) {
  return String(response.headers.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLocaleLowerCase()
}

async function readBoundedBody(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new SourceIngestionError(
      'source_too_large',
      'Source exceeds size limit.',
    )
  if (!response.body)
    throw new SourceIngestionError('empty_response', 'Source returned no body.')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new SourceIngestionError(
        'source_too_large',
        'Source exceeds size limit.',
      )
    }
    chunks.push(value)
  }
  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size,
  )
}

export async function fetchPermittedSource({
  sourceUrl,
  allowedRedirectHosts = [],
  fetchImpl = fetch,
  resolve,
  limits = SOURCE_LIMITS,
}: {
  sourceUrl: string
  allowedRedirectHosts?: string[]
  fetchImpl?: typeof fetch
  resolve?: (hostname: string) => Promise<any>
  limits?: typeof SOURCE_LIMITS
}) {
  const registered = await validateSourceUrl(sourceUrl, { resolve })
  let current = registered
  const allowedHosts = new Set([
    registered.hostname.toLocaleLowerCase(),
    ...allowedRedirectHosts.map((host) => String(host).toLocaleLowerCase()),
  ])
  for (let redirect = 0; redirect <= limits.maxRedirects; redirect += 1) {
    const response = await fetchImpl(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(limits.timeoutMs),
      headers: { 'user-agent': 'YOUNGO-Hub-Source-Monitor/1.0' },
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirect === limits.maxRedirects)
        throw new SourceIngestionError(
          'too_many_redirects',
          'Source exceeded redirect limit.',
        )
      const location = response.headers.get('location')
      if (!location)
        throw new SourceIngestionError(
          'invalid_redirect',
          'Source redirect has no destination.',
        )
      const next = await validateSourceUrl(new URL(location, current), {
        resolve,
      })
      if (!allowedHosts.has(next.hostname.toLocaleLowerCase()))
        throw new SourceIngestionError(
          'redirect_host_denied',
          'Source redirected to an unregistered host.',
        )
      current = next
      continue
    }
    if (!response.ok)
      throw new SourceIngestionError(
        'upstream_failure',
        `Source returned HTTP ${response.status}.`,
      )
    const type = mediaType(response)
    if (!SAFE_MEDIA_TYPES.has(type))
      throw new SourceIngestionError(
        'unsafe_media_type',
        'Source media type is not permitted.',
      )
    const bytes = await readBoundedBody(response, limits.maxBytes)
    return {
      bytes,
      mediaType: type,
      finalSourceUrl: current.toString(),
      contentHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    }
  }
  throw new SourceIngestionError(
    'too_many_redirects',
    'Source exceeded redirect limit.',
  )
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

export function assessExtractionText(value: any) {
  const text = String(value || '')
  if (!text.trim())
    throw new SourceIngestionError(
      'invalid_extraction',
      'Reviewed extraction text is required.',
    )
  if (text.length > EXTRACTION_MAX_CHARS)
    throw new SourceIngestionError(
      'extraction_too_large',
      'Reviewed extraction exceeds the text limit.',
    )
  const reasonCodes = EXTRACTION_RISKS.filter(([, pattern]) =>
    pattern.test(text),
  ).map(([code]) => code)
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
    throw new SourceIngestionError(
      'human_required',
      'A scoped human reviewer is required.',
    )
  const reviewNote = String(note || '').trim()
  if (reviewNote.length < 8 || reviewNote.length > 1000)
    throw new SourceIngestionError(
      'invalid_review_note',
      'Review note must contain 8 to 1000 characters.',
    )
  const extractionMethod = String(method || 'manual_correction').trim()
  if (
    !['manual_review', 'manual_correction', 'verified_ocr'].includes(
      extractionMethod,
    )
  )
    throw new SourceIngestionError(
      'invalid_extraction_method',
      'Extraction method is not permitted.',
    )
  const numericConfidence = Number(confidence)
  if (
    !Number.isFinite(numericConfidence) ||
    numericConfidence < 0 ||
    numericConfidence > 1
  )
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
      throw new SourceIngestionError(
        'version_not_found',
        'Document version not found.',
      )
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
          !hasCapability(
            access,
            `negotiations.evidence.review:negotiation_track:${trackId}`,
          ),
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
