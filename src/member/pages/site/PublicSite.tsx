import type { AnyValue } from '../../lib/types'
import { useEffect, useRef, useState } from 'react'
import {
  TbArrowRight as ArrowRight,
  TbChevronDown as ChevronDown,
  TbLogin as LogIn,
  TbMenu2 as Menu,
  TbX as X,
} from 'react-icons/tb'
import { Button, Menu as AriaMenu, MenuItem, MenuTrigger, Popover } from 'react-aria-components'
import {
  SITE_MENUS,
  SITE_ROUTES,
  isSiteHome,
  isSiteRouteActive,
  type SiteMenu,
} from '../../../shared/publicRoutes'
import { A } from '../../components/ui'
import { Brand } from '../../components/Brand'
import { DestinationIcon } from '../../components/DestinationLink'
import { useSignedIn } from '../../lib/useSignedIn'
import { trackPointer } from '../../lib/pointerGlow'
import { usePath } from '../../lib/router'
import { publishedLinks, useDocument } from '../../lib/documents'
import { PublicPlatform } from '../../features/platform/PublicPlatform.tsx'
import { SiteHome } from './SiteHome'
import { JoinButton } from './JoinButton'
import { SiteWorkingGroups } from './SiteWorkingGroups'
import { SiteCoy } from './SiteCoy'
import { SiteGys } from './SiteGys'
import { SiteResources } from './SiteResources'
import { SiteFaq } from './SiteFaq'
import { SiteContact } from './SiteContact'

const routesIn = (menu: SiteMenu) => SITE_ROUTES.filter((route) => route.menu === menu)

// a header dropdown of page links; react aria handles keyboard, focus and dismissal
function SiteNavMenu({ id, label, path }: { id: SiteMenu; label: string; path: string }) {
  const routes = routesIn(id)
  const active = routes.some((route) => isSiteRouteActive(path, route.href))
  return (
    <MenuTrigger>
      <Button className={`siteNavItem siteNavMenuButton ${active ? 'active' : ''}`}>
        {label}
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
      </Button>
      <Popover className="siteNavPopover" placement="bottom start" offset={6}>
        <AriaMenu className="siteNavMenu" aria-label={label} items={routes}>
          {(route) => (
            <MenuItem
              id={route.href}
              href={route.href}
              className="siteNavMenuItem"
              // react aria drops aria-current, so set it on the anchor itself
              ref={(el: HTMLElement | null) => {
                if (!el) return
                // clear it too, the element can outlive a client-side nav
                if (isSiteRouteActive(path, route.href)) el.setAttribute('aria-current', 'page')
                else el.removeAttribute('aria-current')
              }}
            >
              {route.label}
            </MenuItem>
          )}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  )
}

function SiteHeader() {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const signedIn = useSignedIn()
  const menuButtonRef = useRef<AnyValue>(null)

  useEffect(() => {
    setOpen(false)
  }, [path])

  // every public page opens on a deep band under the header; it turns solid once the page scrolls
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const close = (event: AnyValue) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <header className="siteHeader" data-overlay={!scrolled && !open ? '' : undefined}>
      <div className="siteHeaderInner">
        <A href="/" className="wordmark siteWordmark" aria-label="YOUNGO home">
          <Brand constituencyOnly />
        </A>
        <nav className="siteNav siteNavDesktop" aria-label="About YOUNGO">
          {SITE_MENUS.map((menu) => (
            <SiteNavMenu key={menu.id} id={menu.id} label={menu.label} path={path} />
          ))}
        </nav>
        {!signedIn && (
          <A className="siteSignInLink" href="/signin">
            <LogIn size={15} strokeWidth={1.75} aria-hidden />
            Sign in
          </A>
        )}
        <JoinButton label="Join YOUNGO" size="sm" className="siteJoinBtn" />
        <button
          ref={menuButtonRef}
          className="iconButton siteMenuButton"
          type="button"
          aria-label={open ? 'Close site menu' : 'Open site menu'}
          aria-expanded={open}
          aria-controls="site-mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? (
            <X size={20} strokeWidth={1.75} aria-hidden />
          ) : (
            <Menu size={20} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </div>
      {open && (
        <nav id="site-mobile-navigation" className="siteMobileNav" aria-label="About YOUNGO">
          {[
            { label: '', routes: SITE_ROUTES.filter((route) => !route.menu) },
            ...SITE_MENUS.map((menu) => ({ label: menu.label, routes: routesIn(menu.id) })),
          ].map((group) => (
            <div key={group.label || 'pages'} className="siteMobileNavGroup">
              {group.label && <p className="siteMobileNavHeading">{group.label}</p>}
              {group.routes.map(({ href, label }) => (
                <A
                  key={href}
                  href={href}
                  className={`siteMobileNavItem ${isSiteRouteActive(path, href) ? 'active' : ''}`}
                  aria-current={isSiteRouteActive(path, href) ? 'page' : undefined}
                >
                  {label}
                  <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
                </A>
              ))}
            </div>
          ))}
          <A className="siteMobileNavItem siteMobileSignIn" href="/signin">
            Sign in to the Hub
            <ArrowRight size={15} aria-hidden />
          </A>
        </nav>
      )}
    </header>
  )
}

// the project is open source
const REPO_URL = 'https://github.com/youngo-consitutency/hub'

function SiteFooter() {
  const { doc: connect } = useDocument('connect')
  const { doc: site } = useDocument('site')
  const footer = site?.footer || {}
  const socials = publishedLinks(connect?.SOCIAL_LINKS)
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <Brand constituencyOnly />
          <p className="meta">{footer.brand}</p>
          <ul className="siteSocials" aria-label={footer.followTitle}>
            {socials.map((link: AnyValue) => (
              <li key={link.key}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={link.label}
                >
                  <DestinationIcon url={link.url} size={18} />
                </a>
              </li>
            ))}
            <li>
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener" aria-label="Source code">
                <DestinationIcon url={REPO_URL} size={18} />
              </a>
            </li>
          </ul>
        </div>
        <nav className="siteFooterCol" aria-label="Site pages">
          <h2>{footer.exploreTitle}</h2>
          {SITE_ROUTES.filter((route) => route.footer !== false).map(({ href, label }) => (
            <A key={href} href={href}>
              {label}
            </A>
          ))}
        </nav>
        <div className="siteFooterCol">
          <h2>{footer.involvedTitle}</h2>
          {(footer.involved || []).map((link: AnyValue) =>
            link.external ? (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer noopener">
                {link.label}
                <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
              </a>
            ) : (
              <A key={link.label} href={link.href}>
                {link.label}
              </A>
            ),
          )}
        </div>
      </div>
      <p className="siteFooterLegal metaMuted">
        {footer.legal} <a href={footer.legalLink?.href || '/privacy'}>{footer.legalLink?.label}</a>
      </p>
    </footer>
  )
}

function SiteNotFound() {
  const { doc: site } = useDocument('site')
  const nf = site?.notFound || {}
  return (
    <div className="siteMain">
      <div className="card siteHeroCard">
        <h1>{nf.title}</h1>
        <p className="meta">
          {nf.before}{' '}
          <A href="/" className="inlineLink">
            {nf.linkLabel}
          </A>{' '}
          {nf.after}
        </p>
      </div>
    </div>
  )
}

/**
 * The public YOUNGO website: a multi-page introduction to the constituency,
 * readable before any account, policy scroll, or cookies. All data shown is
 * served by the public API, which redacts member-only details.
 */
export function PublicSite() {
  const path = usePath()
  let Page: AnyValue = SiteNotFound
  if (isSiteHome(path)) Page = SiteHome
  else if (isSiteRouteActive(path, '/about/working-groups')) Page = SiteWorkingGroups
  else if (isSiteRouteActive(path, '/about/resources')) Page = SiteResources
  else if (isSiteRouteActive(path, '/about/gys')) Page = SiteGys
  else if (isSiteRouteActive(path, '/about/coy')) Page = SiteCoy
  else if (isSiteRouteActive(path, '/about/faq')) Page = SiteFaq
  else if (isSiteRouteActive(path, '/about/contact')) Page = SiteContact
  else if (isSiteRouteActive(path, '/about/organisation')) Page = PublicPlatform

  return (
    <div className="siteShell" onPointerMove={trackPointer}>
      <a className="skipLink" href="#site-main">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="site-main" tabIndex={-1}>
        <Page />
      </main>
      <SiteFooter />
    </div>
  )
}
