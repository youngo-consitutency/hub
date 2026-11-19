export interface CalendarMonth {
  year: number
  month: number
}

interface Dated {
  startsAt: string
}

export type EventsByDate<T> = Map<string, T[]>

const DAY_MS = 86_400_000

export function calendarMonth(date = new Date()) {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
}

export function shiftCalendarMonth({ year, month }: CalendarMonth, amount: number): CalendarMonth {
  const date = new Date(Date.UTC(year, month + amount, 1))
  return calendarMonth(date)
}

function eventDateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

export function groupEventsByDate<T extends Dated>(events: T[]): EventsByDate<T> {
  const grouped: EventsByDate<T> = new Map()
  for (const event of events) {
    const key = eventDateKey(event.startsAt)
    const day = grouped.get(key)
    if (day) day.push(event)
    else grouped.set(key, [event])
  }
  return grouped
}

export function eventsInCalendarMonth<T extends Dated>(
  events: T[],
  { year, month }: CalendarMonth,
) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`
  return events.filter((event) => eventDateKey(event.startsAt).startsWith(prefix))
}

export function eventsOnCalendarDay<T extends Dated>(events: T[], key: string) {
  return events.filter((event) => eventDateKey(event.startsAt) === key)
}

export function eventsInCalendarWeek<T extends Dated>(events: T[], date = new Date()) {
  const current = new Date(date)
  const mondayOffset = (current.getUTCDay() + 6) % 7
  const start =
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()) -
    mondayOffset * DAY_MS
  const end = start + 7 * DAY_MS

  return events.filter((event) => {
    const startsAt = new Date(event.startsAt).getTime()
    return startsAt >= start && startsAt < end
  })
}

export function buildCalendarDays<T extends Dated>(
  { year, month }: CalendarMonth,
  groupedEvents: EventsByDate<T>,
) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1))
  const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7
  const gridStart = firstOfMonth.getTime() - mondayOffset * DAY_MS

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart + index * DAY_MS)
    const key = date.toISOString().slice(0, 10)
    const events = groupedEvents.get(key) || []
    const inMonth = date.getUTCFullYear() === year && date.getUTCMonth() === month
    return {
      key,
      day: date.getUTCDate(),
      inMonth,
      isWeekend: [0, 6].includes(date.getUTCDay()),
      events: inMonth ? events : [],
      interactive: inMonth && events.length > 0,
    }
  })
}

export function formatCalendarMonth({ year, month }: CalendarMonth) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)))
}

export function formatCalendarDay(key: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00Z`))
}
