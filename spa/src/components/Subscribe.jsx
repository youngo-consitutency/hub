import { useEffect, useId, useRef, useState } from 'react'
import {
  TbCalendarPlus as CalendarPlus,
  TbCheck as Check,
  TbCopy as Copy,
  TbExternalLink as ExternalLink,
} from 'react-icons/tb'
import { googleAddByUrlPage, googleSubscribeUrl, webcalFeedUrl } from '../lib/calendarLinks.js'

// Copies the absolute ICS feed URL so a calendar app can subscribe (live feed),
// rather than downloading a one-time snapshot.
export function CopyFeedButton({
  path,
  label = 'Copy feed URL',
  className = 'btn btn-secondary btn-sm',
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const url = window.location.origin + path
        navigator.clipboard?.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? (
        <Check size={16} strokeWidth={1.75} aria-hidden />
      ) : (
        <Copy size={16} strokeWidth={1.75} aria-hidden />
      )}
      {copied ? 'Copied' : label}
    </button>
  )
}

function FeedRow({ label, path }) {
  return (
    <div className="subscribeFeedRow">
      <span className="meta" style={{ minWidth: 0, flex: 1 }}>
        {label}
      </span>
      <div className="subscribeFeedActions">
        <CopyFeedButton path={path} className="btn btn-ghost btn-sm" />
        <a
          className="btn btn-ghost btn-sm"
          href={webcalFeedUrl(path)}
          title="Open in Apple Calendar / apps that support webcal"
        >
          Open in Apple
        </a>
      </div>
    </div>
  )
}

// Calendar "Subscribe" control: live feeds + one-click helper links.
export function CalendarSubscribe({ type }) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const filtered = type && type !== 'all'

  useEffect(() => {
    if (!open) return undefined
    const dismissOnOutsideClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const dismissOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', dismissOnOutsideClick)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('mousedown', dismissOnOutsideClick)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [open])

  return (
    <div className="subscribeWrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`btn btn-secondary btn-sm ${open ? 'active' : ''}`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
        Subscribe
      </button>
      {open && (
        <div className="subscribePanel card" id={panelId}>
          <div className="subscribeHeader">
            <CalendarPlus size={18} strokeWidth={1.75} aria-hidden />
            <div>
              <h3>Live calendar feed</h3>
              <p className="meta">
                Subscribe once. New Hub events update automatically. Google never signs in to the
                Hub — you add our public ICS URL to your own calendar.
              </p>
            </div>
          </div>
          <a
            className="btn btn-primary btn-sm subscribeGoogle"
            href={googleSubscribeUrl('/ics/all.ics')}
            target="_blank"
            rel="noopener noreferrer"
          >
            Add live feed to Google Calendar
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
          </a>
          <FeedRow label="All events" path="/ics/all.ics" />
          {filtered && <FeedRow label="This filter only" path={`/ics/type/${type}.ics`} />}
          <ol className="subscribeSteps">
            <li>
              <strong>Google</strong>
              <span>
                Use the button above, or copy the URL and paste it in{' '}
                <a
                  href={googleAddByUrlPage()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inlineLink"
                >
                  Add by URL{' '}
                  <ExternalLink
                    size={12}
                    strokeWidth={1.75}
                    aria-hidden
                    style={{ verticalAlign: -1 }}
                  />
                </a>
                .
              </span>
            </li>
            <li>
              <strong>Apple</strong>
              <span>Choose “Open in Apple” above.</span>
            </li>
            <li>
              <strong>Outlook</strong>
              <span>Copy the URL, then choose “Subscribe from web”.</span>
            </li>
          </ol>
          <p className="metaMuted">Group-specific feeds are on group pages.</p>
        </div>
      )}
    </div>
  )
}
