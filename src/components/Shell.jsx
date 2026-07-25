import { useState, useEffect, useMemo } from 'react'
import { A } from './ui.jsx'
import { CommandPalette } from './CommandPalette.jsx'
import { Brand } from './Brand.jsx'
import { usePath } from '../lib/router.js'
import { apiPost } from '../lib/api.js'
import { clearSession } from '../lib/session.js'
import { useAccount } from '../lib/accountContext.jsx'
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
  MessageSquare,
  Network,
  Award,
  Trophy,
  BrainCircuit,
  UserCircle,
  FilePenLine,
} from 'lucide-react'

function isActive(path, href) {
  return href === '/' ? path === '/' : path.startsWith(href)
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

  useEffect(() => {
    const workspace = path.startsWith('/cp')
      ? 'wg'
      : path.startsWith('/team/membership')
        ? 'membership'
        : path.startsWith('/team/gys')
          ? 'gys'
          : 'member'
    document.documentElement.dataset.workspace = workspace
  }, [path])

  const verified = Boolean(account?.isVerified)

  const nav = useMemo(() => {
    const sections = []
    if (!verified) {
      sections.push({
        section: 'Start',
        items: [
          { href: '/onboarding', label: 'Onboarding', icon: GraduationCap },
          { href: '/library', label: 'Library', icon: Library },
        ],
      })
    }
    if (verified) {
      sections.push(
        {
          section: 'For you',
          items: [
            { href: '/', label: 'Home', icon: Home },
            { href: '/calendar', label: 'Calendar', icon: CalendarDays },
            {
              href: '/intelligence',
              label: 'Hub Intelligence',
              icon: BrainCircuit,
            },
          ],
        },
        {
          section: 'Participate',
          items: [
            { href: '/submissions', label: 'Submissions', icon: FileText },
            { href: '/coys', label: 'COY tracker', icon: MapPin },
            { href: '/council', label: 'Council', icon: Gavel },
            { href: '/gys', label: 'Youth Statement', icon: ScrollText },
          ],
        },
        {
          section: 'Community',
          items: [
            { href: '/groups', label: 'Working groups', icon: Users },
            { href: '/directory', label: 'Directory', icon: AtSign },
            { href: '/recognition', label: 'NGO recognition', icon: Trophy },
            { href: '/messages', label: 'Messages', icon: MessageSquare },
          ],
        },
      )
    }
    if (['admin', 'focal_point'].includes(account?.role)) {
      sections.push({
        section: 'Representation',
        items: [
          { href: '/focal', label: 'Focal Point', icon: Network },
          { href: '/staff/points', label: 'NGO points', icon: Award },
        ],
      })
    }
    if (
      access.ngo ||
      account?.role === 'admin' ||
      account?.role === 'ngo_admin'
    ) {
      sections.push({
        section: 'Organisation',
        items: [{ href: '/ngo', label: 'NGO platform', icon: Building2 }],
      })
    }
    if (
      account?.isWgContact ||
      access.wgAssignments?.length ||
      access.manageAllWgs
    ) {
      sections.push({
        section: 'Your workspaces',
        items: [{ href: '/cp', label: 'WG Contact Point', icon: Briefcase }],
      })
    }
    if (access.teamRoles?.includes('membership_team')) {
      const section = sections.find(
        (item) => item.section === 'Your workspaces',
      )
      const items = [
        {
          href: '/team/membership',
          label: 'Membership Team',
          icon: ClipboardCheck,
        },
        { href: '/staff/points', label: 'NGO points', icon: Award },
      ]
      if (section)
        section.items.push(
          ...items.filter((i) => !section.items.some((x) => x.href === i.href)),
        )
      else sections.push({ section: 'Your workspaces', items })
    }
    if (access.teamRoles?.includes('gys_policy_team')) {
      const section = sections.find(
        (item) => item.section === 'Your workspaces',
      )
      const item = {
        href: '/team/gys',
        label: 'GYS Policy Team',
        icon: PenTool,
      }
      if (section) section.items.push(item)
      else sections.push({ section: 'Your workspaces', items: [item] })
    }
    if (
      access.capabilities?.includes('content.draft') ||
      access.capabilities?.includes('content.review')
    ) {
      const section = sections.find(
        (item) => item.section === 'Your workspaces',
      )
      const item = {
        href: '/staff/content',
        label: 'Content studio',
        icon: FilePenLine,
      }
      if (section) section.items.push(item)
      else sections.push({ section: 'Your workspaces', items: [item] })
    }
    if (account?.role === 'admin') {
      sections.push({
        section: 'Staff',
        items: [{ href: '/admin', label: 'Admin', icon: Shield }],
      })
    }
    return sections
  }, [
    account,
    verified,
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

  const tabHrefs = new Set(tabs.map((item) => item.href))
  const more = nav
    .flatMap((section) => section.items)
    .filter((item) => !tabHrefs.has(item.href))

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
          {path.startsWith('/cp') && (
            <div className="workspaceContext workspaceContext-wg">
              <Briefcase size={16} aria-hidden />
              WG Contact Point workspace
            </div>
          )}
          {path.startsWith('/team/membership') && (
            <div className="workspaceContext workspaceContext-membership">
              <ClipboardCheck size={16} aria-hidden />
              Membership Team workspace
            </div>
          )}
          {path.startsWith('/team/gys') && (
            <div className="workspaceContext workspaceContext-gys">
              <PenTool size={16} aria-hidden />
              Global Youth Statement Policy workspace
            </div>
          )}
          {path.startsWith('/staff/content') && (
            <div className="workspaceContext">
              <FilePenLine size={16} aria-hidden />
              Content operations workspace
            </div>
          )}
          {children}
        </main>
      </div>

      {sheet && (
        <div
          className="sheet"
          id="more-navigation"
          aria-label="More navigation"
        >
          {more.map(({ href, label, icon: Icon }) => (
            <A key={href} href={href} className="navItem">
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              {label}
            </A>
          ))}
        </div>
      )}

      <CommandPalette />

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
        {verified && (
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
