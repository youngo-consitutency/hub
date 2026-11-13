import { useSyncExternalStore } from 'react'
import { useAccount } from './accountContext'

const noop = () => () => {}

// the cached account lives in the browser only, so hydrate as signed out, then switch
export function useSignedIn() {
  const { account } = useAccount()
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  )
  return hydrated && Boolean(account)
}
