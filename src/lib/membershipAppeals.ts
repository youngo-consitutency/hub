import { type Pool } from 'pg'
import { ApiError } from './respond'
import { requirePgPool, getPgPool, pickField } from './pg'

// Identity appeals: members submit a statement + proof document; the
// membership team reviews them. Proofs are bytea, access-scoped.


export const APPEAL_IDENTITY_KINDS = [
  'passport',
  'national_id',
  'organisational_letter',
  'other',
]
export const APPEAL_PROOF_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])
export const APPEAL_PROOF_MAX_BYTES = 2 * 1024 * 1024
export const APPEAL_MAX_PER_ACCOUNT = 3

export function publicAppeal(
  row: any,
  { includeStatement = true } = {},
): any {
  if (!row) return null
  return {
    id: row.id,
    accountId: pickField(row, 'account_id', 'accountId'),
    status: row.status,
    identityKind: pickField(row, 'identity_kind', 'identityKind'),
    statement: includeStatement ? pickField(row, 'statement', 'statement') : null,
    proofContentType: pickField(row, 'proof_content_type', 'proofContentType'),
    proofByteSize: Number(pickField(row, 'proof_byte_size', 'proofByteSize') || 0),
    submittedAt: pickField(row, 'created_at', 'createdAt'),
    reviewedAt: pickField(row, 'reviewed_at', 'reviewedAt'),
    reviewerNote: pickField(row, 'review_note', 'reviewerNote'),
  }
}

export function validateAppealProof(bytes: Buffer, contentType: string) {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase()
  if (!APPEAL_PROOF_TYPES.has(type))
    throw new ApiError(
      400,
      'validation',
      'Upload a JPEG, PNG, WebP, or PDF of the identity document.',
    )
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw new ApiError(400, 'validation', 'Choose a document to upload.')
  if (bytes.length > APPEAL_PROOF_MAX_BYTES)
    throw new ApiError(
      413,
      'payload_too_large',
      'Identity documents must be 2 MB or smaller.',
    )
  const signatureOk =
    (type === 'image/jpeg' &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (type === 'image/png' &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (type === 'image/webp' &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP') ||
    (type === 'application/pdf' &&
      bytes.subarray(0, 4).toString('ascii') === '%PDF')
  if (!signatureOk)
    throw new ApiError(
      400,
      'validation',
      'The uploaded file does not match its document type.',
    )
  return type
}

function validateAppealInput({
  account,
  statement,
  identityKind,
  bytes,
  contentType,
}: {
  account: any
  statement: string
  identityKind: string
  bytes: Buffer
  contentType: string
}) {
  if (account?.membershipStatus !== 'rejected')
    throw new ApiError(
      403,
      'forbidden',
      'Only a rejected application can send an identity appeal.',
    )
  const kind = String(identityKind || '').trim()
  if (!APPEAL_IDENTITY_KINDS.includes(kind))
    throw new ApiError(
      400,
      'validation',
      'Choose what kind of identity proof this is.',
    )
  const text = String(statement || '').trim()
  if (text.length < 40)
    throw new ApiError(
      400,
      'validation',
      'Explain who you are in at least 40 characters.',
    )
  if (text.length > 2000)
    throw new ApiError(
      400,
      'validation',
      'Keep the appeal under 2000 characters.',
    )
  const type = validateAppealProof(bytes, contentType)
  return { kind, text, type }
}

const APPEAL_COLUMNS = `id, account_id, status, identity_kind, statement,
  proof_content_type, proof_byte_size, review_note, created_at, reviewed_at`

export async function getOwnAppeal(accountId: number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT ${APPEAL_COLUMNS} FROM membership_appeals
     WHERE account_id=$1 ORDER BY created_at DESC LIMIT 1`,
    [accountId],
  )
  return publicAppeal(rows[0])
}

export async function listLatestAppealsForAccounts(
  accountIds: (number | string)[],
  pool?: Pool | null,
) {
  const ids = [...new Set((accountIds || []).filter(Boolean))]
  const map = new Map()
  if (!ids.length) return map
  const db = pool || getPgPool()
  if (!db) return map
  const { rows } = await db.query(
    `SELECT DISTINCT ON (account_id) ${APPEAL_COLUMNS}
     FROM membership_appeals
     WHERE account_id = ANY($1::int[])
     ORDER BY account_id, created_at DESC`,
    [ids],
  )
  for (const row of rows) map.set(row.account_id, publicAppeal(row))
  return map
}

export async function submitAppeal({
  account,
  statement,
  identityKind,
  bytes,
  contentType,
}: {
  account: any
  statement: string
  identityKind: string
  bytes: Buffer
  contentType: string
}) {
  const { kind, text, type } = validateAppealInput({
    account,
    statement,
    identityKind,
    bytes,
    contentType,
  })
  const pool = requirePgPool()
  const count = await pool.query(
    'SELECT count(*)::int AS total FROM membership_appeals WHERE account_id=$1',
    [account.id],
  )
  if ((count.rows[0]?.total || 0) >= APPEAL_MAX_PER_ACCOUNT)
    throw new ApiError(
      409,
      'appeal_limit',
      'This application has already used its three identity appeals.',
    )
  const existing = await getOwnAppeal(account.id, pool)
  if (existing?.status === 'submitted')
    throw new ApiError(
      409,
      'appeal_open',
      'An identity appeal is already waiting for the Membership Team.',
    )
  try {
    const { rows } = await pool.query(
      `INSERT INTO membership_appeals (
         account_id, status, identity_kind, statement,
         proof_content_type, proof_bytes, proof_byte_size,
         review_note, created_at, updated_at
       ) VALUES ($1,'submitted',$2,$3,$4,$5,$6,'',now(),now())
       RETURNING ${APPEAL_COLUMNS}`,
      [account.id, kind, text, type, bytes, bytes.length],
    )
    return publicAppeal(rows[0])
  } catch (error: any) {
    if (error.code === '23505')
      throw new ApiError(
        409,
        'appeal_open',
        'An identity appeal is already waiting for the Membership Team.',
      )
    throw error
  }
}

export async function readAppealProof(id: string | number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT id, account_id, proof_content_type, proof_bytes, proof_byte_size
     FROM membership_appeals WHERE id=$1`,
    [id],
  )
  return rows[0] || null
}

export async function findAppealById(id: string | number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT ${APPEAL_COLUMNS} FROM membership_appeals WHERE id=$1`,
    [id],
  )
  return rows[0] || null
}

export async function reviewAppeal({
  id,
  decision,
  note,
  reviewerId,
}: {
  id: string | number
  decision: string
  note: string
  reviewerId: number
}) {
  const next =
    decision === 'grant' ? 'granted' : decision === 'uphold' ? 'upheld' : null
  if (!next)
    throw new ApiError(400, 'validation', 'Choose grant or uphold.')
  const reason = String(note || '').trim()
  if (reason.length < 8)
    throw new ApiError(
      400,
      'validation',
      'Give a review note of at least 8 characters.',
    )
  const existing = await findAppealById(id)
  if (!existing) return null
  if (existing.status !== 'submitted')
    throw new ApiError(
      409,
      'already_reviewed',
      'This appeal has already been reviewed.',
    )
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `UPDATE membership_appeals
     SET status=$2, reviewed_by_id=$3, review_note=$4, reviewed_at=now(), updated_at=now()
     WHERE id=$1 AND status='submitted'
     RETURNING ${APPEAL_COLUMNS}`,
    [id, next, reviewerId, reason.slice(0, 500)],
  )
  return rows[0] ? publicAppeal(rows[0]) : null
}
