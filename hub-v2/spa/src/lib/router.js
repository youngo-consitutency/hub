// Path-based routing, no dependency (GYC convention).
import { useSyncExternalStore, useCallback } from 'react'

const listeners = new Set()
function emit() {
  listeners.forEach((l) => l())
}

function scrollAfterNavigate(to, scroll) {
  if (!scroll) return
  const hashIndex = String(to).indexOf('#')
  const hash = hashIndex >= 0 ? String(to).slice(hashIndex) : ''
  if (hash.length > 1) {
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ block: 'start' })
    })
    return
  }
  window.scrollTo(0, 0)
}

export function navigate(to, { state = {}, scroll = true } = {}) {
  if (
    to ===
    window.location.pathname + window.location.search + window.location.hash
  )
    return
  window.history.pushState(state, '', to)
  emit()
  scrollAfterNavigate(to, scroll)
}

export function replace(to, { state = {}, scroll = true } = {}) {
  window.history.replaceState(state, '', to)
  emit()
  scrollAfterNavigate(to, scroll)
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
