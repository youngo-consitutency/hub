/**
 * "Add this event" deep links for major calendar clients via the
 * calendar-link package. ICS remains for Apple Calendar / desktop Outlook.
 */
import type { AnyValue } from './types'
import { google, outlook, office365 } from 'calendar-link'

/** "Add this event" deep links via the calendar-link package. */

const toCalEvent = (event: AnyValue) => ({
  title: event.title || 'YOUNGO event',
  start: new Date(event.startsAt).toISOString(),
  end: new Date(event.endsAt).toISOString(),
  description: [event.description, event.meetingUrl].filter(Boolean).join('\n\n'),
  location: event.meetingUrl || '',
})

/** Google Calendar "create event" template URL. */
export function googleCalendarUrl(event: AnyValue) {
  return google(toCalEvent(event))
}

/** Outlook on the web (live.com) compose deep link. */
export function outlookWebUrl(event: AnyValue) {
  return outlook(toCalEvent(event))
}

/** Office 365 Outlook web. */
export function outlookOfficeUrl(event: AnyValue) {
  return office365(toCalEvent(event))
}

export function icsDownloadPath(slug: AnyValue) {
  return `/ics/event/${encodeURIComponent(slug)}.ics`
}

/** Absolute webcal URL for subscribe feeds (Apple / some clients). */
export function webcalFeedUrl(path: AnyValue) {
  if (typeof window === 'undefined') return path
  const abs = new URL(path, window.location.origin)
  abs.protocol = 'webcal:'
  return abs.toString()
}

export function googleAddByUrlPage() {
  return 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'
}

/**
 * One-click Google Calendar subscribe. Google adds the ICS URL to the
 * signed-in Google account — the Hub never receives Google credentials.
 */
export function googleSubscribeUrl(path: AnyValue, origin?: AnyValue) {
  const base =
    origin ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
    ''
  const abs = new URL(path, base).toString()
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(abs)}`
}
