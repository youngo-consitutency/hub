import { useState } from 'react'
import { CalendarPlus, Check, Copy, ExternalLink } from 'lucide-react'
import { googleAddByUrlPage, webcalFeedUrl } from '../lib/calendarLinks.js'

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
          Apple
        </a>
      </div>
    </div>
  )
}

// Calendar "Subscribe" control: live feeds + one-click helper links.
export function CalendarSubscribe({ type }) {
  const [open, setOpen] = useState(false)
  const filtered = type && type !== 'all'
  return (
    <div className="subscribeWrap">
      <button
        type="button"
        className={`btn btn-secondary btn-sm ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />
        Subscribe
      </button>
      {open && (
        <div className="subscribePanel card">
          <p className="meta" style={{ fontWeight: 500 }}>
            Live calendar feed
          </p>
          <p className="metaMuted">
            Subscribe once — new meetings appear automatically. This is not a
            one-off .ics download.
          </p>
          <FeedRow label="All events" path="/ics/all.ics" />
          {filtered && (
            <FeedRow label="This filter only" path={`/ics/type/${type}.ics`} />
          )}
          <ol className="subscribeSteps meta">
            <li>
              <strong>Google Calendar:</strong> copy the feed URL →{' '}
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
              </a>{' '}
              → paste → Add calendar.
            </li>
            <li>
              <strong>Apple Calendar:</strong> tap <em>Apple</em> above (webcal)
              or File → New Calendar Subscription.
            </li>
            <li>
              <strong>Outlook:</strong> Add calendar → Subscribe from web →
              paste the HTTPS feed URL.
            </li>
          </ol>
          <p className="metaMuted">
            Per-working-group feeds live on each group’s page.
          </p>
        </div>
      )}
    </div>
  )
}
