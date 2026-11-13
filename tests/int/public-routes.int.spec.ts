import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PUBLIC_PATHS,
  SITE_MENUS,
  SITE_ROUTES,
  isSiteHome,
  isSiteRouteActive,
} from '../../src/shared/publicRoutes'

describe('public route registry', () => {
  it('lists every site page in the sitemap once, with / as the only home', () => {
    expect(new Set(PUBLIC_PATHS).size).toBe(PUBLIC_PATHS.length)
    for (const route of SITE_ROUTES) expect(PUBLIC_PATHS).toContain(route.href)
    expect(PUBLIC_PATHS).not.toContain('/about')
  })

  it('keeps the header short: few top-level links, the rest under menus', () => {
    const topLevel = SITE_ROUTES.filter((route) => !route.menu && route.href !== '/')
    expect(topLevel.length + SITE_MENUS.length).toBeLessThanOrEqual(4)
    for (const menu of SITE_MENUS) {
      expect(
        SITE_ROUTES.some((route) => route.menu === menu.id),
        menu.id,
      ).toBe(true)
    }
  })

  it('keeps the footer short', () => {
    expect(SITE_ROUTES.filter((route) => route.footer !== false).length).toBeLessThanOrEqual(6)
  })

  it('treats /about as the home page and matches sections by segment', () => {
    expect(isSiteHome('/about')).toBe(true)
    expect(isSiteRouteActive('/about', '/')).toBe(true)
    expect(isSiteRouteActive('/about/coy/2026', '/about/coy')).toBe(true)
    // a shared prefix is not the same section
    expect(isSiteRouteActive('/about/coyote', '/about/coy')).toBe(false)
    expect(isSiteRouteActive('/about/coy', '/')).toBe(false)
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
