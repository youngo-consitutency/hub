import type { AnyValue } from './types'
// Combine only close pairs; keep the other member destinations directly visible.
export const PAGE_SECTIONS = {
  people: {
    label: 'People & contacts',
    href: '/directory/people',
    items: [
      { href: '/directory/people', label: 'Members' },
      { href: '/directory', label: 'Contacts' },
    ],
  },
  groups: {
    label: 'Groups & mandates',
    href: '/groups',
    items: [
      { href: '/groups', label: 'Working groups' },
      { href: '/platform', label: 'Bodies & mandates' },
    ],
  },
  policy: {
    label: 'Policy & statements',
    href: '/submissions',
    items: [
      { href: '/submissions', label: 'Submissions' },
      { href: '/gys', label: 'Youth Statement' },
    ],
  },
  membership: {
    label: 'Membership Team',
    href: '/team/membership',
    items: [
      { href: '/team/membership', label: 'Applications' },
      { href: '/team/membership/renewals', label: 'Onboarding & renewal' },
    ],
  },
  review: {
    label: 'Review queue',
    href: '/staff/review',
    items: [
      { href: '/staff/review', label: 'Member feedback' },
      { href: '/staff/review/opportunities', label: 'Organisation postings' },
    ],
  },
}

const matches = (path: AnyValue, href: AnyValue) => path === href || path.startsWith(`${href}/`)

export function pageSectionFor(path: AnyValue) {
  if (matches(path, '/platform/partnerships')) return null
  return (
    Object.entries(PAGE_SECTIONS)
      .flatMap(([section, { items }]) => items.map((item) => ({ section, ...item })))
      .filter((item) => matches(path, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0] || null
  )
}

export function navigationActive(path: AnyValue, href: AnyValue) {
  const current = pageSectionFor(path)
  if (current && (PAGE_SECTIONS as AnyValue)[current.section].href === href) return true
  if (['/', '/directory', '/platform'].includes(href)) return path === href
  return matches(path, href)
}
