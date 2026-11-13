// Two location models share this module.
//  - Site routes (/, /about/*, /signin, ...) are real paths served by Next.
//  - The Hub lives at /hub and keeps its own pages in the hash:
//    /hub#/calendar/some-event?tab=notes. The server only ever serves /hub.
// Call sites keep passing plain app paths ('/calendar'); this module decides
// whether that means a real navigation or a hash change.
'use client'
import type { AnyValue } from './types'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { HUB_ROOT, hubUrl } from '../../lib/hubUrl'

const PEEK_KEY = 'youngo.peekBackground'
const HUB_EVENT = 'hub:navigate'

// real server routes; every other path is a Hub page
const SITE_PATH = /^\/(about|signin|join|privacy|reset-password|hub)(\/|$)/
// public evidence pages exist as real routes too, but inside the Hub they stay in-app
const SHARED_PATH = /^\/negotiations(\/|$)/

const inHubPath = (pathname: string) => pathname === HUB_ROOT || pathname.startsWith(`${HUB_ROOT}/`)
const inHubNow = () => typeof window !== 'undefined' && inHubPath(window.location.pathname)

type Target = { hub: boolean; href: string }

/** Where an app path points: a hash route inside the Hub, or a real URL. */
export function resolve(to: string, hubNow = inHubNow()): Target {
  const path = to.split(/[?#]/)[0]
  const site =
    SITE_PATH.test(path) || (path === '/' && !hubNow) || (SHARED_PATH.test(path) && !hubNow)
  if (site) return { hub: false, href: to }
  return { hub: true, href: hubUrl(to) }
}

export const hrefFor = (to: string) => resolve(to).href

// the Hub route stored in the hash: no hash is the home page, and other hashes (skip links)
// leave the current route alone
let current = '#/'
function readHash() {
  const hash = window.location.hash
  if (hash === '') current = '#/'
  else if (hash.startsWith('#/')) current = hash
  return current
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  window.addEventListener(HUB_EVENT, listener)
  return () => {
    window.removeEventListener('hashchange', listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener(HUB_EVENT, listener)
  }
}

// the server never sees the hash, so it renders the Hub home
const useHubHash = () => useSyncExternalStore(subscribe, readHash, () => '#/')

/** Whether the viewer is inside the Hub app (/hub) rather than on a site page. */
export const useInHub = () => inHubPath(usePathname())

/** The app path the viewer is on, without the query. */
export function usePath() {
  const pathname = usePathname()
  const hash = useHubHash()
  return inHubPath(pathname) ? hash.slice(1).split('?')[0] : pathname
}

/** The query string of the current app path. */
export function useQuery() {
  const pathname = usePathname()
  const search = useSearchParams()
  const hash = useHubHash()
  return useMemo(
    () => (inHubPath(pathname) ? new URLSearchParams(hash.split('?')[1] || '') : search),
    [pathname, search, hash],
  )
}

/** The current app path with its query, as the peek background marker stores it. */
export function currentAppUrl() {
  if (inHubNow()) return readHash().slice(1)
  return window.location.pathname + window.location.search
}

let bound: AppRouterInstance | null = null

// Mount once inside every tree that calls navigate(): binds the App Router
// instance so site navigations soft-navigate instead of hard-reloading.
export function RouterBridge() {
  const router = useRouter()
  useEffect(() => {
    bound = router
  }, [router])
  return null
}

export function peekBackground(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(PEEK_KEY)
}

function storePeek(state: AnyValue) {
  if (state?.peekBackground) sessionStorage.setItem(PEEK_KEY, String(state.peekBackground))
  else sessionStorage.removeItem(PEEK_KEY)
}

type Options = { state?: AnyValue; scroll?: boolean }

function go(method: 'push' | 'replace', to: AnyValue, { state = {}, scroll = true }: Options = {}) {
  const target = resolve(String(to))
  storePeek(state)
  if (target.hub && inHubNow()) {
    window.history[method === 'push' ? 'pushState' : 'replaceState'](null, '', target.href)
    window.dispatchEvent(new Event(HUB_EVENT))
    if (scroll) {
      window.scrollTo(0, 0)
      document.getElementById('main-content')?.scrollTo?.(0, 0)
    }
    return
  }
  if (bound) bound[method](target.href, { scroll })
  else if (method === 'push') window.location.assign(target.href)
  else window.location.replace(target.href)
}

export const navigate = (to: AnyValue, options?: Options) => go('push', to, options)
export const replace = (to: AnyValue, options?: Options) => go('replace', to, options)
