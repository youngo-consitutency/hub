import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCalendarDays,
  eventDateKey,
  eventsInCalendarMonth,
  groupEventsByDate,
  shiftCalendarMonth,
} from '../src/lib/monthCalendar.js'

const events = [
  { slug: 'late-june', startsAt: '2026-06-30T23:30:00Z' },
  { slug: 'july-one', startsAt: '2026-07-01T00:30:00+02:00' },
  { slug: 'july-call', startsAt: '2026-07-15T13:00:00Z' },
  { slug: 'july-forum', startsAt: '2026-07-15T16:00:00Z' },
  { slug: 'august-one', startsAt: '2026-08-01T09:00:00Z' },
]

test('event dates use UTC rather than the sender offset', () => {
  assert.equal(eventDateKey(events[1].startsAt), '2026-06-30')
})

test('calendar months shift across year boundaries', () => {
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 11 }, 1), {
    year: 2027,
    month: 0,
  })
  assert.deepEqual(shiftCalendarMonth({ year: 2026, month: 0 }, -1), {
    year: 2025,
    month: 11,
  })
})

test('month grid starts on Monday and only event days are interactive', () => {
  const grouped = groupEventsByDate(events)
  const days = buildCalendarDays({ year: 2026, month: 6 }, grouped)

  assert.equal(days.length, 42)
  assert.equal(days[0].key, '2026-06-29')
  assert.equal(days.at(-1).key, '2026-08-09')
  assert.equal(days.find((day) => day.key === '2026-07-04').isWeekend, true)
  assert.equal(days.find((day) => day.key === '2026-07-06').isWeekend, false)
  assert.equal(days.find((day) => day.key === '2026-07-15').interactive, true)
  assert.equal(days.find((day) => day.key === '2026-07-14').interactive, false)
  assert.equal(
    days.find((day) => day.key === '2026-06-30').interactive,
    false,
    'outside-month dates stay inert',
  )
})

test('the month agenda contains only events in the visible UTC month', () => {
  assert.deepEqual(
    eventsInCalendarMonth(events, { year: 2026, month: 6 }).map(
      (event) => event.slug,
    ),
    ['july-call', 'july-forum'],
  )
})
