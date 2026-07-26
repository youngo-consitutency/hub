import { useState } from 'react'
import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  A,
  PageHeader,
} from '../components/ui.jsx'
import { AddToCalendar } from '../components/AddToCalendar.jsx'
import { fmtDual } from '../lib/time.js'
import { Video, CalendarDays, Link2, Check, Play } from 'lucide-react'

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
    <div className="detailPage">
      <BackLink href="/calendar">Calendar</BackLink>
      <Async query={query}>
        {(event) => {
          const phase = phaseOf(event)
          const live = phase === 'live'
          const concluded = phase === 'concluded'
          return (
            <>
              <PageHeader
                eyebrow={TYPE_LABEL[event.type] || 'Event'}
                title={event.title}
                description={event.description}
              >
                <div className="detailHeaderMeta">
                  {live ? (
                    <StatusChip status="live_now" />
                  ) : concluded ? (
                    <span className="chip chip-neutral">Concluded</span>
                  ) : null}
                  <span className={`mono ${live ? 'detailLiveTime' : ''}`}>
                    {fmtDual(event.startsAt)}
                  </span>
                  {event.wg && (
                    <span className="meta">
                      Hosted by{' '}
                      <A
                        href={`/groups/${event.wg.slug}`}
                        className="inlineLink"
                      >
                        {event.wg.name} WG
                      </A>
                    </span>
                  )}
                </div>
              </PageHeader>

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
