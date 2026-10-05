interface ShellProps {
  children?: import('react').ReactNode
}

import type { AnyValue, Doc } from '../lib/types'
import { canManageGroups } from '../lib/groupPermissions'
import { navigationActive as isActive } from '../lib/pageSections'
import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { A } from './ui'
import { Brand } from './Brand'
import { usePath } from '../lib/router'
import { useAccount } from '../lib/accountContext'
import { AlertSetupNotice } from './AlertSetupNotice'
import {
  TbHome as Home,
  TbCalendar as CalendarDays,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbMapPin as MapPin,
  TbUsers as Users,
  TbSearch as Search,
  TbMenu2 as Menu,
  TbSchool as GraduationCap,
  TbLibrary as Library,
  TbBuilding as Building2,
  TbShield as Shield,
  TbBriefcase as Briefcase,
  TbClipboardCheck as ClipboardCheck,
  TbTools as PenTool,
  TbSitemap as Network,
  TbUserCircle as UserCircle,
  TbFilePencil as FilePenLine,
  TbSpeakerphone as Megaphone,
  TbRosetteDiscountCheck as BadgeCheck,
  TbChevronRight as ChevronRight,
  TbHelpCircle as CircleHelp,
  TbWorldSearch as WorldSearch,
} from 'react-icons/tb'

// The palette only renders on Cmd/Ctrl+K — keep it out of the shell chunk
// and fetch it on first use instead of shipping it to every member.
const CommandPalette = dynamic(() => import('./CommandPalette').then((m) => m.CommandPalette))

// Home stands alone; browsing, people and shared work have distinct homes.
const SECTION = {
  home: '',
  now: 'Explore',
  act: 'Work & decisions',
  people: 'People & groups',
  mine: 'Your responsibilities',
}

export function Shell({ children }: ShellProps) {
  const path = usePath()
  const [sheet, setSheet] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const menuButtonRef = useRef<AnyValue>(null)
  const sheetRef = useRef<AnyValue>(null)
  const { account } = useAccount()
  const access = account?.access || {
    teamRoles: account?.teamRoles || [],
    wgAssignments: [],
    manageAllWgs: false,
  }
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

  const nav = useMemo(() => {
    const teamRoles = access.teamRoles || []
    const capabilities = access.capabilities || []
    const canManageAccounts = access.canAdminister || capabilities.includes('accounts.manage')

    const entries = [
      // Before the course is passed only these two are reachable.
      {
        section: SECTION.now,
        href: '/onboarding',
        label: 'Onboarding',
        icon: GraduationCap,
        when: !verified,
      },
      {
        section: SECTION.now,
        href: '/resources',
        label: 'Resources',
        icon: Library,
        when: !verified,
      },

      { section: SECTION.home, href: '/', label: 'Home', icon: Home },
      {
        section: SECTION.now,
        href: '/calendar',
        label: 'Calendar',
        icon: CalendarDays,
      },
      {
        section: SECTION.now,
        href: '/coys',
        label: 'COY tracker',
        icon: MapPin,
      },
      {
        section: SECTION.now,
        href: '/opportunities',
        label: 'Opportunities',
        icon: Megaphone,
      },
      {
        section: SECTION.now,
        href: '/resources',
        label: 'Resources',
        icon: Library,
      },

      {
        section: SECTION.act,
        href: '/work',
        label: 'Tasks',
        icon: ClipboardCheck,
      },
      {
        section: SECTION.act,
        href: '/council',
        label: 'Decisions',
        icon: Gavel,
      },
      {
        section: SECTION.act,
        href: '/negotiations',
        label: 'Negotiations',
        icon: WorldSearch,
        when: verified || path.startsWith('/negotiations'),
      },
      {
        section: SECTION.act,
        href: '/submissions',
        label: 'Policy & statements',
        icon: FileText,
      },
      {
        section: SECTION.people,
        href: '/groups',
        label: 'Groups',
        icon: Users,
      },
      {
        section: SECTION.people,
        href: '/directory/people',
        label: 'Directory',
        icon: UserCircle,
      },
      {
        section: SECTION.mine,
        href: '/platform/partnerships',
        label: 'Partnerships',
        icon: Building2,
        when: teamRoles.includes('partnerships'),
      },

      {
        section: SECTION.mine,
        href: '/cp',
        label: 'WG Contact Point',
        icon: Briefcase,
        when: canManageGroups(account),
      },
      {
        section: SECTION.mine,
        href: '/team/membership',
        label: 'Membership Team',
        icon: ClipboardCheck,
        when: teamRoles.includes('membership_team'),
      },
      {
        section: SECTION.mine,
        href: '/team/gys',
        label: 'GYS Policy Team',
        icon: PenTool,
        when: teamRoles.includes('gys_policy_team'),
      },
      {
        section: SECTION.mine,
        href: '/staff/content',
        label: 'Content studio',
        icon: FilePenLine,
        when: capabilities.includes('content.draft') || capabilities.includes('content.review'),
      },
      {
        section: SECTION.mine,
        href: '/focal',
        label: 'Global Focal Point',
        icon: Network,
        when: access.isFocalPoint,
      },
      {
        section: SECTION.mine,
        href: '/ngo',
        label: 'NGO platform',
        icon: Building2,
        when: access.ngo,
      },
      {
        section: SECTION.mine,
        href: '/staff/review',
        label: 'Review queue',
        icon: ClipboardCheck,
        when: canManageAccounts || teamRoles.includes('membership_team'),
      },
      {
        section: SECTION.mine,
        href: '/admin',
        label: 'Admin',
        icon: Shield,
        when: canManageAccounts,
      },
    ]

    const seen = new Set()
    const sections: AnyValue = []
    for (const entry of entries) {
      // `when: undefined` means "any verified member"; the pre-course entries
      // above set it explicitly.
      const allowed = entry.when === undefined ? verified : Boolean(entry.when)
      if (!allowed || seen.has(entry.href)) continue
      seen.add(entry.href)
      const group = sections.find((s: AnyValue) => s.section === entry.section)
      const item = {
        href: entry.href,
        label: entry.label,
        icon: entry.icon,
      }
      if (group) group.items.push(item)
      else sections.push({ section: entry.section, items: [item] })
    }
    const order = [SECTION.home, SECTION.now, SECTION.people, SECTION.act, SECTION.mine]
    return sections.sort(
      (a: AnyValue, b: AnyValue) => order.indexOf(a.section) - order.indexOf(b.section),
    )
  }, [
    account,
    verified,
    path,
    access.ngo,
    access.canAdminister,
    access.isFocalPoint,
    access.capabilities,
    access.teamRoles,
  ])

  const mobilePrimaryNav = verified
    ? [
        { href: '/calendar', label: 'Calendar', icon: CalendarDays },
        {
          href: '/opportunities',
          label: 'Opportunities',
          mobileLabel: 'Calls',
          icon: Megaphone,
        },
        { href: '/', label: 'Home', icon: Home },
        { href: '/groups', label: 'Groups', icon: Users },
        { href: '/profile', label: 'Profile', icon: UserCircle },
      ]
    : [
        { href: '/onboarding', label: 'Onboarding', icon: GraduationCap },
        { href: '/resources', label: 'Resources', icon: Library },
      ]

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
              {access.isFocalPoint && <span className="metaMuted">Global Focal Point</span>}
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
