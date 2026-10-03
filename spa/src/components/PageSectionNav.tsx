import {
  TbUsers,
  TbAt,
  TbUsersGroup,
  TbSitemap,
  TbFileText,
  TbWorld,
  TbUserCheck,
  TbRefresh,
  TbMessages,
  TbSpeakerphone,
} from 'react-icons/tb'
import { A } from './ui'
import { usePath } from '../lib/router'
import { PAGE_SECTIONS, pageSectionFor } from '../lib/pageSections'

const SECTION_ICONS = {
  '/directory/people': TbUsers,
  '/directory': TbAt,
  '/groups': TbUsersGroup,
  '/platform': TbSitemap,
  '/submissions': TbFileText,
  '/gys': TbWorld,
  '/team/membership': TbUserCheck,
  '/team/membership/renewals': TbRefresh,
  '/staff/review': TbMessages,
  '/staff/review/opportunities': TbSpeakerphone,
}

export function PageSectionNav({ section }: any) {
  const path = usePath()
  const current = pageSectionFor(path)
  const { label, items } = (PAGE_SECTIONS as any)[section]
  return (
    <nav className="pageSectionNav" aria-label={label}>
      {items.map(({ href, label }: any) => {
        const Icon = (SECTION_ICONS as any)[href]
        return (
          <A
            key={href}
            href={href}
            className={`pageSectionLink ${current?.href === href ? 'active' : ''}`}
            aria-current={current?.href === href ? 'page' : undefined}
          >
            {Icon && <Icon size={17} strokeWidth={1.75} aria-hidden="true" />}
            {label}
          </A>
        )
      })}
    </nav>
  )
}
