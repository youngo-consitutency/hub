import { useEffect, useRef, useState } from 'react'
import {
  TbArrowRight as ArrowRight,
  TbMenu2 as Menu,
  TbX as X,
} from 'react-icons/tb'
import { A } from '../../components/ui.jsx'
import { Brand } from '../../components/Brand.jsx'
import { DestinationIcon } from '../../components/DestinationLink.jsx'
import { usePath } from '../../lib/router.js'
import { publishedLinks, YOUNGO_NETWORK } from '../../content/connect.js'
import { SiteHome } from './SiteHome.jsx'
import { SiteWorkingGroups } from './SiteWorkingGroups.jsx'
import { SiteCoy } from './SiteCoy.jsx'
import { SiteGys } from './SiteGys.jsx'
import { SiteResources } from './SiteResources.jsx'
import { SiteFaq } from './SiteFaq.jsx'
import { SiteContact } from './SiteContact.jsx'

const NAV = [
  { href: '/about', label: 'Home' },
  { href: '/about/working-groups', label: 'Working groups' },
  { href: '/about/resources', label: 'Resources' },
  { href: '/about/gys', label: 'GYS' },
  { href: '/about/coy', label: 'COY' },
  { href: '/about/faq', label: 'FAQs' },
  { href: '/about/contact', label: 'Contact' },
]

function isActive(path, href) {
  return href === '/about' ? path === '/about' : path.startsWith(href)
}

function SiteHeader() {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    setOpen(false)
  }, [path])

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      menuButtonRef.current?.focus()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <A
          href="/about"
          className="wordmark siteWordmark"
          aria-label="YOUNGO Hub home"
        >
          <Brand />
        </A>
        <nav className="siteNav siteNavDesktop" aria-label="About YOUNGO">
          {NAV.map(({ href, label }) => (
            <A
              key={href}
              href={href}
              className={`siteNavItem ${isActive(path, href) ? 'active' : ''}`}
              aria-current={isActive(path, href) ? 'page' : undefined}
            >
              {label}
            </A>
          ))}
        </nav>
        <A className="siteSignInLink" href="/signin">
          Sign in
        </A>
        <A className="btn btn-primary btn-sm siteJoinBtn" href="/join">
          Join YOUNGO
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </A>
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
        <nav
          id="site-mobile-navigation"
          className="siteMobileNav"
          aria-label="About YOUNGO"
        >
          {NAV.map(({ href, label }) => (
            <A
              key={href}
              href={href}
              className={`siteMobileNavItem ${isActive(path, href) ? 'active' : ''}`}
              aria-current={isActive(path, href) ? 'page' : undefined}
            >
              {label}
              <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
            </A>
          ))}
        </nav>
      )}
    </header>
  )
}

function SiteFooter() {
  const socials = publishedLinks()
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <Brand constituencyOnly />
          <p className="meta">
            The official children and youth constituency of the UNFCCC. By
            youth, with youth, for youth.
          </p>
        </div>
        <nav className="siteFooterCol" aria-label="Site pages">
          <h2>Explore</h2>
          {NAV.map(({ href, label }) => (
            <A key={href} href={href}>
              {label}
            </A>
          ))}
          <a href="/privacy">Privacy notice</a>
        </nav>
        <div className="siteFooterCol">
          <h2>Get involved</h2>
          <A href="/join">Join YOUNGO</A>
          <A href="/signin">Sign in</A>
          <a
            href="https://unfccc.int/topics/action-for-climate-empowerment-children-and-youth/youth/youngo"
            target="_blank"
            rel="noreferrer noopener"
          >
            YOUNGO on UNFCCC
            <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
          </a>
          {YOUNGO_NETWORK.map((site) => (
            <a
              key={site.key}
              href={site.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {site.title}
              <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
            </a>
          ))}
        </div>
        {socials.length > 0 && (
          <div className="siteFooterCol">
            <h2>Follow</h2>
            {socials.map((link) => (
              <a
                key={link.key}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <DestinationIcon url={link.url} size={15} />
                {link.label}
                <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
              </a>
            ))}
          </div>
        )}
      </div>
      <p className="siteFooterLegal metaMuted">
        YOUNGO · the children and youth constituency of the UNFCCC · membership
        is free and runs on volunteers · <a href="/privacy">privacy</a>
      </p>
    </footer>
  )
}

function SiteNotFound() {
  return (
    <div className="siteMain">
      <div className="card siteHeroCard">
        <h1>Page not found</h1>
        <p className="meta">
          That page does not exist on the public site. Head back to the{' '}
          <A href="/about" className="inlineLink">
            home page
          </A>{' '}
          to keep exploring.
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
  let Page = SiteNotFound
  if (path === '/about' || path === '/about/') Page = SiteHome
  else if (path.startsWith('/about/working-groups')) Page = SiteWorkingGroups
  else if (path.startsWith('/about/resources')) Page = SiteResources
  else if (path.startsWith('/about/gys')) Page = SiteGys
  else if (path.startsWith('/about/coy')) Page = SiteCoy
  else if (path.startsWith('/about/faq')) Page = SiteFaq
  else if (path.startsWith('/about/contact')) Page = SiteContact

  return (
    <div className="siteShell">
      <a className="skipLink" href="#site-main">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="site-main" tabIndex="-1">
        <Page />
      </main>
      <SiteFooter />
    </div>
  )
}
