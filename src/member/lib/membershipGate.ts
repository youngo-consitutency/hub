const STORAGE_KEY = 'youngo-hub:membership-policy-ack'

/** True if the visitor acknowledged the current policy version (from the membership-policy document). */
export function hasAcknowledgedMembershipPolicy(policyVersion: string | null | undefined) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const data = JSON.parse(raw)
    return data?.version === policyVersion && Boolean(data?.acknowledgedAt)
  } catch {
    return false
  }
}

export function acknowledgeMembershipPolicy(policyVersion: string | null | undefined) {
  const payload = {
    version: policyVersion,
    acknowledgedAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  return payload
}
