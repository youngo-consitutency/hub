import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { setSession, getCachedAccount, getSessionToken } from './session.js'

const AccountContext = createContext(null)

export function AccountProvider({ initialAccount, children }) {
  const [account, setAccountState] = useState(initialAccount || getCachedAccount())

  const setAccount = useCallback((acc) => {
    setAccountState(acc)
    const token = getSessionToken()
    if (token && acc) setSession({ token, account: acc })
  }, [])

  const value = useMemo(() => ({ account, setAccount }), [account, setAccount])
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) return { account: getCachedAccount(), setAccount: () => {} }
  return ctx
}
