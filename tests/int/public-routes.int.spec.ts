import { describe, expect, it } from 'vitest'
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

  it('treats /about as the home page and matches sections by segment', () => {
    expect(isSiteHome('/about')).toBe(true)
    expect(isSiteRouteActive('/about', '/')).toBe(true)
    expect(isSiteRouteActive('/about/coy/2026', '/about/coy')).toBe(true)
    // a shared prefix is not the same section
    expect(isSiteRouteActive('/about/coyote', '/about/coy')).toBe(false)
    expect(isSiteRouteActive('/about/coy', '/')).toBe(false)
  })
})
