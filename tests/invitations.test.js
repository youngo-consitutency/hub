import test from 'node:test'
import assert from 'node:assert/strict'
import {
  newInviteSecret,
  inviteDigest,
  inviteExpiry,
  inviteMatches,
  inviteSeatRole,
} from '../server/lib/invitations.js'
import { publicSeat } from '../server/lib/lifecycle.js'

test('invitation storage uses a digest rather than the bearer secret', () => {
  const token = newInviteSecret()
  const digest = inviteDigest(token)
  assert.equal(token.length, 64)
  assert.equal(digest.length, 64)
  assert.notEqual(digest, token)
})

test('invitation validation binds token, invited email, status, and expiry', () => {
  const now = Date.parse('2026-07-25T12:00:00Z')
  const token = newInviteSecret()
  const row = {
    status: 'invited',
    email: 'member@example.org',
    invite_token_hash: inviteDigest(token),
    invite_expires_at: inviteExpiry(now),
  }

  assert.equal(inviteMatches(row, token, 'MEMBER@example.org', now), true)
  assert.equal(inviteMatches(row, token, 'attacker@example.org', now), false)
  assert.equal(
    inviteMatches(row, 'wrong-token', 'member@example.org', now),
    false,
  )
  assert.equal(
    inviteMatches(
      row,
      token,
      'member@example.org',
      Date.parse(row.invite_expires_at),
    ),
    false,
  )
})

test('seat responses never expose stored invitation credentials', () => {
  const seat = publicSeat({
    id: 'seat-1',
    org_account_id: 'org-1',
    email: 'member@example.org',
    seat_role: 'viewer',
    status: 'invited',
    invite_token: 'legacy-secret',
    invite_token_hash: 'stored-digest',
    invite_expires_at: '2026-08-01T12:00:00.000Z',
  })

  assert.equal(Object.hasOwn(seat, 'inviteToken'), false)
  assert.equal(Object.hasOwn(seat, 'invite_token'), false)
  assert.equal(Object.hasOwn(seat, 'invite_token_hash'), false)
  assert.equal(seat.inviteExpiresAt, '2026-08-01T12:00:00.000Z')
})

test('invitations cannot mint owner seats', () => {
  assert.equal(inviteSeatRole('viewer'), 'viewer')
  assert.equal(inviteSeatRole('representative'), 'representative')
  assert.equal(inviteSeatRole('owner'), 'representative')
})
