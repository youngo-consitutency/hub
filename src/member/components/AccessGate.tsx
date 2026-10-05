interface AccessGateProps {
  children?: import('react').ReactNode | ((data: AnyValue) => import('react').ReactNode)
}

import type { AnyValue } from '../lib/types'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate'
import { useDocument } from '../lib/documents'
import { apiGet } from '../lib/api'
import { clearSession, getCachedAccount, setSession } from '../lib/session'
import { navigate, usePath } from '../lib/router'

// Sign-in, registration and the public site are only rendered for signed-out
// or gated sessions — dynamic imports keep them out of the chunk every
// signed-in member downloads.
const MembershipMandateGate = dynamic(() =>
  import('./MembershipMandateGate').then((m) => m.MembershipMandateGate),
)
const AuthGate = dynamic(() => import('./AuthGate').then((m) => m.AuthGate))
const ResetPassword = dynamic(() => import('../pages/ResetPassword').then((m) => m.ResetPassword))
const ChangePasswordGate = dynamic(() =>
  import('./ChangePasswordGate').then((m) => m.ChangePasswordGate),
)
const Privacy = dynamic(() => import('../pages/Privacy').then((m) => m.Privacy))
const PublicSite = dynamic(() => import('../pages/site/PublicSite').then((m) => m.PublicSite))

/**
 * Controls access before the main application loads. Signed-out visitors land
 * on the public YOUNGO homepage. New members still accept the
 * membership policy before registering. App.jsx handles course-verification
 * and role-specific routes.
 */
export function AccessGate({ children }: AccessGateProps) {
  const path = usePath()
  const [ready, setReady] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  const [account, setAccount] = useState<AnyValue>(null)
  // The governing policy version lives in the CMS document, not the bundle.
  const { doc: membershipPolicy } = useDocument('membership-policy')
  const policyVersion = membershipPolicy?.POLICY_VERSION

  const handleAuthenticated = useCallback(
    (acc: AnyValue) => {
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
      // The HttpOnly cookie is the authority — a missing local cache must not
      // strand a valid session.
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

  // Public website: browsable before any gate; data comes from the redacting
  // public API.
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

  // Published negotiation evidence stays reachable without an account.
  if (!account && path.startsWith('/negotiations')) {
    return <>{typeof children === 'function' ? children(null) : children}</>
  }

  // Signed-in members always enter; the policy only gates new accounts.
  if (account) {
    if (account.mustChangePassword) {
      return (
        <ChangePasswordGate
          account={account}
          onChanged={(next: AnyValue) => {
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
