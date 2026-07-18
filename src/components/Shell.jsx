import { useState, useEffect, useMemo } from 'react'
import { A } from './ui.jsx'
import { CommandPalette } from './CommandPalette.jsx'
import { usePath, navigate } from '../lib/router.js'
import { apiPost } from '../lib/api.js'
import { clearSession } from '../lib/session.js'
import { useAccount } from '../lib/accountContext.jsx'
import {
  Home, CalendarDays, FileText, Gavel, MapPin, Users, AtSign,
  Search, MoreHorizontal, Settings2, ScrollText, LogOut,
  GraduationCap, Library, Building2, Shield, Briefcase,
  ClipboardCheck, PenTool, MessageSquare, Network, Award,
} from 'lucide-react'

function isActive(path, href) {
  return href === '/' ? path === '/' : path.startsWith(href)
}

export function Shell({ children }) {
  const path = usePath()
  const [sheet, setSheet] = useState(false)
  const { account } = useAccount()
  const access = account?.access || { teamRoles: account?.teamRoles || [], wgAssignments: [], manageAllWgs: account?.role === 'admin' }
  useEffect(() => { setSheet(false) }, [path])

  useEffect(() => {
    const workspace = path.startsWith('/cp') ? 'wg'
      : path.startsWith('/team/membership') ? 'membership'
        : path.startsWith('/team/gys') ? 'gys' : 'member'
    document.documentElement.dataset.workspace = workspace
  }, [path])

  const verified = account?.isVerified || ['admin', 'focal_point'].includes(account?.role)

  const nav = useMemo(() => {
    const sections = [
      { section: 'Start', items: [
        { href: '/onboarding', label: 'Onboarding', icon: GraduationCap },
        { href: '/library', label: 'Library', icon: Library },
      ]},
    ]
    if (verified) {
      sections.push(
        { section: 'For you', items: [
          { href: '/', label: 'Home', icon: Home },
          { href: '/calendar', label: 'Calendar', icon: CalendarDays },
        ]},
        { section: 'Participate', items: [
          { href: '/submissions', label: 'Submissions', icon: FileText },
          { href: '/coys', label: 'COY tracker', icon: MapPin },
          { href: '/council', label: 'Council', icon: Gavel },
          { href: '/gys', label: 'Youth Statement', icon: ScrollText },
        ]},
        { section: 'Community', items: [
          { href: '/groups', label: 'Working groups', icon: Users },
          { href: '/directory', label: 'Directory', icon: AtSign },
          { href: '/messages', label: 'Messages', icon: MessageSquare },
        ]},
      )
    }
    if (['admin', 'focal_point'].includes(account?.role)) {
      sections.push({ section: 'Representation', items: [
        { href: '/focal', label: 'Focal Point', icon: Network },
        { href: '/staff/points', label: 'NGO points', icon: Award },
      ]})
    }
    if (account?.isNgo || account?.role === 'admin' || account?.role === 'ngo_admin') {
      sections.push({ section: 'Organisation', items: [
        { href: '/ngo', label: 'NGO platform', icon: Building2 },
      ]})
    }
    if (account?.isWgContact || access.wgAssignments?.length || access.manageAllWgs) {
      sections.push({ section: 'Your workspaces', items: [
        { href: '/cp', label: 'WG Contact Point', icon: Briefcase },
      ]})
    }
    if (access.teamRoles?.includes('membership_team')) {
      const section = sections.find((item) => item.section === 'Your workspaces')
      const items = [
        { href: '/team/membership', label: 'Membership Team', icon: ClipboardCheck },
        { href: '/staff/points', label: 'NGO points', icon: Award },
      ]
      if (section) section.items.push(...items.filter((i) => !section.items.some((x) => x.href === i.href)))
      else sections.push({ section: 'Your workspaces', items })
    }
    if (access.teamRoles?.includes('gys_policy_team')) {
      const section = sections.find((item) => item.section === 'Your workspaces')
      const item = { href: '/team/gys', label: 'GYS Policy Team', icon: PenTool }
      if (section) section.items.push(item)
      else sections.push({ section: 'Your workspaces', items: [item] })
    }
    if (account?.role === 'admin') {
      sections.push({ section: 'Staff', items: [
        { href: '/admin', label: 'Admin', icon: Shield },
      ]})
    }
    return sections
  }, [account, verified, access.manageAllWgs, access.teamRoles?.join(','), access.wgAssignments?.length])

  const tabs = verified
    ? [
      { href: '/', label: 'Home', icon: Home },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays },
      { href: '/groups', label: 'Groups', icon: Users },
      { href: '/onboarding', label: 'Onboard', icon: GraduationCap },
    ]
    : [
      { href: '/onboarding', label: 'Onboard', icon: GraduationCap },
      { href: '/onboarding/course', label: 'Course', icon: GraduationCap },
      { href: '/library', label: 'Library', icon: Library },
    ]

  const tabHrefs = new Set(tabs.map((item) => item.href))
  const more = nav.flatMap((section) => section.items).filter((item) => !tabHrefs.has(item.href))

  const signOut = async () => {
    try { await apiPost('/auth/logout', {}) } catch { /* clear local anyway */ }
    clearSession()
    window.location.reload()
  }

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Primary">
        <A href={verified ? '/' : '/onboarding'} className="wordmark"><span className="branddot" />YOUNGO Hub</A>
        {verified && (
          <A href="/search" className="navItem"><Search size={18} strokeWidth={1.75} aria-hidden />Search<kbd className="kbd" style={{ marginLeft: 'auto' }}>⌘K</kbd></A>
        )}
        {nav.map((group) => (
          <div key={group.section}>
            <p className="navSection">{group.section}</p>
            {group.items.map(({ href, label, icon: Icon }) => (
              <A key={href} href={href} className={`navItem ${isActive(path, href) ? 'active' : ''}`}>
                <Icon size={18} strokeWidth={1.75} aria-hidden />{label}
              </A>
            ))}
          </div>
        ))}
        <div className="sidebarFooter">
          {account && (
            <div className="accountChip" title={account.email}>
              <span className="accountName">{account.name}</span>
              <span className="metaMuted">
                {account.isVerified ? 'Verified' : 'Pending course'}
                {account.role === 'admin' ? ' · Admin' : ''}
                {account.role === 'focal_point' ? ' · Focal Point' : ''}
              </span>
            </div>
          )}
          <A href="/gallery" className="navItem"><Settings2 size={18} strokeWidth={1.75} aria-hidden />Gallery</A>
          <button className="navItem" onClick={signOut}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden />Sign out
          </button>
        </div>
      </nav>

      <div className="content">
        <header className="topbar">
          <A href={verified ? '/' : '/onboarding'} className="wordmark" style={{ padding: 0 }}><span className="branddot" />YOUNGO Hub</A>
          <div className="rowGap">
            {verified && <A href="/search" className="btn btn-ghost btn-sm" aria-label="Search"><Search size={20} strokeWidth={1.75} aria-hidden /></A>}
          </div>
        </header>
        {!verified && (
          <div className="liveBanner" style={{ background: 'var(--warn-tint)', borderColor: 'color-mix(in srgb, var(--warn) 35%, transparent)' }}>
            <span className="liveDot" style={{ background: 'var(--warn)' }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 500, fontSize: 14 }}>Complete the membership course to unlock the platform</p>
            </div>
            <A href="/onboarding/course" className="btn btn-primary btn-sm">Course</A>
          </div>
        )}
        {path.startsWith('/cp') && <div className="workspaceContext workspaceContext-wg"><Briefcase size={16} aria-hidden />WG Contact Point workspace</div>}
        {path.startsWith('/team/membership') && <div className="workspaceContext workspaceContext-membership"><ClipboardCheck size={16} aria-hidden />Membership Team workspace</div>}
        {path.startsWith('/team/gys') && <div className="workspaceContext workspaceContext-gys"><PenTool size={16} aria-hidden />Global Youth Statement Policy workspace</div>}
        {children}
      </div>

      {sheet && (
        <div className="sheet" role="menu" aria-label="More navigation">
          {more.map(({ href, label, icon: Icon }) => (
            <A key={href} href={href} className="navItem" role="menuitem">
              <Icon size={18} strokeWidth={1.75} aria-hidden />{label}
            </A>
          ))}
        </div>
      )}

      <CommandPalette />

      <nav className="tabbar" aria-label="Primary mobile">
        {tabs.map(({ href, label, icon: Icon }) => (
          <button key={href} className={`tab ${isActive(path, href) ? 'active' : ''}`} onClick={() => navigate(href)}>
            <Icon size={22} strokeWidth={1.75} aria-hidden />{label}
          </button>
        ))}
        {verified && (
          <button className={`tab ${sheet ? 'active' : ''}`} onClick={() => setSheet((s) => !s)}>
            <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden />More
          </button>
        )}
      </nav>
    </div>
  )
}
