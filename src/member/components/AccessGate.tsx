interface AccessGateProps {
  children?: import('react').ReactNode
}

import type { AnyValue } from '../lib/types'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { hasAcknowledgedMembershipPolicy } from '../lib/membershipGate'
import { useDocument } from '../lib/documents'
import { apiGet } from '../lib/api'
import { clearSession } from '../lib/session'
import { useAccount } from '../lib/accountContext'
import { HUB_ROOT } from '../../lib/hubUrl'
import { isSitePath } from '../../shared/publicRoutes'
import { navigate, useInHub, usePath } from '../lib/router'
import { ErrorCard } from './ui'

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

// a failed /auth/me that wasn't a 401: members keep their cached account and
// the shell shows a retry notice instead of a blocking screen
const SessionCheck = createContext({ failed: false, retry: () => {} })
export const useSessionCheck = () => useContext(SessionCheck)

function GoToHub() {
  useEffect(() => navigate(HUB_ROOT), [])
  return null
}

/**
 * Controls access before the main application loads. Signed-out visitors land
 * on the public YOUNGO homepage. New members still accept the
 * membership policy before registering. App.jsx handles course-verification
 * and role-specific routes.
 */
export function AccessGate({ children }: AccessGateProps) {
  const path = usePath()
  const inHub = useInHub()
  const [ready, setReady] = useState(false)
  const [policyOk, setPolicyOk] = useState(false)
  // one account for the whole tree: a refresh here reaches every page
  const { account, setAccount } = useAccount()
  const [sessionFailed, setSessionFailed] = useState(false)
  // The governing policy version lives in the CMS document, not the bundle.
  const { doc: membershipPolicy } = useDocument('membership-policy')
  const policyVersion = membershipPolicy?.POLICY_VERSION

  const handleAuthenticated = useCallback(
    (acc: AnyValue) => {
      setAccount(acc)
      if (!inHub && (path === '/join' || path === '/signin')) navigate(HUB_ROOT)
    },
    [inHub, path, setAccount],
  )

  const refreshSession = useCallback(async () => {
    try {
      const data = await apiGet('/auth/me')
      setAccount(data.account)
      setSessionFailed(false)
    } catch (err) {
      // only a 401 ends the session; a blip or 5xx keeps the cached account
      if ((err as AnyValue)?.status === 401) {
        clearSession()
        setAccount(null)
        setSessionFailed(false)
      } else setSessionFailed(true)
    }
  }, [setAccount])

  useEffect(() => {
    let alive = true
    ;(async () => {
      // The HttpOnly cookie is the authority — a missing local cache must not
      // strand a valid session.
      await refreshSession()
      if (alive) setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [refreshSession])

  const sessionCheck = useMemo(
    () => ({ failed: sessionFailed, retry: () => void refreshSession() }),
    [sessionFailed, refreshSession],
  )

  useEffect(() => {
    if (policyVersion) setPolicyOk(hasAcknowledgedMembershipPolicy(policyVersion))
  }, [policyVersion])

  // site pages are real routes and never wait on the session; inside /hub the
  // same paths mean Hub pages
  if (!inHub) {
    if (path.startsWith('/reset-password')) return <ResetPassword />
    // The privacy notice must be readable before someone is asked for personal data.
    if (path.startsWith('/privacy')) return <Privacy standalone />
    // Public website: browsable before any gate, for members too; data comes from the
    // redacting public API.
    if (isSitePath(path)) return <PublicSite />
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

  // nothing cached to fall back on, so we can't tell signed-in from signed-out.
  // public pages still render signed-out rather than blocking a first visit
  const publicPath = path.startsWith('/negotiations')
  if (sessionFailed && !account && !publicPath) {
    return (
      <main className="mandateGate">
        <div className="mandateShell" style={{ justifyContent: 'center', padding: 24 }}>
          <ErrorCard
            message="We couldn’t check your session. Check your connection and retry."
            onRetry={refreshSession}
          />
        </div>
      </main>
    )
  }

  // Published negotiation evidence stays reachable without an account.
  if (!account && path.startsWith('/negotiations')) {
    return <>{children}</>
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
            } else {
              refreshSession()
            }
          }}
        />
      )
    }
    // signed in already: the sign-in and join pages have nothing left to do
    if (!inHub && (path === '/signin' || path === '/join')) return <GoToHub />
    return <SessionCheck.Provider value={sessionCheck}>{children}</SessionCheck.Provider>
  }

  if (!inHub && path === '/join' && !policyOk) {
    return <MembershipMandateGate onComplete={() => setPolicyOk(true)} />
  }

  const initialMode = !inHub && path === '/join' ? 'register' : 'signin'
  return (
    <AuthGate key={initialMode} initialMode={initialMode} onAuthenticated={handleAuthenticated} />
  )
}
