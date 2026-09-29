import { useEffect, useRef, useState } from 'react'
import { TbArrowRight as ArrowRight, TbMenu2 as Menu, TbX as X } from 'react-icons/tb'
import { A } from '../../components/ui.jsx'
import { Brand } from '../../components/Brand.jsx'
import { DestinationIcon } from '../../components/DestinationLink.jsx'
import { usePath } from '../../lib/router.js'
import { publishedLinks, useDocument } from '../../lib/documents.js'
import { PublicPlatform } from '../../features/platform/PublicPlatform.tsx'
import { SiteHome } from './SiteHome.jsx'
import { SiteWorkingGroups } from './SiteWorkingGroups.jsx'
import { SiteCoy } from './SiteCoy.jsx'
import { SiteGys } from './SiteGys.jsx'
import { SiteResources } from './SiteResources.jsx'
import { SiteFaq } from './SiteFaq.jsx'
import { SiteContact } from './SiteContact.jsx'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about/working-groups', label: 'Working groups' },
  { href: '/about/resources', label: 'Resources' },
  { href: '/about/gys', label: 'GYS' },
  { href: '/about/coy', label: 'COY' },
  { href: '/about/faq', label: 'FAQs' },
  { href: '/about/organisation', label: 'Organisation & partners' },
  { href: '/about/contact', label: 'Contact' },
]

function isActive(path, href) {
  return href === '/'
    ? ['/', '/about', '/about/', '/landingV2', '/landingV2/'].includes(path)
    : path.startsWith(href)
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
        <A href="/" className="wordmark siteWordmark" aria-label="YOUNGO home">
          <Brand constituencyOnly />
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
        <nav id="site-mobile-navigation" className="siteMobileNav" aria-label="About YOUNGO">
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
          <A className="siteMobileNavItem siteMobileSignIn" href="/signin">
            Sign in to the Hub
            <ArrowRight size={15} aria-hidden />
          </A>
        </nav>
      )}
    </header>
  )
}

function SiteFooter() {
  const { doc: connect } = useDocument('connect')
  const { doc: site } = useDocument('site')
  const footer = site?.footer || {}
  const socials = publishedLinks(connect?.SOCIAL_LINKS)
  const YOUNGO_NETWORK = connect?.YOUNGO_NETWORK || []
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="siteFooterBrand">
          <Brand constituencyOnly />
          <p className="meta">{footer.brand}</p>
        </div>
        <nav className="siteFooterCol" aria-label="Site pages">
          <h2>{footer.exploreTitle}</h2>
          {NAV.map(({ href, label }) => (
            <A key={href} href={href}>
              {label}
            </A>
          ))}
          <a href="/privacy">{footer.privacyLabel}</a>
        </nav>
        <div className="siteFooterCol">
          <h2>{footer.involvedTitle}</h2>
          {(footer.involved || []).map((link) =>
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
          {YOUNGO_NETWORK.map((network) => (
            <a
              key={network.key}
              href={network.url}
              target={network.url.startsWith('/') ? undefined : '_blank'}
              rel="noreferrer noopener"
            >
              {network.title}
              <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
            </a>
          ))}
        </div>
        {socials.length > 0 && (
          <div className="siteFooterCol">
            <h2>{footer.followTitle}</h2>
            {socials.map((link) => (
              <a key={link.key} href={link.url} target="_blank" rel="noreferrer noopener">
                <DestinationIcon url={link.url} size={15} />
                {link.label}
                <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
              </a>
            ))}
          </div>
        )}
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
  const { doc: site } = useDocument('site')
  const consult = site?.consultBanner
  let Page = SiteNotFound
  if (path === '/' || path === '/about' || path === '/about/' || /^\/landingV2(?:\/|$)/.test(path))
    Page = SiteHome
  else if (path.startsWith('/about/working-groups')) Page = SiteWorkingGroups
  else if (path.startsWith('/about/resources')) Page = SiteResources
  else if (path.startsWith('/about/gys')) Page = SiteGys
  else if (path.startsWith('/about/coy')) Page = SiteCoy
  else if (path.startsWith('/about/faq')) Page = SiteFaq
  else if (path.startsWith('/about/contact')) Page = SiteContact
  else if (path.startsWith('/about/organisation')) Page = PublicPlatform

  return (
    <div className="siteShell">
      <a className="skipLink" href="#site-main">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="site-main" tabIndex="-1">
        <Page />
      </main>
      {consult && (
        <p className="siteConsultBanner">
          <span>
            <strong>{consult.title}</strong> {consult.body}
          </span>
          <span className="siteConsultBannerActions">
            {(consult.links || []).map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </span>
        </p>
      )}
      <SiteFooter />
    </div>
  )
}
