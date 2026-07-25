import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, BackLink, StatusChip, A } from '../components/ui.jsx'
import { AddToCalendar } from '../components/AddToCalendar.jsx'
import { fmtDual } from '../lib/time.js'
import {
  Video,
  Users,
  Landmark,
  CalendarDays,
  Link2,
  Check,
  Play,
} from 'lucide-react'

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn btn-secondary"
      onClick={() => {
        navigator.clipboard?.writeText(window.location.href).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        })
      }}
    >
      {copied ? (
        <Check size={16} strokeWidth={1.75} aria-hidden />
      ) : (
        <Link2 size={16} strokeWidth={1.75} aria-hidden />
      )}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

const EVENT_ICON = {
  constituency_call: Video,
  wg_call: Video,
  wgf: Users,
  unfccc_session: Landmark,
  webinar: CalendarDays,
  coordination: Users,
}
const TYPE_LABEL = {
  constituency_call: 'Constituency call',
  wg_call: 'Working group call',
  wgf: 'WG forum',
  unfccc_session: 'UNFCCC session',
  webinar: 'Webinar',
  coordination: 'Coordination',
}

// live → concluded → upcoming, so a past event drops the Join button per spec §2.
function phaseOf(event) {
  const now = Date.now()
  if (now >= new Date(event.startsAt) && now <= new Date(event.endsAt))
    return 'live'
  if (now > new Date(event.endsAt)) return 'concluded'
  return 'upcoming'
}

export function EventDetail({ slug }) {
  const query = useApi(`/events/${slug}`)
  return (
    <div>
      <BackLink href="/calendar">Calendar</BackLink>
      <Async query={query}>
        {(event) => {
          const Icon = EVENT_ICON[event.type] || CalendarDays
          const phase = phaseOf(event)
          const live = phase === 'live'
          const concluded = phase === 'concluded'
          return (
            <>
              <div className="rowGap" style={{ marginTop: 8 }}>
                <span className="eventIcon">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                {live && <StatusChip status="live_now" />}
                {concluded && (
                  <span className="chip chip-neutral">Concluded</span>
                )}
                {phase === 'upcoming' && (
                  <span className="chip chip-neutral">
                    {TYPE_LABEL[event.type] || event.type}
                  </span>
                )}
              </div>
              <h1 style={{ marginTop: 10 }}>{event.title}</h1>
              <p
                className="mono detailHero"
                style={{ color: live ? 'var(--live)' : 'var(--text-2)' }}
              >
                {fmtDual(event.startsAt)}
              </p>
              {event.wg && (
                <p className="meta" style={{ marginTop: 4 }}>
                  Hosted by{' '}
                  <A href={`/groups/${event.wg.slug}`} className="inlineLink">
                    {event.wg.name} WG
                  </A>
                </p>
              )}

              {event.description && (
                <p className="meta" style={{ marginTop: 16, maxWidth: 560 }}>
                  {event.description}
                </p>
              )}

              <div className="detailActions">
                {concluded
                  ? event.recordingUrl && (
                      <a
                        className="btn btn-primary"
                        href={event.recordingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Play size={18} strokeWidth={1.75} aria-hidden />
                        Watch recording
                      </a>
                    )
                  : event.meetingUrl && (
                      <a
                        className={`btn ${live ? 'btn-primary btn-glow' : 'btn-primary'}`}
                        href={event.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Video size={18} strokeWidth={1.75} aria-hidden />
                        {live ? 'Join meeting — live now' : 'Join meeting'}
                      </a>
                    )}
                {!concluded && <AddToCalendar event={event} />}
                <CopyLinkButton />
              </div>
            </>
          )
        }}
      </Async>
    </div>
  )
}
