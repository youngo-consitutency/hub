interface AccountProviderProps {
  children?: import('react').ReactNode
}

import type { Account, AccountAccess } from './types'
import { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useSWRConfig } from 'swr'
import { setSession, getCachedAccount } from './session'
import { apiGet } from './api'
import { mergeAccount, withoutAccess } from './accountState'

interface AccountContextValue {
  account: Account | null
  setAccount: (account: Account | null) => void
  reloadAccess: () => void
}

const AccountContext = createContext<AccountContextValue | null>(null)

export function AccountProvider({ children }: AccountProviderProps) {
  // cached profile first so a signed-in member doesn't flash the signed-out shell
  const [account, setAccountState] = useState<Account | null>(getCachedAccount)

  const accountId = account?.id
  // SWR's cache is global and keys carry no account, so another account signing in
  // within this document would first see the last one's data. clear it whenever the
  // account changes or ends (a sign-out reload already starts clean)
  const { mutate } = useSWRConfig()
  const lastId = useRef(accountId)
  useEffect(() => {
    if (lastId.current && lastId.current !== accountId)
      void mutate(() => true, undefined, { revalidate: false })
    lastId.current = accountId
  }, [accountId, mutate])

  const [accessTry, setAccessTry] = useState(0)
  // access we hold is stale once something may have moved it, so drop it: a failed
  // refetch then lands on the retry lock rather than a wrong "access required"
  const reloadAccess = useCallback(() => {
    setAccountState(withoutAccess)
    setAccessTry((n) => n + 1)
  }, [])
  useEffect(() => {
    if (!accountId) return
    let alive = true
    // a retry goes back to the calm loading lock
    setAccountState((current) =>
      current?.accessFailed ? { ...current, accessFailed: false } : current,
    )
    apiGet<AccountAccess>('/member/access')
      .then((access) => {
        if (!alive) return
        setAccountState((current) =>
          current ? { ...current, access, accessFailed: false } : current,
        )
      })
      .catch(() => {
        // role workspaces stay locked; the lock switches to a retry
        if (!alive) return
        setAccountState((current) => (current ? { ...current, accessFailed: true } : current))
      })
    return () => {
      alive = false
    }
  }, [accountId, accessTry])

  // endpoints hand back a bare accountView: keep the access state we hold for the
  // same account (loaded, or failed and awaiting retry). a new id refetches via the
  // effect; mutations that move access (course pass, seat) call reloadAccess
  const setAccount = useCallback((acc: Account | null) => {
    setAccountState((current) => mergeAccount(current, acc))
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
