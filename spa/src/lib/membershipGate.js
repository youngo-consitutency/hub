const STORAGE_KEY = 'youngo-hub:membership-policy-ack'

/**
 * Returns true if the visitor has acknowledged the given policy version.
 * A new policy version requires another acknowledgement. The current
 * version comes from the membership-policy content document.
 */
export function hasAcknowledgedMembershipPolicy(policyVersion) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    return data?.version === policyVersion && Boolean(data?.acknowledgedAt)
  } catch {
    return false
  }
}

export function acknowledgeMembershipPolicy(policyVersion) {
  const payload = {
    version: policyVersion,
    acknowledgedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  return payload
}

export function clearMembershipPolicyAck() {
  localStorage.removeItem(STORAGE_KEY)
}

export { STORAGE_KEY }
