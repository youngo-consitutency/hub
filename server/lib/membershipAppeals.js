import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { readJson, writeJson } from './jsonFile.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const appealsPath = path.join(here, '../../data/membership-appeals.json')

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

function appealError(status, code, message) {
  return Object.assign(new Error(message), { status, code })
}

function pick(row, snake, camel, fallback = null) {
  const value = row?.[snake] ?? row?.[camel]
  return value == null ? fallback : value
}

export function publicAppeal(row, { includeStatement = true } = {}) {
  if (!row) return null
  return {
    id: row.id,
    accountId: pick(row, 'account_id', 'accountId'),
    status: row.status,
    identityKind: pick(row, 'identity_kind', 'identityKind'),
    statement: includeStatement ? pick(row, 'statement', 'statement') : null,
    proofContentType: pick(row, 'proof_content_type', 'proofContentType'),
    proofByteSize: Number(pick(row, 'proof_byte_size', 'proofByteSize') || 0),
    submittedAt: pick(row, 'created_at', 'createdAt'),
    reviewedAt: pick(row, 'reviewed_at', 'reviewedAt'),
    reviewerNote: pick(row, 'reviewer_note', 'reviewerNote'),
  }
}

export function validateAppealProof(bytes, contentType) {
  const type = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!APPEAL_PROOF_TYPES.has(type)) {
    throw appealError(
      400,
      'validation',
      'Upload a JPEG, PNG, WebP, or PDF of the identity document.',
    )
  }
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw appealError(400, 'validation', 'Choose a document to upload.')
  }
  if (bytes.length > APPEAL_PROOF_MAX_BYTES) {
    throw appealError(
      413,
      'payload_too_large',
      'Identity documents must be 2 MB or smaller.',
    )
  }
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
  if (!signatureOk) {
    throw appealError(
      400,
      'validation',
      'The uploaded file does not match its document type.',
    )
  }
  return type
}

function validateAppealInput({
  account,
  statement,
  identityKind,
  bytes,
  contentType,
}) {
  if (account?.membershipStatus !== 'rejected') {
    throw appealError(
      403,
      'forbidden',
      'Only a rejected application can send an identity appeal.',
    )
  }
  const kind = String(identityKind || '').trim()
  if (!APPEAL_IDENTITY_KINDS.includes(kind)) {
    throw appealError(
      400,
      'validation',
      'Choose what kind of identity proof this is.',
    )
  }
  const text = String(statement || '').trim()
  if (text.length < 40) {
    throw appealError(
      400,
      'validation',
      'Explain who you are in at least 40 characters.',
    )
  }
  if (text.length > 2000) {
    throw appealError(
      400,
      'validation',
      'Keep the appeal under 2000 characters.',
    )
  }
  const type = validateAppealProof(bytes, contentType)
  return { kind, text, type }
}

async function countAppeals(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS total FROM membership_appeals WHERE account_id=$1',
      [accountId],
    )
    return rows[0]?.total || 0
  }
  return readJson(appealsPath, []).filter(
    (row) => pick(row, 'account_id', 'accountId') === accountId,
  ).length
}

export async function getOwnAppeal(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT id, account_id, status, identity_kind, statement, proof_content_type,
              proof_byte_size, reviewer_note, created_at, reviewed_at
       FROM membership_appeals
       WHERE account_id=$1
       ORDER BY created_at DESC
       LIMIT 1`,
      [accountId],
    )
    return publicAppeal(rows[0])
  }
  const rows = readJson(appealsPath, [])
    .filter((row) => pick(row, 'account_id', 'accountId') === accountId)
    .sort((a, b) =>
      String(pick(b, 'created_at', 'createdAt')).localeCompare(
        String(pick(a, 'created_at', 'createdAt')),
      ),
    )
  return publicAppeal(rows[0])
}

export async function listLatestAppealsForAccounts(accountIds) {
  const ids = [...new Set((accountIds || []).filter(Boolean))]
  const map = new Map()
  if (!ids.length) return map
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (account_id)
              id, account_id, status, identity_kind, statement, proof_content_type,
              proof_byte_size, reviewer_note, created_at, reviewed_at
       FROM membership_appeals
       WHERE account_id = ANY($1::uuid[])
       ORDER BY account_id, created_at DESC`,
      [ids],
    )
    for (const row of rows) map.set(row.account_id, publicAppeal(row))
    return map
  }
  const rows = readJson(appealsPath, [])
  for (const row of rows) {
    const accountId = pick(row, 'account_id', 'accountId')
    if (!ids.includes(accountId)) continue
    const current = map.get(accountId)
    const stamp = pick(row, 'created_at', 'createdAt')
    if (
      !current ||
      String(stamp).localeCompare(String(current.submittedAt)) > 0
    ) {
      map.set(accountId, publicAppeal(row))
    }
  }
  return map
}

export async function submitAppeal({
  account,
  statement,
  identityKind,
  bytes,
  contentType,
}) {
  const { kind, text, type } = validateAppealInput({
    account,
    statement,
    identityKind,
    bytes,
    contentType,
  })
  const total = await countAppeals(account.id)
  if (total >= APPEAL_MAX_PER_ACCOUNT) {
    throw appealError(
      409,
      'appeal_limit',
      'This application has already used its three identity appeals.',
    )
  }
  const existing = await getOwnAppeal(account.id)
  if (existing?.status === 'submitted') {
    throw appealError(
      409,
      'appeal_open',
      'An identity appeal is already waiting for the Membership Team.',
    )
  }
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO membership_appeals (
           account_id, status, identity_kind, statement,
           proof_content_type, proof_bytes, proof_byte_size
         ) VALUES ($1,'submitted',$2,$3,$4,$5,$6)
         RETURNING id, account_id, status, identity_kind, statement,
                   proof_content_type, proof_byte_size, reviewer_note,
                   created_at, reviewed_at`,
        [account.id, kind, text, type, bytes, bytes.length],
      )
      return publicAppeal(rows[0])
    } catch (error) {
      if (error.code === '23505') {
        throw appealError(
          409,
          'appeal_open',
          'An identity appeal is already waiting for the Membership Team.',
        )
      }
      throw error
    }
  }
  const list = readJson(appealsPath, [])
  const row = {
    id: randomUUID(),
    account_id: account.id,
    status: 'submitted',
    identity_kind: kind,
    statement: text,
    proof_content_type: type,
    proof_bytes_base64: bytes.toString('base64'),
    proof_byte_size: bytes.length,
    reviewer_id: null,
    reviewer_note: null,
    created_at: now,
    reviewed_at: null,
  }
  list.unshift(row)
  writeJson(appealsPath, list)
  return publicAppeal(row)
}

export async function readAppealProof(id) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT id, account_id, proof_content_type, proof_bytes, proof_byte_size
       FROM membership_appeals WHERE id=$1`,
      [id],
    )
    return rows[0] || null
  }
  const row = readJson(appealsPath, []).find((item) => item.id === id)
  if (!row) return null
  return {
    id: row.id,
    account_id: row.account_id,
    proof_content_type: row.proof_content_type,
    proof_bytes: Buffer.from(row.proof_bytes_base64, 'base64'),
    proof_byte_size: row.proof_byte_size,
  }
}

export async function findAppealById(id) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT id, account_id, status, identity_kind, statement, proof_content_type,
              proof_byte_size, reviewer_note, created_at, reviewed_at
       FROM membership_appeals WHERE id=$1`,
      [id],
    )
    return rows[0] || null
  }
  return readJson(appealsPath, []).find((item) => item.id === id) || null
}

export async function reviewAppeal({ id, decision, note, reviewerId }) {
  const next =
    decision === 'grant' ? 'granted' : decision === 'uphold' ? 'upheld' : null
  if (!next) {
    throw appealError(400, 'validation', 'Choose grant or uphold.')
  }
  const reason = String(note || '').trim()
  if (reason.length < 8) {
    throw appealError(
      400,
      'validation',
      'Give a review note of at least 8 characters.',
    )
  }
  const existing = await findAppealById(id)
  if (!existing) return null
  if (pick(existing, 'status', 'status') !== 'submitted') {
    throw appealError(
      409,
      'already_reviewed',
      'This appeal has already been reviewed.',
    )
  }
  const now = new Date().toISOString()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE membership_appeals
       SET status=$2, reviewer_id=$3, reviewer_note=$4, reviewed_at=now()
       WHERE id=$1 AND status='submitted'
       RETURNING id, account_id, status, identity_kind, statement, proof_content_type,
                 proof_byte_size, reviewer_note, created_at, reviewed_at`,
      [id, next, reviewerId, reason.slice(0, 500)],
    )
    return rows[0] ? publicAppeal(rows[0]) : null
  }
  const list = readJson(appealsPath, [])
  const row = list.find((item) => item.id === id)
  if (!row || row.status !== 'submitted') return null
  row.status = next
  row.reviewer_id = reviewerId
  row.reviewer_note = reason.slice(0, 500)
  row.reviewed_at = now
  writeJson(appealsPath, list)
  return publicAppeal(row)
}
