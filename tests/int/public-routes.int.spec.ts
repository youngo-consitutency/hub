import { afterEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_HUB_SEGMENTS } from '../../src/lib/hubUrl'
import {
  LEGACY_SITE_PATHS,
  PUBLIC_PATHS,
  SITE_ROUTES,
  isSiteHome,
  isSiteRouteActive,
} from '../../src/shared/publicRoutes'

describe('public route registry', () => {
  it('lists every site page in the sitemap once, with / as the only home', () => {
    expect(new Set(PUBLIC_PATHS).size).toBe(PUBLIC_PATHS.length)
    for (const route of SITE_ROUTES) expect(PUBLIC_PATHS).toContain(route.href)
  })

  it('keeps the site to a few pages, all linked from the header', () => {
    expect(SITE_ROUTES.length).toBeLessThanOrEqual(5)
    expect(SITE_ROUTES[0].href).toBe('/')
  })

  it('sends every merged page to a section of a page that exists', () => {
    for (const [old, target] of Object.entries(LEGACY_SITE_PATHS)) {
      const page = target.split('#')[0]
      expect(
        SITE_ROUTES.map((route) => route.href),
        old,
      ).toContain(page)
      expect(PUBLIC_PATHS, old).not.toContain(old)
    }
  })

  it('opens on the landing page only at /, and matches sections by segment', () => {
    expect(isSiteHome('/')).toBe(true)
    expect(isSiteHome('/about')).toBe(false)
    expect(isSiteRouteActive('/our-work/x', '/our-work')).toBe(true)
    // a shared prefix is not the same section
    expect(isSiteRouteActive('/our-workshop', '/our-work')).toBe(false)
    expect(isSiteRouteActive('/our-work', '/')).toBe(false)
  })

  it('keeps clear of the Hub: no public path is a Hub segment', () => {
    for (const { href } of SITE_ROUTES) {
      expect(LEGACY_HUB_SEGMENTS.has(href.split('/')[1]), href).toBe(false)
    }
  })
})

// previews run on copies of real members, so they must stay out of search
// and never send anything
describe('preview deployments', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('drop the sitemap and keep delivery off', async () => {
    // a deployment may force delivery off; the production half assumes it doesn't
    vi.stubEnv('HUB_DELIVERY_DISABLED', 'false')
    vi.stubEnv('VERCEL_ENV', 'preview')
    const { default: sitemap } = await import('../../src/app/sitemap')
    const { default: robots } = await import('../../src/app/robots')
    const { deliveryDisabled } = await import('../../src/lib/environment')
    expect(sitemap()).toEqual([])
    expect(robots().sitemap).toBeUndefined()
    expect(deliveryDisabled()).toBe(true)
    vi.stubEnv('VERCEL_ENV', 'production')
    expect(sitemap().length).toBeGreaterThan(0)
    expect(deliveryDisabled()).toBe(false)
  })
})
