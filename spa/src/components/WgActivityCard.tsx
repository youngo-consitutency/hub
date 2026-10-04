interface WgActivityCardProps {
  activity?: AnyValue
}

import type { AnyValue } from '../lib/types'
import { AddToCalendar } from './AddToCalendar'
import { DestinationIcon } from './DestinationLink'
import { fmtMoment } from '../lib/time'
import { TbCalendar as CalendarDays, TbArrowUpRight as ArrowUpRight } from 'react-icons/tb'

function activityFields(activity: AnyValue) {
  return {
    id: activity.id,
    kind: activity.kind,
    title: activity.title,
    body: activity.body,
    url: activity.url || null,
    startsAt: activity.startsAt || activity.starts_at || null,
    endsAt: activity.endsAt || activity.ends_at || null,
    taskForceSlug: activity.taskForceSlug || activity.task_force_slug || null,
  }
}

function calendarEvent(activity: AnyValue) {
  if (!activity.startsAt) return null
  const start = new Date(activity.startsAt)
  if (Number.isNaN(start.getTime())) return null
  const end = activity.endsAt
    ? new Date(activity.endsAt)
    : new Date(start.getTime() + 60 * 60 * 1000)
  return {
    title: activity.title,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    description: activity.body,
    meetingUrl: activity.url,
  }
}

export function WgActivityCard({ activity }: WgActivityCardProps) {
  const item = activityFields(activity)
  const event = calendarEvent(item)
  const start = item.startsAt ? fmtMoment(item.startsAt) : null
  const interactive = Boolean(item.url)

  return (
    <article
      className={`card cardTight workspaceActivityCard${interactive ? ' linkedEntityCard' : ''}`}
    >
      {item.url && (
        <a
          className="entityCardLinkOverlay"
          href={item.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${item.title}`}
        />
      )}
      <span className="chip chip-neutral">{item.kind.replaceAll('_', ' ')}</span>
      {item.taskForceSlug && <span className="chip chip-info">{item.taskForceSlug}</span>}
      <h3>
        {item.title}
        {item.url && <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />}
      </h3>
      {item.body && <p className="meta">{item.body}</p>}
      {start && (
        <p className="entityCardMetaRow">
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
          <span>
            {start.day} · {start.localTime} {start.localZone}
          </span>
        </p>
      )}
      <div className="workspaceActivityActions">
        {item.url && (
          <a className="btn btn-secondary btn-sm" href={item.url} target="_blank" rel="noreferrer">
            <DestinationIcon url={item.url} size={16} />
            Open
          </a>
        )}
        {event && <AddToCalendar event={event} className="btn btn-ghost btn-sm" />}
      </div>
    </article>
  )
}
