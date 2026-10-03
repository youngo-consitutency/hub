import { createContext, useContext, useMemo, useState, useCallback, useEffect } from 'react'
import { setSession, getCachedAccount } from './session'
import { apiGet } from './api'

const AccountContext = createContext<any>(null)

export function AccountProvider({ initialAccount, children }: any) {
  const [account, setAccountState] = useState(initialAccount || getCachedAccount())

  useEffect(() => {
    if (!account) return
    let alive = true
    apiGet('/member/access')
      .then((access) => {
        if (!alive) return
        setAccountState((current: any) => (current ? { ...current, access } : current))
      })
      .catch(() => {
        /* role workspaces remain hidden if access cannot load */
      })
    return () => {
      alive = false
    }
  }, [account?.id])

  const setAccount = useCallback((acc: any) => {
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
