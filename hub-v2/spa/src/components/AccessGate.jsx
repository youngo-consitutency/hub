import { useCallback, useEffect, useState } from 'react'
import { MembershipMandateGate } from './MembershipMandateGate.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ResetPassword } from '../pages/ResetPassword.jsx'
import { ChangePasswordGate } from './ChangePasswordGate.jsx'
import { Privacy } from '../pages/Privacy.jsx'
import { PublicSite } from '../pages/site/PublicSite.jsx'
import { PlatformLanding } from '../pages/PlatformLanding.jsx'
import { PlatformLandingV2 } from '../pages/PlatformLandingV2.jsx'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate.js'
import { apiGet } from '../lib/api.js'
import {
  clearSession,
  getCachedAccount,
  hasCachedSession,
  setSession,
} from '../lib/session.js'
import { navigate, usePath } from '../lib/router.js'

/**
 * Controls access before the main application loads. Signed-out visitors land
 * on a member desk where they can sign in. New members still accept the
 * membership policy before registering. App.jsx handles course-verification
 * and role-specific routes.
 */
export function AccessGate({ children }) {
  const path = usePath()
  const [ready, setReady] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  const [account, setAccount] = useState(null)

  const handleAuthenticated = useCallback(
    (acc) => {
      setAccount(acc)
      if (
        path === '/join' ||
        path === '/signin' ||
        path === '/landingV2' ||
        path.startsWith('/landingV2/')
      ) {
        navigate('/')
      }
    },
    [path],
  )

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
      // first paint; `/auth/me` confirms or clears it. Anonymous visitors see
      // the member desk immediately; a background 401 must not clear a login
      // that happens on that desk.
      if (hasCachedSession()) {
        setAccount(getCachedAccount())
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

  // Constituency-facing landing preview. Public like /about so a signed-in
  // teammate can review it; the live member desk stays at /.
  if (path === '/landingV2' || path.startsWith('/landingV2/')) {
    return <PlatformLandingV2 onAuthenticated={handleAuthenticated} />
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
          <p className="meta" role="status">
            Loading YOUNGO Hub…
          </p>
        </div>
      </main>
    )
  }

  // Published negotiation evidence is a public projection. It must remain
  // reachable without accepting membership terms or creating an account.
  if (!account && path.startsWith('/negotiations')) {
    return <>{typeof children === 'function' ? children(null) : children}</>
  }

  // Signed-in members always enter the Hub. The membership policy is only a
  // gate for people who do not yet have an account.
  if (account) {
    if (account.mustChangePassword) {
      return (
        <ChangePasswordGate
          account={account}
          onChanged={(next) => {
            if (next) {
              setAccount(next)
              setSession({ account: next })
            } else {
              refreshSession()
            }
          }}
        />
      )
    }
    return <>{typeof children === 'function' ? children(account) : children}</>
  }

  // The signed-out front door is a member desk: sign in here, or go to /join.
  if (path === '/') {
    return <PlatformLanding onAuthenticated={handleAuthenticated} />
  }

  if (path === '/join' && !policyOk) {
    return <MembershipMandateGate onComplete={() => setPolicyOk(true)} />
  }

  const initialMode = path === '/join' ? 'register' : 'signin'
  return (
    <AuthGate
      key={initialMode}
      initialMode={initialMode}
      onAuthenticated={handleAuthenticated}
    />
  )
}
