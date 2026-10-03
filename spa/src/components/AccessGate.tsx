import { useCallback, useEffect, useState } from 'react'
import { MembershipMandateGate } from './MembershipMandateGate'
import { AuthGate } from './AuthGate'
import { ResetPassword } from '../pages/ResetPassword'
import { ChangePasswordGate } from './ChangePasswordGate'
import { Privacy } from '../pages/Privacy'
import { PublicSite } from '../pages/site/PublicSite'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate'
import { useDocument } from '../lib/documents'
import { apiGet } from '../lib/api'
import { clearSession, getCachedAccount, setSession } from '../lib/session'
import { navigate, usePath } from '../lib/router'

/**
 * Controls access before the main application loads. Signed-out visitors land
 * on the public YOUNGO homepage. New members still accept the
 * membership policy before registering. App.jsx handles course-verification
 * and role-specific routes.
 */
export function AccessGate({ children }: any) {
  const path = usePath()
  const [ready, setReady] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  const [account, setAccount] = useState<any>(null)
  // The governing policy version lives in the CMS document, not the bundle.
  const { doc: membershipPolicy } = useDocument('membership-policy')
  const policyVersion = membershipPolicy?.POLICY_VERSION

  const handleAuthenticated = useCallback(
    (acc: any) => {
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

  useEffect(() => {
    if (policyVersion) setPolicyOk(hasAcknowledgedMembershipPolicy(policyVersion))
  }, [policyVersion])

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
          onChanged={(next: any) => {
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
