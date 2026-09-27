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
import { A } from './ui.jsx'
import { usePath } from '../lib/router.js'
import { PAGE_SECTIONS, pageSectionFor } from '../lib/pageSections.js'

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

export function PageSectionNav({ section }) {
  const path = usePath()
  const current = pageSectionFor(path)
  const { label, items } = PAGE_SECTIONS[section]
  return (
    <nav className="pageSectionNav" aria-label={label}>
      {items.map(({ href, label }) => {
        const Icon = SECTION_ICONS[href]
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
