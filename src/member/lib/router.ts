// Path-based routing backed by next/navigation. The App Router owns
// window.history.state, so peek routing keeps its background marker in
// sessionStorage instead. navigate/replace go through a router instance
// bound by <RouterBridge> inside the member layout; calls before it mounts
// fall back to a hard navigation.
'use client'
import type { AnyValue } from './types'
import { usePathname } from 'next/navigation'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

const PEEK_KEY = 'youngo.peekBackground'

let bound: AppRouterInstance | null = null

export function bindRouter(router: AppRouterInstance) {
  bound = router
}

export function peekBackground(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(PEEK_KEY)
}

function storePeek(state: AnyValue) {
  if (state?.peekBackground) sessionStorage.setItem(PEEK_KEY, String(state.peekBackground))
  else sessionStorage.removeItem(PEEK_KEY)
}

export function navigate(to: AnyValue, { state = {}, scroll = true } = {}) {
  if (!bound) {
    window.location.assign(String(to))
    return
  }
  storePeek(state)
  bound.push(String(to), { scroll })
}

export function replace(to: AnyValue, { state = {}, scroll = true } = {}) {
  if (!bound) {
    window.location.replace(String(to))
    return
  }
  storePeek(state)
  bound.replace(String(to), { scroll })
}

export function usePath() {
  // usePathname returns the path without the query — matching the route
  // table's previous behaviour of matching on the pathname alone.
  return usePathname()
}
