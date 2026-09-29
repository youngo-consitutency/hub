import { fileTypeFromBuffer } from 'file-type'
import { type Pool } from 'pg'
import { ApiError } from './respond'
import { requirePgPool, getPgPool } from './pg'

// Profile photos live in bytea tables — never the public media store.

const MEMBER_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MEMBER_PHOTO_MAX_BYTES = 768 * 1024

export async function validateMemberPhoto(bytes: Buffer, contentType: string) {
  const type = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  if (!MEMBER_PHOTO_TYPES.has(type))
    throw new ApiError(400, 'validation', 'Use a JPEG, PNG, or WebP image.')
  if (!Buffer.isBuffer(bytes) || bytes.length === 0)
    throw new ApiError(400, 'validation', 'Choose an image to upload.')
  if (bytes.length > MEMBER_PHOTO_MAX_BYTES)
    throw new ApiError(413, 'payload_too_large', 'Profile photos must be 768 KB or smaller.')
  const detected = await fileTypeFromBuffer(bytes)
  if (detected?.mime !== type)
    throw new ApiError(400, 'validation', 'The uploaded file does not match its image type.')
  return type
}

export async function saveMemberPhoto(
  accountId: number,
  bytes: Buffer,
  contentType: string,
  actorId?: number,
) {
  const type = await validateMemberPhoto(bytes, contentType)
  const pool = requirePgPool()
  await pool.query(
    `INSERT INTO member_profiles(account_id, display_name, created_at, updated_at)
     VALUES($1,'',now(),now()) ON CONFLICT(account_id) DO NOTHING`,
    [accountId],
  )
  const { rows } = await pool.query(
    `INSERT INTO member_profile_photos(account_id, content_type, bytes, byte_size, updated_by)
     VALUES($1,$2,$3,$4,$5)
     ON CONFLICT(account_id) DO UPDATE SET
       content_type=EXCLUDED.content_type,
       bytes=EXCLUDED.bytes,
       byte_size=EXCLUDED.byte_size,
       revision=member_profile_photos.revision + 1,
       updated_by=EXCLUDED.updated_by,
       updated_at=now()
     RETURNING content_type, byte_size, revision, updated_at`,
    [accountId, type, bytes, bytes.length, actorId || accountId],
  )
  return rows[0]
}

export async function readMemberPhoto(accountId: number, pool?: Pool | null) {
  const db = pool || getPgPool()
  if (!db) return null
  const { rows } = await db.query(
    `SELECT content_type, bytes, byte_size, revision, updated_at
     FROM member_profile_photos WHERE account_id=$1`,
    [accountId],
  )
  return rows[0] || null
}

export async function deleteMemberPhoto(accountId: number) {
  const pool = requirePgPool()
  const result = await pool.query('DELETE FROM member_profile_photos WHERE account_id=$1', [
    accountId,
  ])
  return (result.rowCount || 0) > 0
}
