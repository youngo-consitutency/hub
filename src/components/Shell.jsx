import { useState, useEffect, useMemo } from 'react'
import { A } from './ui.jsx'
import { CommandPalette } from './CommandPalette.jsx'
import { FeedbackButton } from './FeedbackButton.jsx'
import { Brand } from './Brand.jsx'
import { usePath } from '../lib/router.js'
import { apiPost } from '../lib/api.js'
import { clearSession } from '../lib/session.js'
import { useAccount } from '../lib/accountContext.jsx'
import { MissionStatusBar } from './MissionConsole.jsx'
import {
  Home,
  CalendarDays,
  FileText,
  Gavel,
  MapPin,
  Users,
  AtSign,
  Search,
  MoreHorizontal,
  ScrollText,
  LogOut,
  GraduationCap,
  Library,
  Building2,
  Shield,
  Briefcase,
  ClipboardCheck,
  PenTool,
  Network,
  Award,
  Trophy,
  UserCircle,
  FilePenLine,
  Megaphone,
} from 'lucide-react'

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
  ['/focal', 'Focal point'],
  ['/ngo', 'NGO platform'],
  ['/onboarding', 'Onboarding'],
  ['/library', 'Library'],
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
  const { account } = useAccount()
  const access = account?.access || {
    teamRoles: account?.teamRoles || [],
    wgAssignments: [],
    manageAllWgs: account?.role === 'admin',
  }
  useEffect(() => {
    setSheet(false)
  }, [path])

  const workspace = path.startsWith('/cp')
    ? 'wg'
    : path.startsWith('/team/membership')
      ? 'membership'
      : path.startsWith('/team/gys')
        ? 'gys'
        : 'member'

  // Operational consoles keep the dense mission treatment; member-facing pages
  // get the warmer register. Staff / admin / NGO tools count as operational even
  // though they resolve to the default member workspace.
  const surface =
    workspace !== 'member' ||
    ['/staff', '/admin', '/focal', '/ngo'].some((prefix) =>
      path.startsWith(prefix),
    )
      ? 'mission'
      : 'member'

  useEffect(() => {
    const root = document.documentElement
    root.dataset.workspace = workspace
    root.dataset.surface = surface
  }, [workspace, surface])

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
        href: '/library',
        label: 'Library',
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
        label: 'Focal Point',
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

  const tabs = verified
    ? [
        { href: '/', label: 'Home', icon: Home },
        { href: '/calendar', label: 'Calendar', icon: CalendarDays },
        { href: '/groups', label: 'Groups', icon: Users },
        { href: '/profile', label: 'Profile', icon: UserCircle },
      ]
    : [
        { href: '/onboarding', label: 'Onboard', icon: GraduationCap },
        { href: '/onboarding/course', label: 'Course', icon: GraduationCap },
        { href: '/library', label: 'Library', icon: Library },
      ]

  // The sheet keeps the sidebar's headings: a flat list of sixteen entries
  // gave a member no way to tell a personal tool from a constituency-wide one.
  const tabHrefs = new Set(tabs.map((item) => item.href))
  const more = nav
    .map((group) => ({
      section: group.section,
      items: group.items.filter((item) => !tabHrefs.has(item.href)),
    }))
    .filter((group) => group.items.length > 0)

  const signOut = async () => {
    try {
      await apiPost('/auth/logout', {})
    } catch {
      // Clear the local session even when the server cannot be reached.
    }
    clearSession()
    window.location.reload()
  }

  return (
    <div className="shell">
      <a className="skipLink" href="#main-content">
        Skip to main content
      </a>
      <nav className="sidebar" aria-label="Primary">
        <A
          href={verified ? '/' : '/onboarding'}
          className="wordmark"
          aria-label="YOUNGO Hub home"
        >
          <Brand />
        </A>
        {verified && (
          <A href="/search" className="navItem">
            <Search size={18} strokeWidth={1.75} aria-hidden />
            Search
            <kbd className="kbd" style={{ marginLeft: 'auto' }}>
              ⌘K
            </kbd>
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
          {account && verified && (
            <A
              href="/profile"
              className={`accountChip ${isActive(path, '/profile') ? 'active' : ''}`}
              title={account.email}
              aria-current={isActive(path, '/profile') ? 'page' : undefined}
            >
              <span className="accountName">{account.name}</span>
              <span className="metaMuted">
                {account.isVerified ? 'Verified' : 'Pending course'}
                {account.role === 'admin' ? ' · Admin' : ''}
                {account.role === 'focal_point' ? ' · Focal Point' : ''}
              </span>
            </A>
          )}
          {account && !verified && (
            <div className="accountChip" title={account.email}>
              <span className="accountName">{account.name}</span>
              <span className="metaMuted">Pending course</span>
            </div>
          )}
          <button type="button" className="navItem" onClick={signOut}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
            Sign out
          </button>
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
            {verified && (
              <A
                href="/search"
                className="btn btn-ghost btn-sm"
                aria-label="Search"
              >
                <Search size={20} strokeWidth={1.75} aria-hidden />
              </A>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex="-1">
          {/* Operational consoles only — the COP31 clock is ops chrome, not
              something a member checking a deadline needs on every page. */}
          {surface === 'mission' && (
            <MissionStatusBar station={stationFor(path)} />
          )}
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
            className="sheet"
            id="more-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
          >
            <div className="sheetHandle" aria-hidden />
            {verified && (
              <A href="/search" className="navItem">
                <Search size={18} strokeWidth={1.75} aria-hidden />
                Search
              </A>
            )}
            {more.map((group) => (
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
            {/* Sign out lived only in the sidebar, which is hidden below
                900px — so it was unreachable on a phone. */}
            <div className="sheetFooter">
              <button type="button" className="navItem" onClick={signOut}>
                <LogOut size={18} strokeWidth={1.75} aria-hidden />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      <CommandPalette />

      {/* Available on every page, including before the course is passed — a
          blocked member is exactly who needs to reach the team. */}
      {account && <FeedbackButton />}

      <nav className="tabbar" aria-label="Primary mobile">
        {tabs.map(({ href, label, icon: Icon }) => (
          <A
            key={href}
            href={href}
            className={`tab ${isActive(path, href) ? 'active' : ''}`}
            aria-current={isActive(path, href) ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={1.75} aria-hidden />
            {label}
          </A>
        ))}
        {/* Shown for every signed-in account, not just verified ones: a member
            still working through the course needs to be able to sign out. */}
        {account && (
          <button
            type="button"
            className={`tab ${sheet ? 'active' : ''}`}
            onClick={() => setSheet((s) => !s)}
            aria-expanded={sheet}
            aria-controls="more-navigation"
          >
            <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden />
            More
          </button>
        )}
      </nav>
    </div>
  )
}
