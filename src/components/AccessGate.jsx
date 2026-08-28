import { useCallback, useEffect, useState } from 'react'
import { MembershipMandateGate } from './MembershipMandateGate.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ResetPassword } from '../pages/ResetPassword.jsx'
import { Privacy } from '../pages/Privacy.jsx'
import { PublicSite } from '../pages/site/PublicSite.jsx'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate.js'
import { apiGet } from '../lib/api.js'
import {
  clearSession,
  getCachedAccount,
  hasCachedSession,
  setSession,
} from '../lib/session.js'
import { usePath } from '../lib/router.js'

/**
 * Controls access before the main application loads. Visitors first read the
 * Membership Policy, then create an account or sign in. App.jsx handles
 * course-verification and role-specific routes.
 */
export function AccessGate({ children }) {
  const path = usePath()
  const [ready, setReady] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  const [account, setAccount] = useState(null)

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiGet('/auth/me')
      setAccount(data.account)
      setSession({ account: data.account })
    } catch {
      clearSession()
      setAccount(null)
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const policy = hasAcknowledgedMembershipPolicy()
      if (!alive) return
      setPolicyOk(policy)
      // The session cookie is HttpOnly, so the client cannot inspect it — the
      // server is asked on every load. Cached profile data only pre-fills the
      // first paint; `/auth/me` confirms or clears it.
      if (policy) {
        if (hasCachedSession()) setAccount(getCachedAccount())
        await refreshSession()
      }
      if (alive) setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [refreshSession])

  if (path.startsWith('/reset-password')) {
    return <ResetPassword />
  }

  // The privacy notice must be readable before someone is asked for personal data.
  if (path.startsWith('/privacy')) {
    return <Privacy standalone />
  }

  // Public website: anyone curious about the constituency can browse it
  // before any gate — no account, policy scroll, or cookies required. All
  // data it shows comes from the public API, which redacts member-only
  // details.
  if (path.startsWith('/about')) {
    return <PublicSite />
  }

  if (!ready) {
    return (
      <main className="mandateGate" aria-busy="true">
        <div
          className="mandateShell"
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <p className="meta">Loading YOUNGO Hub...</p>
        </div>
      </main>
    )
  }

  if (!policyOk) {
    return <MembershipMandateGate onComplete={() => setPolicyOk(true)} />
  }

  if (!account) {
    return <AuthGate onAuthenticated={(acc) => setAccount(acc)} />
  }

  return <>{typeof children === 'function' ? children(account) : children}</>
}
