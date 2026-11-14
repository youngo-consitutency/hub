interface AddToCalendarProps {
  event?: AnyValue
  className?: string
}

import type { AnyValue } from '../lib/types'
import {
  TbCalendarPlus as CalendarPlus,
  TbChevronDown as ChevronDown,
  TbDownload as Download,
} from 'react-icons/tb'
import { DestinationIcon } from './DestinationLink'
import { PopoverButton } from './PopoverButton'
import {
  googleCalendarUrl,
  icsDownloadPath,
  outlookOfficeUrl,
  outlookWebUrl,
} from '../lib/calendarLinks'

/**
 * Calendar actions for Google, Outlook, Microsoft 365, and ICS downloads.
 */
export function AddToCalendar({ event, className = 'btn btn-secondary' }: AddToCalendarProps) {
  if (!event?.startsAt || !event?.endsAt) return null
  const links = [
    { href: googleCalendarUrl(event), label: 'Google Calendar', external: true },
    { href: outlookWebUrl(event), label: 'Outlook.com', external: true },
    { href: outlookOfficeUrl(event), label: 'Outlook 365', external: true },
  ]
  return (
    <PopoverButton
      label="Add to calendar"
      buttonClassName={className}
      panelClassName="min-w-60 w-max max-w-[300px] gap-1 p-2.5"
      buttonContent={
        <>
          <CalendarPlus size={18} strokeWidth={1.75} aria-hidden />
          Add to calendar
          <ChevronDown size={14} strokeWidth={1.75} aria-hidden className="opacity-70" />
        </>
      }
    >
      {(close) => (
        <>
          <p className="metaMuted mb-1">
            Adds this call to your calendar. The Hub does not ask for Google account access. For
            every Hub call, use Subscribe on Calendar.
          </p>
          {links.map(({ href, label, external }) => (
            <a
              key={label}
              className="addCalItem"
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              onClick={close}
            >
              <DestinationIcon url={href} size={17} />
              {label}
            </a>
          ))}
          {event.slug && (
            <a className="addCalItem" href={icsDownloadPath(event.slug)} onClick={close}>
              <Download size={16} strokeWidth={1.75} aria-hidden />
              Apple / other (.ics file)
            </a>
          )}
        </>
      )}
    </PopoverButton>
  )
}
