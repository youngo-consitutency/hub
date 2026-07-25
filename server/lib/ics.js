// Pure ICS (RFC 5545) document builder — no I/O, so node --test can pin `now`.
// Feeds carry UTC times, meeting URLs, and a 15-minute default VALARM (01 §ICS).

const PRODID = '-//YOUNGO Hub//EN'

// 2026-07-08T13:00:00.000Z → 20260708T130000Z
export function icsDate(iso) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

// Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, and newlines.
export function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// Fold content lines to ≤75 octets with CRLF + space continuation (§3.1).
export function foldLine(line) {
  if (line.length <= 75) return line
  const parts = []
  let rest = line
  parts.push(rest.slice(0, 75))
  rest = rest.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

function vevent(event, stamp) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.slug}@youngohub`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]
  if (event.description)
    lines.push(`DESCRIPTION:${escapeText(event.description)}`)
  if (event.meetingUrl) {
    lines.push(`URL:${escapeText(event.meetingUrl)}`)
    lines.push(`LOCATION:${escapeText(event.meetingUrl)}`)
  }
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
  )
  return lines
}

export function buildCalendar({ name, events }, now = new Date()) {
  const stamp = icsDate(now.toISOString())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    ...events.flatMap((e) => vevent(e, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
