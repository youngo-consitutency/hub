/**
 * Build "add this event" deep links for major calendar clients.
 * ICS remains available for Apple Calendar / desktop Outlook.
 */

function compactUtc(iso) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function encode(value) {
  return encodeURIComponent(String(value ?? '').trim())
}

/** Google Calendar "create event" template URL. */
export function googleCalendarUrl(event) {
  const text = event.title || 'YOUNGO event'
  const dates = `${compactUtc(event.startsAt)}/${compactUtc(event.endsAt)}`
  const details = [event.description, event.meetingUrl]
    .filter(Boolean)
    .join('\n\n')
  const location = event.meetingUrl || ''
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates,
    details,
    location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** Outlook on the web (live.com) compose deep link. */
export function outlookWebUrl(event) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title || 'YOUNGO event',
    startdt: new Date(event.startsAt).toISOString(),
    enddt: new Date(event.endsAt).toISOString(),
    body: [event.description, event.meetingUrl].filter(Boolean).join('\n\n'),
    location: event.meetingUrl || '',
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

/** Office 365 Outlook web. */
export function outlookOfficeUrl(event) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title || 'YOUNGO event',
    startdt: new Date(event.startsAt).toISOString(),
    enddt: new Date(event.endsAt).toISOString(),
    body: [event.description, event.meetingUrl].filter(Boolean).join('\n\n'),
    location: event.meetingUrl || '',
  })
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function icsDownloadPath(slug) {
  return `/ics/event/${encodeURIComponent(slug)}.ics`
}

/** Absolute webcal URL for subscribe feeds (Apple / some clients). */
export function webcalFeedUrl(path) {
  if (typeof window === 'undefined') return path
  const abs = new URL(path, window.location.origin)
  abs.protocol = 'webcal:'
  return abs.toString()
}

export function googleAddByUrlPage() {
  return 'https://calendar.google.com/calendar/u/0/r/settings/addbyurl'
}

// silence unused in some bundlers
void encode
