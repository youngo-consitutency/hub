import type { ComponentType } from 'react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import {
  TbArrowRight as ArrowRight,
  TbChevronDown as ChevronDown,
  TbLogin as LogIn,
  TbMenu2 as Menu,
  TbX as X,
} from 'react-icons/tb'
import {
  LEGACY_SITE_PATHS,
  SITE_ROUTES,
  isSiteHome,
  isSiteRouteActive,
} from '../../../shared/publicRoutes'
import { A } from '../../components/ui'
import { Brand } from '../../components/Brand'
import { DestinationIcon } from '../../components/DestinationLink'
import { useSignedIn } from '../../lib/useSignedIn'
import { trackPointer } from '../../lib/pointerGlow'
import { replace, usePath } from '../../lib/router'
import { publishedLinks, useDocument } from '../../lib/documents'
import { SiteHome } from './SiteHome'
import { JoinButton } from './JoinButton'
import { SiteWork } from './SiteWork'
import { SiteResources } from './SiteResources'
import { SiteAbout } from './SiteAbout'

// every link to another page lives in the header; the home page is the logo
const NAV_LINKS = SITE_ROUTES.filter((route) => route.href !== '/')

const PAGES: Record<string, ComponentType> = {
  '/our-work': SiteWork,
  '/learn': SiteResources,
  '/about': SiteAbout,
}

function SiteHeader() {
  const path = usePath()
  const signedIn = useSignedIn()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [path])

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  const current = (href: string) => (isSiteRouteActive(path, href) ? 'page' : undefined)
  return (
    <header className="siteHeader" data-overlay={!scrolled && !open ? '' : undefined}>
      <div className="siteHeaderInner">
        <A href="/" className="wordmark siteWordmark" aria-label="YOUNGO home">
          <Brand constituencyOnly />
        </A>
        <nav className="siteNav siteNavDesktop" aria-label="Pages">
          {NAV_LINKS.map(({ href, label, sections }) => {
            const link = (
              <A
                href={href}
                className={`siteNavItem ${current(href) ? 'active' : ''}`}
                aria-current={current(href)}
              >
                {label}
                {sections && <ChevronDown size={14} strokeWidth={1.75} aria-hidden />}
              </A>
            )
            // a page with sections opens a menu on hover or focus; the link itself still goes to the page
            return sections ? (
              <div key={href} className="siteNavGroup">
                {link}
                <ul className="siteNavMenu">
                  {sections.map((section) => (
                    <li key={section.href}>
                      <A href={section.href}>{section.label}</A>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Fragment key={href}>{link}</Fragment>
            )
          })}
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
        <nav id="site-mobile-navigation" className="siteMobileNav" aria-label="Pages">
          {[SITE_ROUTES[0], ...NAV_LINKS].map(({ href, label, sections }) => (
            <Fragment key={href}>
              <A
                href={href}
                className={`siteMobileNavItem ${current(href) ? 'active' : ''}`}
                aria-current={current(href)}
              >
                {label}
              </A>
              {sections?.map((section) => (
                <A
                  key={section.href}
                  href={section.href}
                  className="siteMobileNavItem siteMobileNavSub"
                >
                  {section.label}
                </A>
              ))}
            </Fragment>
          ))}
          {!signedIn && (
            <A className="siteMobileNavItem" href="/signin">
              Sign in
            </A>
          )}
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
            {socials.map((link: { key: string; url: string; label: string }) => (
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
        <nav className="siteFooterCol" aria-label="Pages">
          <h2>{footer.exploreTitle}</h2>
          {SITE_ROUTES.map(({ href, label }) => (
            <A key={href} href={href}>
              {label}
            </A>
          ))}
        </nav>
        <div className="siteFooterCol">
          <h2>{footer.involvedTitle}</h2>
          {(footer.involved || []).map(
            (link: { label: string; href: string; external?: boolean }) =>
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
    </footer>
  )
}

// shown for a moment while an old page path moves to its new place
const Nothing = () => null

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
 * The public YOUNGO website: four pages, readable before any account, policy scroll, or
 * cookies. All data shown is served by the public API, which redacts member-only details.
 */
export function PublicSite() {
  const path = usePath()
  const legacy = LEGACY_SITE_PATHS[path]
  const first = useRef(true)

  // old page paths move to their section in the page that now holds them
  useEffect(() => {
    if (legacy) replace(legacy)
  }, [legacy])

  // a new page starts at its top, and screen readers land on its content
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    document.getElementById('site-main')?.focus({ preventScroll: true })
  }, [path])

  // exact paths only: an unknown /about/x is a 404, not the About page
  const Page = isSiteHome(path) ? SiteHome : (PAGES[path] ?? (legacy ? Nothing : SiteNotFound))

  return (
    <MotionConfig reducedMotion="user">
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
    </MotionConfig>
  )
}
