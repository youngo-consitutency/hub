// one registry for every member page: the sidebar, the mobile bar, the command
// palette, the home cards and the route guards all read from here, so they
// can't drift apart. it only shapes the interface; the api enforces permissions
import type { ComponentType } from 'react'
import type { AnyValue } from './types'
import { canManageGroup, canManageGroups } from './groupPermissions'
import { mailReach } from '../../shared/mailReach'
import {
  TbHome as Home,
  TbCalendar as CalendarDays,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbMapPin as MapPin,
  TbUsers as Users,
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
  TbMailForward as MailForward,
  TbPlugConnected as PlugConnected,
  TbWorldSearch as WorldSearch,
} from 'react-icons/tb'

// what the signed-in account can do, flattened once from account.access
export interface Viewer {
  signedIn: boolean
  verified: boolean
  teamRoles: string[]
  capabilities: string[]
  isFocalPoint: boolean
  ngo: boolean
  canManageAccounts: boolean
  canManageGroups: boolean
  canDraftMail: boolean
}

export function viewerOf(account: AnyValue): Viewer {
  const access = account?.access || {}
  const capabilities: string[] = access.capabilities || []
  return {
    signedIn: Boolean(account),
    verified: Boolean(account?.isVerified),
    teamRoles: access.teamRoles || account?.teamRoles || [],
    capabilities,
    isFocalPoint: Boolean(access.isFocalPoint),
    ngo: Boolean(access.ngo),
    canManageAccounts: Boolean(access.canAdminister) || capabilities.includes('accounts.manage'),
    canManageGroups: canManageGroups(account),
    canDraftMail: mailReach({ capabilities }).canDraft,
  }
}

// sidebar sections, in display order, grouped by who uses them
export const GROUPS = [
  { id: 'home', label: '' },
  { id: 'explore', label: 'Explore' },
  { id: 'people', label: 'People & groups' },
  { id: 'work', label: 'Work & decisions' },
  { id: 'mandates', label: 'Your responsibilities' },
  { id: 'teams', label: 'Teams' },
  { id: 'operate', label: 'Operate the Hub' },
] as const

export type GroupId = (typeof GROUPS)[number]['id']

export interface HubRoute {
  href: string
  label: string
  group: GroupId
  icon: ComponentType<AnyValue>
  // who sees it; defaults to verified members
  allow?: (viewer: Viewer, path: string) => boolean
  // guarded routes show this screen to anyone `allow` rejects
  locked?: { title: string; body: string }
  // command palette entry; omitted routes don't appear there
  palette?: { line: string; keywords: string }
  // position in the mobile bottom bar, unique across routes
  mobile?: { order: number; label?: string }
  // one line for the home page's responsibility card
  summary?: string
}

const teamRole = (role: string) => (viewer: Viewer) => viewer.teamRoles.includes(role)

export const ROUTES: HubRoute[] = [
  // before the course is passed only these two are reachable; signed-out
  // visitors (on the public negotiations page) get neither
  {
    href: '/onboarding',
    label: 'Onboarding',
    group: 'explore',
    icon: GraduationCap,
    allow: (viewer) => viewer.signedIn && !viewer.verified,
    mobile: { order: 1 },
  },
  {
    href: '/resources',
    label: 'Resources',
    group: 'explore',
    icon: Library,
    allow: (viewer) => viewer.signedIn && !viewer.verified,
    mobile: { order: 2 },
  },

  { href: '/', label: 'Home', group: 'home', icon: Home, mobile: { order: 5 } },
  {
    href: '/calendar',
    label: 'Calendar',
    group: 'explore',
    icon: CalendarDays,
    palette: {
      line: 'Meetings and constituency events',
      keywords: 'calendar meetings events schedule',
    },
    mobile: { order: 3 },
  },
  { href: '/coys', label: 'COY tracker', group: 'explore', icon: MapPin },
  {
    href: '/opportunities',
    label: 'Opportunities',
    group: 'explore',
    icon: Megaphone,
    palette: {
      line: 'Events, workshops and open calls from organisations',
      keywords: 'ngo opportunity workshop hackathon open call training',
    },
    mobile: { order: 4, label: 'Calls' },
  },
  { href: '/resources', label: 'Resources', group: 'explore', icon: Library },

  {
    href: '/groups',
    label: 'Groups',
    group: 'people',
    icon: Users,
    palette: { line: 'Find a group and its onboarding', keywords: 'working groups wg' },
    mobile: { order: 6 },
  },
  {
    href: '/directory/people',
    label: 'Directory',
    group: 'people',
    icon: UserCircle,
    palette: {
      line: 'Find people by working group, skills and interests',
      keywords: 'members community people directory skills',
    },
  },

  {
    href: '/work',
    label: 'Tasks',
    group: 'work',
    icon: ClipboardCheck,
    palette: {
      line: 'Tasks, owners, deadlines and follow-up',
      keywords: 'tasks work follow-up owners deadlines',
    },
  },
  { href: '/council', label: 'Decisions', group: 'work', icon: Gavel },
  {
    href: '/negotiations',
    label: 'Negotiations',
    group: 'work',
    icon: WorldSearch,
    // public page: signed-out visitors reach it too, so keep it in view there
    allow: (viewer, path) => viewer.verified || path.startsWith('/negotiations'),
  },
  { href: '/submissions', label: 'Policy & statements', group: 'work', icon: FileText },

  {
    href: '/cp',
    label: 'WG Contact Point',
    group: 'mandates',
    icon: Briefcase,
    summary: 'Manage your working groups, calls, channels, and member access.',
    allow: (viewer) => viewer.canManageGroups,
    locked: {
      title: 'WG Contact Points only',
      body: 'A current Working Group Contact Point mandate must be recorded for your account.',
    },
  },
  {
    href: '/focal',
    label: 'Global Focal Point',
    group: 'mandates',
    icon: Network,
    summary: 'Coordinate constituency-wide mandates and UNFCCC-facing work.',
    allow: (viewer) => viewer.isFocalPoint,
    locked: { title: 'Focal Points only', body: 'This workspace is for the Global Focal Points.' },
  },
  {
    href: '/mail',
    label: 'Mail Desk',
    group: 'mandates',
    icon: MailForward,
    summary: 'Draft mail to the people your mandate reaches.',
    allow: (viewer) => viewer.canDraftMail,
  },
  {
    href: '/account/agent',
    label: 'Agent connector',
    group: 'mandates',
    icon: PlugConnected,
    summary: 'Connect a personal agent to the Hub.',
    // mirrors the gateway's eligibility; the page explains any closed gate
    allow: (viewer) =>
      viewer.capabilities.some((cap) => cap.startsWith('wg.manage')) ||
      viewer.capabilities.includes('accounts.manage') ||
      viewer.isFocalPoint,
  },
  {
    href: '/ngo',
    label: 'NGO platform',
    group: 'mandates',
    icon: Building2,
    allow: (viewer) => viewer.ngo,
    summary: 'Manage organisation participation and representatives.',
    locked: {
      title: 'NGO access required',
      body: 'An approved organisation seat is required. You can also accept a seat invite.',
    },
  },

  {
    href: '/platform/partnerships',
    label: 'Partnerships',
    group: 'teams',
    icon: Building2,
    summary: 'Track partnership requests and organisations.',
    allow: teamRole('partnerships'),
  },
  {
    href: '/team/membership',
    label: 'Membership Team',
    group: 'teams',
    icon: ClipboardCheck,
    summary: 'Review membership and onboarding work.',
    allow: teamRole('membership_team'),
    locked: {
      title: 'Membership Team only',
      body: 'Ask an admin to add this team responsibility to your account.',
    },
  },
  {
    href: '/team/gys',
    label: 'GYS Policy Team',
    group: 'teams',
    icon: PenTool,
    summary: 'Coordinate Global Youth Statement drafting.',
    allow: teamRole('gys_policy_team'),
    locked: {
      title: 'GYS Policy Team only',
      body: 'Ask an admin to add this team responsibility to your account.',
    },
  },
  {
    href: '/staff/content',
    label: 'Content studio',
    group: 'teams',
    icon: FilePenLine,
    summary: 'Draft, review, and publish Hub content.',
    allow: (viewer) =>
      viewer.capabilities.includes('content.draft') ||
      viewer.capabilities.includes('content.review'),
    locked: {
      title: 'Website permission required',
      body: 'Ask a platform administrator to record your approved website drafting or publishing access.',
    },
  },
  {
    href: '/staff/review',
    label: 'Review queue',
    group: 'teams',
    icon: ClipboardCheck,
    summary: 'Review reported feedback and organisation postings.',
    allow: (viewer) => viewer.canManageAccounts || viewer.teamRoles.includes('membership_team'),
    locked: {
      title: 'Review team only',
      body: 'Feedback and posting review are available to platform operators and the Membership Team.',
    },
  },

  {
    href: '/admin',
    label: 'Admin',
    group: 'operate',
    icon: Shield,
    summary: 'Manage system-wide access and operations.',
    allow: (viewer) => viewer.canManageAccounts,
    locked: {
      title: 'Admin only',
      body: 'This workspace requires platform administration access.',
    },
  },
]

const allowed = (route: HubRoute, viewer: Viewer, path: string) =>
  route.allow ? route.allow(viewer, path) : viewer.verified

export interface NavItem {
  href: string
  label: string
  icon: ComponentType<AnyValue>
}

// sidebar sections for this viewer, empty sections dropped
export function navFor(viewer: Viewer, path: string) {
  return GROUPS.map((group) => ({
    section: group.label,
    items: ROUTES.filter((route) => route.group === group.id && allowed(route, viewer, path)).map(
      ({ href, label, icon }): NavItem => ({ href, label, icon }),
    ),
  })).filter((group) => group.items.length > 0)
}

// home page cards: the mandate, team and operator pages this viewer holds
export function responsibilitiesFor(viewer: Viewer) {
  return ROUTES.filter(
    (route) => ['mandates', 'teams', 'operate'].includes(route.group) && allowed(route, viewer, ''),
  )
}

export interface MobileTab extends NavItem {
  mobileLabel?: string
}

// the bottom tab bar on phones: the viewer's routes that opt in, in order
export function mobileNavFor(viewer: Viewer, path: string): MobileTab[] {
  const tabs: MobileTab[] = ROUTES.filter((route) => route.mobile && allowed(route, viewer, path))
    .sort((a, b) => a.mobile!.order - b.mobile!.order)
    .map(({ href, label, icon, mobile }) => ({ href, label, mobileLabel: mobile?.label, icon }))
  // profile always closes the bar for members; it has no sidebar entry
  return viewer.verified
    ? [...tabs, { href: '/profile', label: 'Profile', icon: UserCircle }]
    : tabs
}

// palette shortcuts for the pages this viewer can open
export function paletteRoutesFor(viewer: Viewer) {
  return ROUTES.filter((route) => route.palette && allowed(route, viewer, ''))
}

// the guard for a path: the most specific route with a locked screen
function guardFor(path: string) {
  return ROUTES.filter(
    (route) => route.locked && (path === route.href || path.startsWith(`${route.href}/`)),
  ).sort((a, b) => b.href.length - a.href.length)[0]
}

// shown on guarded pages while access loads
export const CHECKING_ACCESS = {
  title: 'Checking your access…',
  body: 'This page opens once your access has loaded.',
  busy: true,
} as const

// shown on guarded pages when the access request failed
export const ACCESS_FAILED = {
  title: 'Access not confirmed',
  body: 'We could not confirm your access. Check your connection and retry.',
  retry: true,
} as const

// the locked screen this account would see on `path`, or null
export function lockFor(path: string, account: AnyValue) {
  // no account means no roles: every guarded page locks
  const viewer = viewerOf(account)
  // anyone signed in may open a seat invite before holding a seat
  if (path.startsWith('/ngo/accept')) return null
  // a contact point only manages the groups they hold a mandate for
  const lock = path.startsWith('/cp/')
    ? canManageGroup(account, path.split('/')[2])
      ? null
      : {
          title: 'WG Contact Points only',
          body: 'A current Contact Point assignment for this working group is required.',
        }
    : (() => {
        const route = guardFor(path)
        return route && !allowed(route, viewer, path) ? route.locked! : null
      })()
  // guarded pages open only on explicit access: stay locked while it loads, retry if it failed
  if (lock && account && !account.access)
    return account.accessFailed ? ACCESS_FAILED : CHECKING_ACCESS
  return lock
}
