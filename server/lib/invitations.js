import { createHash, randomBytes } from 'node:crypto'

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function newInviteSecret() {
  return randomBytes(32).toString('hex')
}

export function inviteDigest(token) {
  return createHash('sha256')
    .update(String(token || ''))
    .digest('hex')
}

export function inviteExpiry(now = Date.now()) {
  return new Date(now + INVITE_TTL_MS).toISOString()
}

export function inviteSeatRole(value) {
  return ['representative', 'viewer'].includes(value) ? value : 'representative'
}

export function inviteMatches(row, token, accountEmail, now = Date.now()) {
  if (!row || row.status !== 'invited') return false
  if (!row.invite_token_hash || row.invite_token_hash !== inviteDigest(token))
    return false
  if (
    !row.invite_expires_at ||
    new Date(row.invite_expires_at).getTime() <= now
  )
    return false
  return (
    String(row.email || '')
      .trim()
      .toLowerCase() ===
    String(accountEmail || '')
      .trim()
      .toLowerCase()
  )
}
