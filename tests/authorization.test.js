import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canManageWg,
  canReadNgo,
  canWriteNgoRequests,
  canManageNgoSeats,
} from '../server/lib/authorization.js'

const member = { id: 'member-1', role: 'member', isVerified: true }

test('WG management is bound to the requested WG progress row', () => {
  assert.equal(
    canManageWg(
      member,
      {
        account_id: member.id,
        wg_slug: 'finance',
        role_in_wg: 'contact',
        status: 'active',
      },
      'finance',
    ),
    true,
  )

  assert.equal(
    canManageWg(
      member,
      {
        account_id: member.id,
        wg_slug: 'finance',
        role_in_wg: 'contact',
        status: 'active',
      },
      'ace',
    ),
    false,
  )
})

test('platform administrators retain WG override access', () => {
  assert.equal(canManageWg({ ...member, role: 'admin' }, null, 'finance'), true)
})

test('NGO capabilities distinguish viewer, representative, and owner', () => {
  const viewer = { orgAccountId: 'org-1', seatRole: 'viewer' }
  const representative = { orgAccountId: 'org-1', seatRole: 'representative' }
  const owner = { orgAccountId: 'org-1', seatRole: 'owner' }

  assert.equal(canReadNgo(viewer), true)
  assert.equal(canWriteNgoRequests(viewer), false)
  assert.equal(canManageNgoSeats(viewer), false)

  assert.equal(canWriteNgoRequests(representative), true)
  assert.equal(canManageNgoSeats(representative), false)

  assert.equal(canWriteNgoRequests(owner), true)
  assert.equal(canManageNgoSeats(owner), true)
})
