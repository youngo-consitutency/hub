// Path-based routing, no dependency (GYC convention).
import { useSyncExternalStore, useCallback } from 'react'

const listeners = new Set()
function emit() {
  listeners.forEach((l) => l())
}

export function navigate(to, { state = {}, scroll = true } = {}) {
  if (to === window.location.pathname + window.location.search) return
  window.history.pushState(state, '', to)
  emit()
  if (scroll) window.scrollTo(0, 0)
}

export function replace(to, { state = {}, scroll = true } = {}) {
  window.history.replaceState(state, '', to)
  emit()
  if (scroll) window.scrollTo(0, 0)
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', emit)
}

export function usePath() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => window.location.pathname,
    () => '/',
  )
}

export function useNavigate() {
  return useCallback((to, options) => navigate(to, options), [])
}
