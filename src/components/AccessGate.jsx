import { useCallback, useEffect, useState } from 'react'
import { FloatingThemeToggle } from './FloatingThemeToggle.jsx'
import { MembershipMandateGate } from './MembershipMandateGate.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ResetPassword } from '../pages/ResetPassword.jsx'
import { Privacy } from '../pages/Privacy.jsx'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate.js'
import { applyTheme, getInitialTheme } from '../lib/theme.js'
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
    ;(async () => {
      applyTheme(getInitialTheme())
      const policy = hasAcknowledgedMembershipPolicy()
      if (!alive) return
      setPolicyOk(policy)
      if (policy) {
        setAccount(getCachedAccount())
        await refreshSession()
      }
      if (alive) setReady(true)
    })()
    return () => { alive = false }
  }, [refreshSession])

  if (path.startsWith('/reset-password')) {
    return (
      <>
        <FloatingThemeToggle />
        <ResetPassword />
      </>
    )
  }

  // Readable without an account: consent is not informed if you must first hand
  // over data to find out what happens to it.
  if (path.startsWith('/privacy')) {
    return (
      <>
        <FloatingThemeToggle />
        <Privacy standalone />
      </>
    )
  }

  if (!ready) {
    return (
      <>
        <FloatingThemeToggle />
        <div className="mandateGate" aria-busy="true">
          <div className="mandateShell" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <p className="meta">Loading YOUNGO Hub...</p>
          </div>
        </div>
      </>
    )
  }

  if (!policyOk) {
    return (
      <>
        <FloatingThemeToggle />
        <MembershipMandateGate onComplete={() => setPolicyOk(true)} />
      </>
    )
  }

  if (!account) {
    return (
      <>
        <FloatingThemeToggle />
        <AuthGate
          onAuthenticated={(acc) => setAccount(acc)}
        />
      </>
    )
  }

  return (
    <>
      <FloatingThemeToggle />
      {typeof children === 'function' ? children(account) : children}
    </>
  )
}
