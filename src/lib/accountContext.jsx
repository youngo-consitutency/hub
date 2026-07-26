import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { setSession, getCachedAccount, getSessionToken } from './session.js'
import { apiGet } from './api.js'

const AccountContext = createContext(null)

export function AccountProvider({ initialAccount, children }) {
  const [account, setAccountState] = useState(
    initialAccount || getCachedAccount(),
  )

  useEffect(() => {
    if (!account) return
    let alive = true
    apiGet('/member/access')
      .then((access) => {
        if (!alive) return
        setAccountState((current) =>
          current ? { ...current, access } : current,
        )
      })
      .catch(() => {
        /* role workspaces remain hidden if access cannot load */
      })
    return () => {
      alive = false
    }
  }, [account?.id])

  const setAccount = useCallback((acc) => {
    setAccountState(acc)
    const token = getSessionToken()
    if (acc) setSession({ token, account: acc })
  }, [])

  const value = useMemo(() => ({ account, setAccount }), [account, setAccount])
  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  )
}

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) return { account: getCachedAccount(), setAccount: () => {} }
  return ctx
}
