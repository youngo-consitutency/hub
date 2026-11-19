import type { IconType } from 'react-icons'
import {
  TbAddressBook as AddressBook,
  TbCalendar as CalendarDays,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbGlobe as Globe,
} from 'react-icons/tb'
import type { SearchResponse } from '../../shared/contracts'
import { fmtDateRange, fmtDual } from './time'
import { workingGroupIcon } from './workingGroupIcons'

// The six kinds of direct match shared by the /search page and the command palette, in result order.

/** One direct match, ready to render. */
export interface Match {
  key: string | number
  title: string | undefined
  href: string
  line: string | null | undefined
  Icon: IconType
  /** The section label, for grouping in a flat list. */
  group: string
}

/** One kind of direct match: how its items are titled, linked and iconified. */
export interface DirectSection {
  key: keyof SearchResponse
  label: string
  matches: (data: SearchResponse) => Match[]
}

// each item type is checked against its own kind, then flattened to a Match
function section<K extends keyof SearchResponse>(definition: {
  key: K
  label: string
  title: (item: SearchResponse[K][number]) => string | undefined
  to: (item: SearchResponse[K][number]) => string
  line: (item: SearchResponse[K][number]) => string | null | undefined
  icon: (item: SearchResponse[K][number]) => IconType
}): DirectSection {
  return {
    key: definition.key,
    label: definition.label,
    matches: (data) =>
      data[definition.key].map((item: SearchResponse[K][number], index: number) => ({
        key: (item as { slug?: string }).slug || index,
        title: definition.title(item),
        href: definition.to(item),
        line: definition.line(item),
        Icon: definition.icon(item),
        group: definition.label,
      })),
  }
}

export const DIRECT_SECTIONS: DirectSection[] = [
  section({
    key: 'events',
    label: 'Events',
    title: (event) => event.title,
    to: (event) => `/calendar/${event.slug}`,
    line: (event) => fmtDual(event.startsAt),
    icon: (event) => (event.wg?.slug ? workingGroupIcon(event.wg.slug) : CalendarDays),
  }),
  section({
    key: 'submissions',
    label: 'Submissions',
    title: (submission) => submission.title,
    to: (submission) => `/submissions/${submission.slug}`,
    line: (submission) => submission.wg?.name || submission.status,
    icon: (submission) => (submission.wg?.slug ? workingGroupIcon(submission.wg.slug) : FileText),
  }),
  section({
    key: 'decisions',
    label: 'Council',
    title: (decision) => decision.title,
    to: (decision) => `/council/${decision.slug}`,
    line: (decision) => decision.proposer,
    icon: () => Gavel,
  }),
  section({
    key: 'coys',
    label: 'COYs',
    title: (coy) => coy.title,
    to: (coy) => `/coys/${coy.slug}`,
    line: (coy) => fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc),
    icon: () => Globe,
  }),
  section({
    key: 'groups',
    label: 'Working groups',
    title: (group) => group.name,
    to: (group) => `/groups/${group.slug}`,
    line: (group) => group.focusLine,
    icon: (group) => workingGroupIcon(group.slug),
  }),
  section({
    key: 'contacts',
    label: 'Directory',
    title: (contact) => contact.roleTitle,
    to: () => '/directory',
    line: (contact) => contact.description,
    icon: () => AddressBook,
  }),
]
