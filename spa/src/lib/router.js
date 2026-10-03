// Path-based routing via wouter — the listener/store machinery lives in the
// library; this module adds the app's scroll-after-navigate behaviour and the
// existing call-site API.
import { useLocation } from 'wouter'
import { navigate as wouterNavigate } from 'wouter/use-browser-location'

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
  if (to === window.location.pathname + window.location.search + window.location.hash) return
  wouterNavigate(to, { state })
  scrollAfterNavigate(to, scroll)
}

export function replace(to, { state = {}, scroll = true } = {}) {
  wouterNavigate(to, { replace: true, state })
  scrollAfterNavigate(to, scroll)
}

export function usePath() {
  // wouter's location includes the search; the previous router exposed only
  // the pathname, and the route table matches on it.
  return useLocation()[0].split(/[?#]/)[0]
}
