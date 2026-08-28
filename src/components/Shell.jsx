import { useState, useEffect, useMemo, useRef } from 'react'
import { A } from './ui.jsx'
import { CommandPalette } from './CommandPalette.jsx'
import { Brand } from './Brand.jsx'
import { usePath } from '../lib/router.js'
import { useAccount } from '../lib/accountContext.jsx'
import { MissionStatusBar } from './MissionConsole.jsx'
import {
  TbHome as Home,
  TbCalendar as CalendarDays,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbMapPin as MapPin,
  TbUsers as Users,
  TbAt as AtSign,
  TbSearch as Search,
  TbMenu2 as Menu,
  TbScript as ScrollText,
  TbSchool as GraduationCap,
  TbLibrary as Library,
  TbBuilding as Building2,
  TbShield as Shield,
  TbBriefcase as Briefcase,
  TbClipboardCheck as ClipboardCheck,
  TbTools as PenTool,
  TbSitemap as Network,
  TbAward as Award,
  TbTrophy as Trophy,
  TbUserCircle as UserCircle,
  TbFilePencil as FilePenLine,
  TbSpeakerphone as Megaphone,
  TbRosetteDiscountCheck as BadgeCheck,
  TbChevronRight as ChevronRight,
  TbHelpCircle as CircleHelp,
} from 'react-icons/tb'

function isActive(path, href) {
  return href === '/' ? path === '/' : path.startsWith(href)
}

const STATIONS = [
  ['/cp', 'WG contact point'],
  ['/team/membership', 'Membership team'],
  ['/team/gys', 'GYS policy'],
  ['/staff/content', 'Content ops'],
  ['/staff/points', 'NGO points'],
  ['/admin', 'Admin'],
  ['/focal', 'Global focal point'],
  ['/ngo', 'NGO platform'],
  ['/onboarding', 'Onboarding'],
  ['/library', 'Library'],
  ['/resources', 'Science resources'],
  ['/calendar', 'Calendar'],
  ['/submissions', 'Submissions'],
  ['/council', 'Council'],
  ['/coys', 'COY tracker'],
  ['/gys', 'Youth statement'],
  ['/groups', 'Working groups'],
  ['/opportunities', 'Opportunities'],
  ['/directory', 'Directory'],
  ['/recognition', 'NGO recognition'],
  ['/profile', 'Profile'],
  ['/search', 'Search'],
]

function stationFor(path) {
  const match = STATIONS.find(([prefix]) => path.startsWith(prefix))
  return match ? match[1] : 'Member hub'
}

// Four headings, each answering one question. Role-gated tools all land in
// `mine` instead of adding a heading per responsibility.
const SECTION = {
  now: "What's on",
  act: 'Take part',
  people: 'People & groups',
  mine: 'Your responsibilities',
}

export function Shell({ children }) {
  const path = usePath()
  const [sheet, setSheet] = useState(false)
  const menuButtonRef = useRef(null)
  const sheetRef = useRef(null)
  const { account } = useAccount()
  const access = account?.access || {
    teamRoles: account?.teamRoles || [],
    wgAssignments: [],
    manageAllWgs: account?.role === 'admin',
  }
  useEffect(() => {
    setSheet(false)
  }, [path])

  useEffect(() => {
    if (!sheet) return undefined
    const sheetElement = sheetRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusable = () =>
      Array.from(
        sheetElement?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      )

    focusable()[0]?.focus()

    const handleKeyboard = (event) => {
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
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyboard)
    return () => {
      window.removeEventListener('keydown', handleKeyboard)
      document.body.style.overflow = previousOverflow
      menuButtonRef.current?.focus()
    }
  }, [sheet])

  const isOperational = [
    '/cp',
    '/team',
    '/staff',
    '/admin',
    '/focal',
    '/ngo',
  ].some((prefix) => path.startsWith(prefix))

  const verified = Boolean(account?.isVerified)

  /**
   * Navigation is declared as one flat list and grouped afterwards. The
   * previous version pushed a new section per role, so an account holding
   * several responsibilities saw seven headings, and `/staff/points` appeared
   * twice because the de-duplication only looked inside one section.
   *
   * Sections answer one question each: What's on? · What I act on · Who's
   * there · What I'm responsible for. Every role-gated destination lands in
   * that last section rather than earning a heading of its own.
   */
  const nav = useMemo(() => {
    const isAdmin = account?.role === 'admin'
    const teamRoles = access.teamRoles || []
    const capabilities = access.capabilities || []

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
        label: 'Science resources',
        icon: Library,
        when: !verified,
      },

      { section: SECTION.now, href: '/', label: 'Home', icon: Home },
      {
        section: SECTION.now,
        href: '/calendar',
        label: 'Calendar',
        icon: CalendarDays,
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
        label: 'Science resources',
        icon: Library,
      },

      {
        section: SECTION.act,
        href: '/submissions',
        label: 'Submissions',
        icon: FileText,
      },
      {
        section: SECTION.act,
        href: '/gys',
        label: 'Youth Statement',
        icon: ScrollText,
      },
      { section: SECTION.act, href: '/council', label: 'Council', icon: Gavel },
      {
        section: SECTION.act,
        href: '/coys',
        label: 'COY tracker',
        icon: MapPin,
      },

      {
        section: SECTION.people,
        href: '/groups',
        label: 'Working groups',
        icon: Users,
      },
      {
        section: SECTION.people,
        href: '/directory',
        label: 'Directory',
        icon: AtSign,
      },
      {
        section: SECTION.people,
        href: '/recognition',
        label: 'NGO recognition',
        icon: Trophy,
      },

      {
        section: SECTION.mine,
        href: '/cp',
        label: 'WG Contact Point',
        icon: Briefcase,
        when:
          account?.isWgContact ||
          access.wgAssignments?.length > 0 ||
          access.manageAllWgs,
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
        when:
          capabilities.includes('content.draft') ||
          capabilities.includes('content.review'),
      },
      {
        section: SECTION.mine,
        href: '/staff/points',
        label: 'NGO points',
        icon: Award,
        when:
          isAdmin ||
          account?.role === 'focal_point' ||
          teamRoles.includes('membership_team'),
      },
      {
        section: SECTION.mine,
        href: '/focal',
        label: 'Global Focal Point',
        icon: Network,
        when: isAdmin || account?.role === 'focal_point',
      },
      {
        section: SECTION.mine,
        href: '/ngo',
        label: 'NGO platform',
        icon: Building2,
        when: access.ngo || isAdmin || account?.role === 'ngo_admin',
      },
      {
        section: SECTION.mine,
        href: '/admin',
        label: 'Admin',
        icon: Shield,
        when: isAdmin,
      },
    ]

    const seen = new Set()
    const sections = []
    for (const entry of entries) {
      // `when: undefined` means "any verified member"; the pre-course entries
      // above set it explicitly.
      const allowed = entry.when === undefined ? verified : Boolean(entry.when)
      if (!allowed || seen.has(entry.href)) continue
      seen.add(entry.href)
      const group = sections.find((s) => s.section === entry.section)
      const item = {
        href: entry.href,
        label: entry.label,
        icon: entry.icon,
      }
      if (group) group.items.push(item)
      else sections.push({ section: entry.section, items: [item] })
    }
    return sections
  }, [
    account,
    verified,
    access.ngo,
    access.manageAllWgs,
    access.teamRoles?.join(','),
    access.capabilities?.join(','),
    access.wgAssignments?.length,
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
        {nav.map((group) => (
          <div key={group.section}>
            <p className="navSection">{group.section}</p>
            {group.items.map(({ href, label, icon: Icon }) => (
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
            <span>Help &amp; support</span>
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
              {account.role === 'admin' && (
                <span className="metaMuted">Administrator</span>
              )}
              {account.role === 'focal_point' && (
                <span className="metaMuted">Global Focal Point</span>
              )}
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
              aria-label={
                sheet ? 'Close navigation menu' : 'Open navigation menu'
              }
              aria-expanded={sheet}
              aria-controls="mobile-navigation"
            >
              <Menu size={21} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex="-1"
          inert={sheet ? true : undefined}
          aria-hidden={sheet ? 'true' : undefined}
        >
          {/* Operational consoles only — the COP31 clock is ops chrome, not
              something a member checking a deadline needs on every page. */}
          {isOperational && <MissionStatusBar station={stationFor(path)} />}
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
                <A
                  href="/search"
                  className="sheetSearch"
                  onClick={() => setSheet(false)}
                >
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
              {nav.map((group) => (
                <section className="sheetSection" key={group.section}>
                  <p className="navSection">{group.section}</p>
                  <div className="sheetNavGrid">
                    {group.items.map(({ href, label, icon: Icon }) => (
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
                  <span>Help &amp; support</span>
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

      <CommandPalette />
    </div>
  )
}
