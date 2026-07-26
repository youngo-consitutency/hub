import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AFFILIATION_ROLES } from '../server/lib/lifecycle.js'
import {
  canReadNgo,
  canWriteNgoRequests,
  canManageNgoSeats,
} from '../server/lib/authorization.js'

// An individual can ask to be linked to the organisation they work with, and
// the organisation chooses what that link grants. The seat roles below decide
// whether the link is a label or an actual key to the organisation's data.
describe('organisation affiliation seat roles', () => {
  it('offers exactly the roles an organisation may grant on approval', () => {
    assert.deepEqual(AFFILIATION_ROLES, [
      'affiliate',
      'viewer',
      'representative',
    ])
    assert.equal(
      AFFILIATION_ROLES.includes('owner'),
      false,
      'approving a request must never hand over ownership of the organisation',
    )
  })

  it('records the affiliation without opening the organisation portal', () => {
    const affiliate = { seatRole: 'affiliate' }
    assert.equal(canReadNgo(affiliate), false)
    assert.equal(canWriteNgoRequests(affiliate), false)
    assert.equal(canManageNgoSeats(affiliate), false)
  })

  it('grants read-only access to a viewer and write access to a representative', () => {
    assert.equal(canReadNgo({ seatRole: 'viewer' }), true)
    assert.equal(canWriteNgoRequests({ seatRole: 'viewer' }), false)

    assert.equal(canReadNgo({ seatRole: 'representative' }), true)
    assert.equal(canWriteNgoRequests({ seatRole: 'representative' }), true)
    assert.equal(
      canManageNgoSeats({ seatRole: 'representative' }),
      false,
      'only an owner may manage seats',
    )
  })
})
