interface AccountProviderProps {
  initialAccount?: AnyValue
  children?: import('react').ReactNode
}

import type { AnyValue } from './types'
import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { setSession, getCachedAccount } from './session'
import { apiGet } from './api'

const AccountContext = createContext<AnyValue>(null)

export function AccountProvider({ initialAccount, children }: AccountProviderProps) {
  const [account, setAccountState] = useState(initialAccount || getCachedAccount())

  const accountId = account?.id
  useEffect(() => {
    if (!accountId) return
    let alive = true
    apiGet('/member/access')
      .then((access) => {
        if (!alive) return
        setAccountState((current: AnyValue) => (current ? { ...current, access } : current))
      })
      .catch(() => {
        /* role workspaces remain hidden if access cannot load */
      })
    return () => {
      alive = false
    }
  }, [accountId])

  const setAccount = useCallback((acc: AnyValue) => {
    setAccountState(acc)
    if (acc) setSession({ account: acc })
  }, [])

  const value = useMemo(() => ({ account, setAccount }), [account, setAccount])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) return { account: getCachedAccount(), setAccount: () => {} }
  return ctx
}
