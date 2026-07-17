import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCalendar, icsDate, escapeText, foldLine } from '../server/lib/ics.js'

const now = new Date('2026-07-06T09:00:00Z')

const events = [
  {
    slug: 'constituency-call', title: 'Constituency call',
    startsAt: '2026-07-08T13:00:00.000Z', endsAt: '2026-07-08T14:30:00.000Z',
    description: 'Agenda: logistics, AOB', meetingUrl: 'https://zoom.us/j/example',
  },
]

test('icsDate renders compact UTC basic format', () => {
  assert.equal(icsDate('2026-07-08T13:00:00.000Z'), '20260708T130000Z')
})

test('escapeText escapes commas, semicolons, backslashes, newlines', () => {
  assert.equal(escapeText('a, b; c\\d\ne'), 'a\\, b\\; c\\\\d\\ne')
})

test('foldLine wraps lines longer than 75 octets with CRLF + space', () => {
  const long = 'X'.repeat(120)
  const folded = foldLine(long)
  assert.ok(folded.includes('\r\n '))
  assert.ok(folded.split('\r\n').every((l) => l.length <= 75))
})

test('buildCalendar emits a valid VCALENDAR with a reminder alarm', () => {
  const ics = buildCalendar({ name: 'YOUNGO — All events', events }, now)
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'))
  assert.match(ics, /PRODID:-\/\/YOUNGO Hub\/\/EN/)
  assert.match(ics, /UID:constituency-call@youngohub/)
  assert.match(ics, /DTSTART:20260708T130000Z/)
  assert.match(ics, /DTEND:20260708T143000Z/)
  assert.match(ics, /DTSTAMP:20260706T090000Z/)
  assert.match(ics, /SUMMARY:Constituency call/)
  assert.match(ics, /TRIGGER:-PT15M/)
  assert.match(ics, /URL:https:\/\/zoom.us\/j\/example/)
})

test('buildCalendar uses CRLF line endings throughout', () => {
  const ics = buildCalendar({ name: 'Cal', events }, now)
  const bareLf = ics.replace(/\r\n/g, '')
  assert.ok(!bareLf.includes('\n'), 'no lone LF should remain')
})

test('an event without a meeting URL omits URL/LOCATION lines', () => {
  const ics = buildCalendar({ name: 'Cal', events: [{ ...events[0], meetingUrl: null }] }, now)
  assert.ok(!ics.includes('URL:'))
  assert.ok(!ics.includes('LOCATION:'))
})
