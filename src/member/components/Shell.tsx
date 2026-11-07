interface ShellProps {
  children?: import('react').ReactNode
}

import type { AnyValue, Doc } from '../lib/types'
import { mobileNavFor, navFor, viewerOf } from '../lib/routes'
import { navigationActive as isActive } from '../lib/pageSections'
import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { A } from './ui'
import { ThemeToggle } from './ThemeToggle'
import { Brand } from './Brand'
import { usePath } from '../lib/router'
import { useAccount } from '../lib/accountContext'
import { AlertSetupNotice } from './AlertSetupNotice'
import {
  TbSearch as Search,
  TbMenu2 as Menu,
  TbUserCircle as UserCircle,
  TbRosetteDiscountCheck as BadgeCheck,
  TbChevronRight as ChevronRight,
  TbHelpCircle as CircleHelp,
} from 'react-icons/tb'

// The palette only renders on Cmd/Ctrl+K — keep it out of the shell chunk
// and fetch it on first use instead of shipping it to every member.
const CommandPalette = dynamic(() => import('./CommandPalette').then((m) => m.CommandPalette))

export function Shell({ children }: ShellProps) {
  const path = usePath()
  const [sheet, setSheet] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const menuButtonRef = useRef<AnyValue>(null)
  const sheetRef = useRef<AnyValue>(null)
  const { account } = useAccount()
  useEffect(() => {
    setSheet(false)
  }, [path])

  // The shortcut lives here (not inside the palette) so it works before the
  // lazily imported palette chunk has arrived — the chunk mounts already open.
  useEffect(() => {
    const onKey = (e: AnyValue) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!sheet) return undefined
    const sheetElement = sheetRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = (): Element[] => {
      const list = (sheetElement as HTMLElement | null)?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      return list ? Array.prototype.slice.call(list) : []
    }

    ;(focusable()[0] as HTMLElement | undefined)?.focus()

    const handleKeyboard = (event: AnyValue) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setSheet(false)
        return
      }
      if (event.key !== 'Tab') return

      const controls = focusable()
      if (!controls.length) return
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        ;(last as AnyValue).focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        ;(first as AnyValue).focus()
      }
    }

    const menuButton = menuButtonRef.current
    window.addEventListener('keydown', handleKeyboard)
    return () => {
      window.removeEventListener('keydown', handleKeyboard)
      document.body.style.overflow = previousOverflow
      menuButton?.focus()
    }
  }, [sheet])

  const verified = Boolean(account?.isVerified)

  // every entry comes from the route registry, filtered for this account
  const viewer = useMemo(() => viewerOf(account), [account])
  const nav = useMemo(() => navFor(viewer, path), [viewer, path])
  const mobilePrimaryNav = useMemo(() => mobileNavFor(viewer, path), [viewer, path])

  return (
    <div className="shell">
      <a className="skipLink" href="#main-content">
        Skip to main content
      </a>
      <nav
        className="sidebar"
        aria-label="Primary"
        inert={sheet ? true : undefined}
        aria-hidden={sheet ? 'true' : undefined}
      >
        <div className="sidebarBrandRow">
          <A
            href={verified ? '/' : '/onboarding'}
            className="wordmark"
            aria-label="YOUNGO Hub home"
          >
            <Brand />
          </A>
        </div>
        {verified && (
          <A href="/search" className="navItem sidebarSearch">
            <Search size={18} strokeWidth={1.75} aria-hidden />
            <span>Search the Hub</span>
          </A>
        )}
        {nav.map((group: Doc) => (
          <div className="navGroup" key={group.section || 'home'}>
            {group.section && <p className="navSection">{group.section}</p>}
            {group.items.map(({ href, label, icon: Icon }: AnyValue) => (
              <A
                key={href}
                href={href}
                className={`navItem ${isActive(path, href) ? 'active' : ''}`}
                aria-current={isActive(path, href) ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden />
                {label}
              </A>
            ))}
          </div>
        ))}
        <div className="sidebarFooter">
          <ThemeToggle />
          <A
            href="/help"
            className={`navItem sidebarHelpLink ${isActive(path, '/help') ? 'active' : ''}`}
            aria-current={isActive(path, '/help') ? 'page' : undefined}
          >
            <CircleHelp size={18} strokeWidth={1.75} aria-hidden />
            <span>Help</span>
          </A>
          {account && verified && (
            <A
              href="/profile"
              className={`accountChip ${isActive(path, '/profile') ? 'active' : ''}`}
              title={account.email}
              aria-current={isActive(path, '/profile') ? 'page' : undefined}
            >
              <span className="accountChipHeader">
                <span className="accountNameRow">
                  <span className="accountName">{account.name}</span>
                  <BadgeCheck
                    className="accountVerified"
                    size={16}
                    strokeWidth={2}
                    aria-label="Verified member"
                  />
                </span>
                <ChevronRight
                  className="accountChipArrow"
                  size={17}
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              {viewer.isFocalPoint && <span className="metaMuted">Global Focal Point</span>}
            </A>
          )}
          {account && !verified && (
            <div className="accountChip" title={account.email}>
              <span className="accountName">{account.name}</span>
              <span className="metaMuted">Pending course</span>
            </div>
          )}
        </div>
      </nav>

      <div className="content">
        <header className="topbar">
          <A
            href={verified ? '/' : '/onboarding'}
            className="wordmark"
            aria-label="YOUNGO Hub home"
          >
            <Brand />
          </A>
          <div className="rowGap">
            <button
              ref={menuButtonRef}
              type="button"
              className={`btn btn-ghost btn-sm mobileMenuButton ${sheet ? 'active' : ''}`}
              onClick={() => setSheet((open) => !open)}
              aria-label={sheet ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={sheet}
              aria-controls="mobile-navigation"
            >
              <Menu size={21} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          inert={sheet ? true : undefined}
          aria-hidden={sheet ? 'true' : undefined}
        >
          {!verified && (
            <div className="noticeBanner noticeBannerWarn">
              <span className="noticeDot" />
              <div className="noticeCopy">
                <p>Complete the membership course to use the full Hub</p>
              </div>
              <A href="/onboarding/course" className="btn btn-primary btn-sm">
                Course
              </A>
            </div>
          )}
          {verified && <AlertSetupNotice />}
          {children}
        </main>
      </div>

      {sheet && (
        <>
          <button
            type="button"
            className="sheetBackdrop"
            aria-label="Close navigation"
            onClick={() => setSheet(false)}
          />
          <div
            ref={sheetRef}
            className="sheet"
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="sheetHeader">
              {verified && (
                <A href="/search" className="sheetSearch" onClick={() => setSheet(false)}>
                  <Search size={19} strokeWidth={1.75} aria-hidden />
                  <span>Search the Hub</span>
                </A>
              )}
              {verified && (
                <A
                  href="/profile"
                  className={`sheetAccount ${isActive(path, '/profile') ? 'active' : ''}`}
                  aria-current={isActive(path, '/profile') ? 'page' : undefined}
                  onClick={() => setSheet(false)}
                >
                  <UserCircle size={19} strokeWidth={1.75} aria-hidden />
                  <span>{account?.name || 'Profile'}</span>
                  <ChevronRight size={17} strokeWidth={1.75} aria-hidden />
                </A>
              )}
              <ThemeToggle />
            </div>
            <div className="sheetSections">
              {nav.map((group: Doc) => (
                <section className="sheetSection" key={group.section}>
                  {group.section && <p className="navSection">{group.section}</p>}
                  <div className="sheetNavGrid">
                    {group.items.map(({ href, label, icon: Icon }: AnyValue) => (
                      <A
                        key={href}
                        href={href}
                        className={`navItem ${isActive(path, href) ? 'active' : ''}`}
                        aria-current={isActive(path, href) ? 'page' : undefined}
                        onClick={() => setSheet(false)}
                      >
                        <Icon size={18} strokeWidth={1.75} aria-hidden />
                        <span>{label}</span>
                      </A>
                    ))}
                  </div>
                </section>
              ))}
            </div>
            {account && (
              <div className="sheetUtilities" aria-label="Support">
                <A
                  href="/help"
                  className="navItem"
                  aria-current={isActive(path, '/help') ? 'page' : undefined}
                  onClick={() => setSheet(false)}
                >
                  <CircleHelp size={18} strokeWidth={1.75} aria-hidden />
                  <span>Help</span>
                </A>
              </div>
            )}
          </div>
        </>
      )}

      <nav
        className={`mobileBottomNav ${verified ? '' : 'mobileBottomNavCompact'}`}
        aria-label="Quick navigation"
        inert={sheet ? true : undefined}
        aria-hidden={sheet ? 'true' : undefined}
      >
        {mobilePrimaryNav.map(({ href, label, mobileLabel, icon: Icon }) => (
          <A
            key={href}
            href={href}
            className={`mobileBottomItem ${isActive(path, href) ? 'active' : ''}`}
            aria-current={isActive(path, href) ? 'page' : undefined}
            aria-label={mobileLabel ? label : undefined}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden />
            <span>{mobileLabel || label}</span>
          </A>
        ))}
      </nav>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
