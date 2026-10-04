interface EventDetailProps {
  slug?: string
}

import type { AnyValue } from '../lib/types'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, BackLink, StatusChip, A, PageHeader } from '../components/ui'
import { AddToCalendar } from '../components/AddToCalendar'
import { DestinationIcon } from '../components/DestinationLink'
import { fmtDual } from '../lib/time'
import {
  TbVideo as Video,
  TbCalendar as CalendarDays,
  TbLink as Link2,
  TbCheck as Check,
  TbPlayerPlay as Play,
} from 'react-icons/tb'

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

// live → concluded → upcoming, so a past event drops the Join button per spec §2.
function phaseOf(event: AnyValue) {
  const now = Date.now()
  if (now >= new Date(event.startsAt).getTime() && now <= new Date(event.endsAt).getTime())
    return 'live'
  if (now > new Date(event.endsAt).getTime()) return 'concluded'
  return 'upcoming'
}

export function EventDetail({ slug }: EventDetailProps) {
  const query = useApi(`/events/${slug}`)
  return (
    <div className="detailPage eventDetailPage">
      <BackLink href="/calendar">Calendar</BackLink>
      <Async query={query}>
        {(event: AnyValue) => {
          const phase = phaseOf(event)
          const live = phase === 'live'
          const concluded = phase === 'concluded'
          const descriptionUrl = event.description?.match(/https?:\/\/\S+/)?.[0]
          const description = event.description
            ?.replace(/\s*(?:Slides:\s*)?https?:\/\/\S+/i, '')
            .trim()
          return (
            <>
              <PageHeader title={event.title} description={description} />

              <section className="card detailSummary detailOverviewCard" aria-label="Event details">
                <div className="detailOverviewFacts">
                  {live ? (
                    <StatusChip status="live_now" />
                  ) : concluded ? (
                    <span className="chip chip-neutral">Concluded</span>
                  ) : null}
                  <span className={`detailOverviewFact mono ${live ? 'detailLiveTime' : ''}`}>
                    <CalendarDays size={17} strokeWidth={1.75} aria-hidden />
                    {fmtDual(event.startsAt)}
                  </span>
                  {event.wg && (
                    <span className="detailOverviewFact meta">
                      Hosted by{' '}
                      <A href={`/groups/${event.wg.slug}`} className="inlineLink">
                        {event.wg.name} WG
                      </A>
                    </span>
                  )}
                </div>
                <div className="detailActions detailPageActions">
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
                  {descriptionUrl && (
                    <a
                      className="btn btn-secondary"
                      href={descriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <DestinationIcon url={descriptionUrl} size={18} />
                      Slides
                    </a>
                  )}
                  {!concluded && <AddToCalendar event={event} />}
                  <CopyLinkButton />
                </div>
              </section>
            </>
          )
        }}
      </Async>
    </div>
  )
}
