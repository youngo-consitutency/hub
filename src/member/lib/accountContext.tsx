interface AccountProviderProps {
  children?: import('react').ReactNode
}

import type { AnyValue } from './types'
import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { setSession, getCachedAccount } from './session'
import { apiGet } from './api'

const AccountContext = createContext<AnyValue>(null)

export function AccountProvider({ children }: AccountProviderProps) {
  // cached profile first so a signed-in member doesn't flash the signed-out shell
  const [account, setAccountState] = useState(getCachedAccount)

  const accountId = account?.id
  const [accessTry, setAccessTry] = useState(0)
  const reloadAccess = useCallback(() => setAccessTry((n) => n + 1), [])
  useEffect(() => {
    if (!accountId) return
    let alive = true
    // a retry goes back to the calm loading lock
    setAccountState((current: AnyValue) =>
      current?.accessFailed ? { ...current, accessFailed: false } : current,
    )
    apiGet('/member/access')
      .then((access) => {
        if (!alive) return
        setAccountState((current: AnyValue) =>
          current ? { ...current, access, accessFailed: false } : current,
        )
      })
      .catch(() => {
        // role workspaces stay locked; the lock switches to a retry
        if (!alive) return
        setAccountState((current: AnyValue) =>
          current ? { ...current, accessFailed: true } : current,
        )
      })
    return () => {
      alive = false
    }
  }, [accountId, accessTry])

  // endpoints hand back a bare accountView: keep the access we hold for the same
  // account. a new id refetches via the effect; mutations that move access
  // (course pass, seat) call reloadAccess themselves
  const setAccount = useCallback((acc: AnyValue) => {
    setAccountState((current: AnyValue) =>
      acc && !acc.access && current?.access && current.id === acc.id
        ? { ...acc, access: current.access }
        : acc,
    )
    if (acc) setSession({ account: acc })
  }, [])

  const value = useMemo(
    () => ({ account, setAccount, reloadAccess }),
    [account, setAccount, reloadAccess],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) return { account: getCachedAccount(), setAccount: () => {}, reloadAccess: () => {} }
  return ctx
}
