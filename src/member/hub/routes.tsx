import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import type { AnyValue } from '../lib/types'

// The Hub's pages, matched against the app path in the hash (/hub#/calendar/x).
// One table replaces the old per-folder route files; pages load on demand.
type Props = Record<string, string>
type Loader = () => Promise<ComponentType<AnyValue>>

export type HubRoute =
  | { kind: 'page'; pattern: RegExp; keys: string[]; Page: ComponentType<AnyValue>; fixed?: Props }
  | { kind: 'redirect'; pattern: RegExp; keys: string[]; to: string }

const compile = (path: string) => {
  const keys: string[] = []
  const source = path.replace(/:(\w+)/g, (_, key: string) => {
    keys.push(key)
    return '([^/]+)'
  })
  return { pattern: new RegExp(`^${source}$`), keys }
}

const page = (path: string, load: Loader, fixed?: Props): HubRoute => ({
  kind: 'page',
  ...compile(path),
  Page: dynamic(load),
  fixed,
})

// a list and its side panel are one page: /groups and /groups/:slug share a component, so filters and
// scroll survive opening and closing the panel (two separate dynamic() components would remount)
const withPanel = (path: string, load: Loader): HubRoute[] => {
  const Page = dynamic(load)
  return [path, `${path}/:slug`].map((pattern) => ({ kind: 'page', ...compile(pattern), Page }))
}

// `to` may name the path's own :params, e.g. redirect('/a/:id/b', '/a/:id')
const redirect = (path: string, to: string): HubRoute => ({
  kind: 'redirect',
  ...compile(path),
  to,
})

// named exports, so each entry picks its component out of the page module
const from =
  <M extends Record<string, ComponentType<AnyValue>>>(load: () => Promise<M>, name: keyof M) =>
  async () =>
    (await load())[name]

// static paths come before the dynamic ones that would also match them
export const HUB_ROUTES: HubRoute[] = [
  page(
    '/',
    from(() => import('../pages/Home'), 'Home'),
  ),
  page(
    '/account/agent',
    from(() => import('../pages/AgentConnect'), 'AgentConnect'),
  ),
  page(
    '/admin',
    from(() => import('../pages/Admin'), 'Admin'),
  ),
  page(
    '/book',
    from(() => import('../pages/CpCallBook'), 'CpCallBook'),
  ),
  ...withPanel(
    '/calendar',
    from(() => import('../pages/Calendar'), 'Calendar'),
  ),
  ...withPanel(
    '/council',
    from(() => import('../features/platform/Platform'), 'Decisions'),
  ),
  ...withPanel(
    '/coys',
    from(() => import('../pages/Coys'), 'Coys'),
  ),
  page(
    '/cp',
    from(() => import('../pages/CpOverview'), 'CpOverview'),
  ),
  page(
    '/cp/:slug',
    from(() => import('../pages/CpManage'), 'CpManage'),
  ),
  page(
    '/directory',
    from(() => import('../pages/Directory'), 'Directory'),
  ),
  page(
    '/directory/people',
    from(() => import('../pages/Directory'), 'Members'),
  ),
  page(
    '/focal',
    from(() => import('../pages/FocalPoint'), 'FocalPoint'),
  ),
  ...withPanel(
    '/groups',
    from(() => import('../pages/Groups'), 'Groups'),
  ),
  // task forces are cards in the group panel now; their old pages land on the group
  redirect('/groups/:slug/:extra', '/groups/:slug'),
  page(
    '/gys',
    from(() => import('../pages/Statement'), 'Statement'),
  ),
  page(
    '/help',
    from(() => import('../pages/Help'), 'Help'),
  ),
  page(
    '/mail',
    from(() => import('../pages/MailDesk'), 'MailDesk'),
  ),
  page(
    '/membership/appeal',
    from(() => import('../pages/MembershipAppeal'), 'MembershipAppeal'),
  ),
  page(
    '/negotiations',
    from(() => import('../pages/Negotiations'), 'Negotiations'),
  ),
  page(
    '/negotiations/:slug',
    from(() => import('../pages/NegotiationDetail'), 'NegotiationDetail'),
  ),
  page(
    '/ngo',
    from(() => import('../pages/NgoPortal'), 'NgoPortal'),
  ),
  page(
    '/ngo/accept',
    from(() => import('../pages/NgoPortal'), 'NgoPortal'),
  ),
  page(
    '/onboarding',
    from(() => import('../pages/Onboarding'), 'Onboarding'),
  ),
  page(
    '/onboarding/course',
    from(() => import('../pages/Course'), 'Course'),
  ),
  ...withPanel(
    '/opportunities',
    from(() => import('../pages/Opportunities'), 'Opportunities'),
  ),
  page(
    '/platform',
    from(() => import('../features/platform/Platform'), 'Platform'),
  ),
  page(
    '/platform/partnerships',
    from(() => import('../features/platform/Platform'), 'Platform'),
    {
      slug: 'partnerships',
    },
  ),
  page(
    '/platform/people',
    from(() => import('./PeopleRedirect'), 'PeopleRedirect'),
  ),
  page(
    '/profile',
    from(() => import('../pages/Profile'), 'Profile'),
  ),
  page(
    '/resources',
    from(() => import('../pages/Resources'), 'Resources'),
  ),
  page(
    '/resources/issues',
    from(() => import('../pages/ResourceIssues'), 'ResourceIssues'),
  ),
  page(
    '/search',
    from(() => import('../pages/Search'), 'Search'),
  ),
  page(
    '/staff/content',
    from(() => import('../pages/ContentWorkspace'), 'ContentWorkspace'),
  ),
  page(
    '/staff/review',
    from(() => import('../pages/ReviewQueue'), 'ReviewQueue'),
  ),
  page(
    '/staff/review/opportunities',
    from(() => import('../pages/ReviewQueue'), 'ReviewQueue'),
    {
      slug: 'opportunities',
    },
  ),
  page(
    '/submissions/amendments/new',
    from(() => import('../pages/AmendmentProposal'), 'AmendmentProposal'),
  ),
  page(
    '/submissions/new',
    from(() => import('../pages/SubmissionProposal'), 'SubmissionProposal'),
  ),
  page(
    '/submissions/workspace',
    from(() => import('../pages/SubmissionWorkspace'), 'SubmissionWorkspace'),
  ),
  page(
    '/submissions/workspace/:slug',
    from(() => import('../pages/SubmissionWorkspace'), 'SubmissionWorkspace'),
  ),
  ...withPanel(
    '/submissions',
    from(() => import('../pages/Submissions'), 'Submissions'),
  ),
  page(
    '/team/gys',
    from(() => import('../pages/GysPolicyTeam'), 'GysPolicyTeam'),
  ),
  page(
    '/team/membership',
    from(() => import('../pages/MembershipTeam'), 'MembershipTeam'),
  ),
  page(
    '/team/membership/renewals',
    from(() => import('../features/platform/MembershipLifecycle'), 'MembershipLifecycle'),
  ),
  page(
    '/work',
    from(() => import('../features/platform/Platform'), 'Work'),
  ),
  page(
    '/workspace/:slug',
    from(() => import('../pages/Workspace'), 'Workspace'),
  ),
  // retired paths keep working
  redirect('/intelligence', '/search'),
  redirect('/library', '/resources?view=guides'),
  redirect('/recognition', '/work'),
  redirect('/staff/points', '/work'),
]

export type HubMatch =
  { kind: 'page'; Page: ComponentType<AnyValue>; props: Props } | { kind: 'redirect'; to: string }

export function matchHubRoute(path: string): HubMatch | null {
  for (const route of HUB_ROUTES) {
    const found = route.pattern.exec(path)
    if (!found) continue
    if (route.kind === 'redirect') {
      const params = Object.fromEntries(
        route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]),
      )
      return { kind: 'redirect', to: route.to.replace(/:(\w+)/g, (_, key) => params[key] ?? '') }
    }
    const params = Object.fromEntries(
      route.keys.map((key, i) => [key, decodeURIComponent(found[i + 1])]),
    )
    return { kind: 'page', Page: route.Page, props: { ...params, ...route.fixed } }
  }
  return null
}
