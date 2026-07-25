import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { POLICY_VERSION } from '../src/content/membershipPolicy.js'

// Node test environment: stub localStorage
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    store.set(k, String(v))
  },
  removeItem: (k) => {
    store.delete(k)
  },
  clear: () => {
    store.clear()
  },
}

const {
  hasAcknowledgedMembershipPolicy,
  acknowledgeMembershipPolicy,
  clearMembershipPolicyAck,
  STORAGE_KEY,
} = await import('../src/lib/membershipGate.js')

describe('membershipGate', () => {
  beforeEach(() => {
    store.clear()
  })

  it('starts unacknowledged', () => {
    assert.equal(hasAcknowledgedMembershipPolicy(), false)
  })

  it('acknowledges current policy version', () => {
    const payload = acknowledgeMembershipPolicy()
    assert.equal(payload.version, POLICY_VERSION)
    assert.ok(payload.acknowledgedAt)
    assert.equal(hasAcknowledgedMembershipPolicy(), true)
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
    assert.equal(raw.version, POLICY_VERSION)
  })

  it('rejects stale version', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 'issue-1-old',
        acknowledgedAt: new Date().toISOString(),
      }),
    )
    assert.equal(hasAcknowledgedMembershipPolicy(), false)
  })

  it('clears acknowledgment', () => {
    acknowledgeMembershipPolicy()
    clearMembershipPolicyAck()
    assert.equal(hasAcknowledgedMembershipPolicy(), false)
  })
})
