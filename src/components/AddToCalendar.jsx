import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, ChevronDown, Download, ExternalLink } from 'lucide-react'
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
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!event?.startsAt || !event?.endsAt || !event?.slug) return null

  return (
    <div className="addCalWrap" ref={wrapRef}>
      <button
        type="button"
        className={`${className}${open ? ' active' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
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
        <div className="addCalPanel card" role="menu">
          <p className="metaMuted" style={{ marginBottom: 4 }}>
            Opens your calendar app with this event pre-filled.
          </p>
          <a
            role="menuitem"
            className="addCalItem"
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
            Google Calendar
          </a>
          <a
            role="menuitem"
            className="addCalItem"
            href={outlookWebUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
            Outlook.com
          </a>
          <a
            role="menuitem"
            className="addCalItem"
            href={outlookOfficeUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
          >
            <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
            Outlook 365
          </a>
          <a
            role="menuitem"
            className="addCalItem"
            href={icsDownloadPath(event.slug)}
            onClick={() => setOpen(false)}
          >
            <Download size={16} strokeWidth={1.75} aria-hidden />
            Apple / other (.ics file)
          </a>
        </div>
      )}
    </div>
  )
}
