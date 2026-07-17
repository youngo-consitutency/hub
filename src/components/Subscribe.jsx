import { useState } from 'react'
import { CalendarPlus, Check, Copy } from 'lucide-react'

// Copies the absolute ICS feed URL so a calendar app can subscribe (live feed),
// rather than downloading a one-time snapshot.
export function CopyFeedButton({ path, label = 'Copy feed URL', className = 'btn btn-secondary btn-sm' }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={className}
      onClick={() => {
        const url = window.location.origin + path
        navigator.clipboard?.writeText(url).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? <Check size={16} strokeWidth={1.75} aria-hidden /> : <Copy size={16} strokeWidth={1.75} aria-hidden />}
      {copied ? 'Copied' : label}
    </button>
  )
}

// Calendar "Subscribe" control: toggles a panel of feed URLs (all + current filter),
// with a one-line how-to. Per 03 §2.
export function CalendarSubscribe({ type }) {
  const [open, setOpen] = useState(false)
  const filtered = type && type !== 'all'
  return (
    <div className="subscribeWrap">
      <button className={`btn btn-secondary btn-sm ${open ? 'active' : ''}`} onClick={() => setOpen((o) => !o)}>
        <CalendarPlus size={16} strokeWidth={1.75} aria-hidden />Subscribe
      </button>
      {open && (
        <div className="subscribePanel card">
          <div className="rowBetween">
            <span className="meta">All events</span>
            <CopyFeedButton path="/ics/all.ics" className="btn btn-ghost btn-sm" />
          </div>
          {filtered && (
            <div className="rowBetween">
              <span className="meta">This filter only</span>
              <CopyFeedButton path={`/ics/type/${type}.ics`} className="btn btn-ghost btn-sm" />
            </div>
          )}
          <p className="metaMuted">Paste the URL into Google Calendar → “Other calendars” → “From URL”. Per-working-group feeds live on each group’s page.</p>
        </div>
      )}
    </div>
  )
}
