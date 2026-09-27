import { POLICY_VERSION } from '../content/membershipPolicy.js'

const STORAGE_KEY = 'youngo-hub:membership-policy-ack'

/**
 * Returns true if the visitor has acknowledged the current policy version.
 * A new policy version requires another acknowledgement.
 */
export function hasAcknowledgedMembershipPolicy() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    return data?.version === POLICY_VERSION && Boolean(data?.acknowledgedAt)
  } catch {
    return false
  }
}

export function acknowledgeMembershipPolicy() {
  const payload = {
    version: POLICY_VERSION,
    acknowledgedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function clearMembershipPolicyAck() {
  localStorage.removeItem(STORAGE_KEY)
}

export { STORAGE_KEY }
