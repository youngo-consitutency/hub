import { useCallback, useEffect, useState } from 'react'
import { MembershipMandateGate } from './MembershipMandateGate.jsx'
import { AuthGate } from './AuthGate.jsx'
import { ResetPassword } from '../pages/ResetPassword.jsx'
import { ChangePasswordGate } from './ChangePasswordGate.jsx'
import { Privacy } from '../pages/Privacy.jsx'
import { PublicSite } from '../pages/site/PublicSite.jsx'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate.js'
import { apiGet } from '../lib/api.js'
import { clearSession, getCachedAccount, setSession } from '../lib/session.js'
import { navigate, usePath } from '../lib/router.js'

/**
 * Controls access before the main application loads. Signed-out visitors land
 * on the public YOUNGO homepage. New members still accept the
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
      // The HttpOnly cookie is the authority. A missing local cache must not
      // strand an otherwise valid session (for example, after clearing storage).
      setAccount(getCachedAccount())
      await refreshSession()
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

  // Keep the old preview URL as an alias to the current public front page.
  if (path === '/landingV2' || path.startsWith('/landingV2/')) {
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

  // Signed-out visitors see the same public homepage as /about.
  if (path === '/') {
    return <PublicSite />
  }

  if (path === '/join' && !policyOk) {
    return <MembershipMandateGate onComplete={() => setPolicyOk(true)} />
  }

  const initialMode = path === '/join' ? 'register' : 'signin'
  return (
    <AuthGate key={initialMode} initialMode={initialMode} onAuthenticated={handleAuthenticated} />
  )
}
