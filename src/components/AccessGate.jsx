import { useCallback, useEffect, useState } from 'react'
import { MembershipMandateGate } from './MembershipMandateGate.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ResetPassword } from '../pages/ResetPassword.jsx'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate.js'
import { apiGet } from '../lib/api.js'
import { clearSession, getCachedAccount, getSessionToken, setSession } from '../lib/session.js'
import { usePath } from '../lib/router.js'

/**
 * Two-step unlock for YOUNGO Hub:
 * 1) Mandatory Membership Policy read
 * 2) Create account or sign in
 * Feature gating by verification is handled in App routes.
 * Password reset is available without a session.
 */
export function AccessGate({ children }) {
  const path = usePath()
  const [ready, setReady] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  const [account, setAccount] = useState(null)

  const refreshSession = useCallback(async () => {
    const token = getSessionToken()
    if (!token) {
      setAccount(null)
      return
    }
    try {
      const data = await apiGet('/auth/me')
      setAccount(data.account)
      setSession({ token, account: data.account })
    } catch {
      clearSession()
      setAccount(null)
    }
  }, [])

  useEffect(() => {
    let alive = true
      ; (async () => {
        const policy = hasAcknowledgedMembershipPolicy()
        if (!alive) return
        setPolicyOk(policy)
        if (policy && getSessionToken()) {
          setAccount(getCachedAccount())
          await refreshSession()
        }
        if (alive) setReady(true)
      })()
    return () => { alive = false }
  }, [refreshSession])

  // Password reset is public (token in URL) — skip policy/login gate
  if (path.startsWith('/reset-password')) {
    return <ResetPassword />
  }

  if (!ready) {
    return (
      <div className="mandateGate" aria-busy="true">
        <div className="mandateShell" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <p className="meta">Loading YOUNGO Hub…</p>
        </div>
      </div>
    )
  }

  if (!policyOk) {
    return <MembershipMandateGate onComplete={() => setPolicyOk(true)} />
  }

  if (!account) {
    return (
      <AuthGate
        onAuthenticated={(acc) => setAccount(acc)}
      />
    )
  }

  return typeof children === 'function' ? children(account) : children
}
