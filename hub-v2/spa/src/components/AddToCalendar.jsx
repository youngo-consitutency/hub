import { useEffect, useId, useRef, useState } from 'react'
import {
  TbCalendarPlus as CalendarPlus,
  TbChevronDown as ChevronDown,
  TbDownload as Download,
} from 'react-icons/tb'
import { DestinationIcon } from './DestinationLink.jsx'
import {
  googleCalendarUrl,
  icsDownloadPath,
  outlookOfficeUrl,
  outlookWebUrl,
} from '../lib/calendarLinks.js'

/**
 * Calendar actions for Google, Outlook, Microsoft 365, and ICS downloads.
 */
export function AddToCalendar({ event, className = 'btn btn-secondary' }) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!event?.startsAt || !event?.endsAt) return null

  return (
    <div className="addCalWrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${className}${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarPlus size={18} strokeWidth={1.75} aria-hidden />
        Add to calendar
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          aria-hidden
          style={{ opacity: 0.7 }}
        />
      </button>
      {open && (
        <div className="addCalPanel card" id={panelId}>
          <p className="metaMuted" style={{ marginBottom: 4 }}>
            Adds this call to your calendar. The Hub does not ask for Google
            account access. For every Hub call, use Subscribe on Calendar.
          </p>
          <a
            className="addCalItem"
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <DestinationIcon url={googleCalendarUrl(event)} size={17} />
            Google Calendar
          </a>
          <a
            className="addCalItem"
            href={outlookWebUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <DestinationIcon url={outlookWebUrl(event)} size={17} />
            Outlook.com
          </a>
          <a
            className="addCalItem"
            href={outlookOfficeUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <DestinationIcon url={outlookOfficeUrl(event)} size={17} />
            Outlook 365
          </a>
          {event.slug && (
            <a
              className="addCalItem"
              href={icsDownloadPath(event.slug)}
              onClick={() => setOpen(false)}
            >
              <Download size={16} strokeWidth={1.75} aria-hidden />
              Apple / other (.ics file)
            </a>
          )}
        </div>
      )}
    </div>
  )
}
