import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, FilterPill, PageHeader } from '../components/ui.jsx'
import { EventCard } from '../components/cards.jsx'
import { CalendarSubscribe } from '../components/Subscribe.jsx'
import {
  buildCalendarDays,
  calendarMonth,
  eventsInCalendarMonth,
  formatCalendarDay,
  formatCalendarMonth,
  groupEventsByDate,
  shiftCalendarMonth,
} from '../lib/monthCalendar.js'
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Users,
  Network,
  Landmark,
  MessageSquareText,
  Presentation,
} from 'lucide-react'

const FILTERS = [
  { key: 'all', label: 'All', icon: ListFilter },
  { key: 'constituency_call', label: 'Constituency', icon: Users },
  { key: 'wg_call', label: 'Working groups', icon: Network },
  { key: 'wgf', label: 'Forums', icon: MessageSquareText },
  { key: 'unfccc_session', label: 'UNFCCC', icon: Landmark },
  { key: 'webinar', label: 'Webinars', icon: Presentation },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EVENT_TYPES = {
  constituency_call: 'Constituency',
  wg_call: 'Working group',
  wgf: 'Forum',
  unfccc_session: 'UNFCCC',
  webinar: 'Webinar',
  coordination: 'Coordination',
}

export function Calendar() {
  const [type, setType] = useState('all')
  const [month, setMonth] = useState(calendarMonth)
  const [selectedDay, setSelectedDay] = useState(null)
  const query = useApi(`/events?type=${type}`, [type])
  const today = new Date().toISOString().slice(0, 10)

  const changeType = (nextType) => {
    setType(nextType)
    setSelectedDay(null)
  }

  const changeMonth = (amount) => {
    setMonth((current) => shiftCalendarMonth(current, amount))
    setSelectedDay(null)
  }

  const returnToThisMonth = () => {
    setMonth(calendarMonth())
    setSelectedDay(null)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        description="Calls, forums, sessions, and webinars in one UTC-first agenda."
        action={<CalendarSubscribe type={type} />}
      >
        <div className="pillRow" aria-label="Filter events by type">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.key}
              active={type === f.key}
              icon={f.icon}
              onClick={() => changeType(f.key)}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
      </PageHeader>
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? (
            <Empty
              icon={CalendarOff}
              title="Nothing scheduled for this filter"
              body="Try another type or check back soon."
            />
          ) : null
        }
      >
        {(data) => {
          const grouped = groupEventsByDate(data.items)
          const days = buildCalendarDays(month, grouped)
          const monthEvents = eventsInCalendarMonth(data.items, month)
          const activeDay =
            selectedDay && grouped.has(selectedDay) ? selectedDay : null
          const agendaEvents = activeDay ? grouped.get(activeDay) : monthEvents
          const visibleTypes = [
            ...new Set(monthEvents.map((event) => event.type)),
          ]

          return (
            <div className="calendarLayout">
              <section
                className="calendarPanel"
                aria-label={`${formatCalendarMonth(month)} calendar`}
              >
                <div className="calendarToolbar">
                  <div>
                    <p className="eyebrow">Month</p>
                    <h2>{formatCalendarMonth(month)}</h2>
                  </div>
                  <div className="calendarControls">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={returnToThisMonth}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => changeMonth(-1)}
                      aria-label="Previous month"
                    >
                      <ChevronLeft size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="iconButton"
                      onClick={() => changeMonth(1)}
                      aria-label="Next month"
                    >
                      <ChevronRight size={18} aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="calendarWeekdays" aria-hidden>
                  {WEEKDAYS.map((day, index) => (
                    <span key={day} data-weekend={index >= 5 || undefined}>
                      {day}
                    </span>
                  ))}
                </div>
                <div className="calendarMonthGrid">
                  {days.map((date) => {
                    const dots = date.events.slice(0, 4)
                    const label = `${formatCalendarDay(date.key)}: ${date.events.map((event) => event.title).join(', ')}`
                    const content = (
                      <>
                        <span
                          className={`calendarDayNumber ${date.key === today ? 'today' : ''}`}
                        >
                          {date.day}
                        </span>
                        {dots.length > 0 && (
                          <span className="calendarDots" aria-hidden>
                            {dots.map((event) => (
                              <span
                                key={event.slug}
                                className="calendarDot"
                                data-event-type={event.type}
                              />
                            ))}
                            {date.events.length > dots.length && (
                              <span className="calendarMore">
                                +{date.events.length - dots.length}
                              </span>
                            )}
                          </span>
                        )}
                      </>
                    )

                    return date.interactive ? (
                      <button
                        type="button"
                        key={date.key}
                        className={`calendarDay calendarDayButton ${selectedDay === date.key ? 'selected' : ''}`}
                        data-weekend={date.isWeekend || undefined}
                        onClick={() => setSelectedDay(date.key)}
                        aria-label={label}
                        aria-pressed={selectedDay === date.key}
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        key={date.key}
                        className={`calendarDay calendarDayEmpty ${date.inMonth ? '' : 'outside'}`}
                        data-weekend={date.isWeekend || undefined}
                        aria-hidden={!date.inMonth}
                      >
                        {content}
                      </div>
                    )
                  })}
                </div>

                {visibleTypes.length > 0 && (
                  <div className="calendarLegend" aria-label="Event colours">
                    {visibleTypes.map((eventType) => (
                      <span key={eventType}>
                        <span
                          className="calendarDot"
                          data-event-type={eventType}
                          aria-hidden
                        />
                        {EVENT_TYPES[eventType] || eventType}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <aside
                className="calendarAgenda"
                aria-labelledby="calendar-agenda-title"
              >
                <div className="calendarAgendaHeader">
                  <p className="eyebrow">
                    {activeDay ? 'Selected day' : 'This month'}
                  </p>
                  <h2 id="calendar-agenda-title">
                    {activeDay
                      ? formatCalendarDay(activeDay)
                      : formatCalendarMonth(month)}
                  </h2>
                  <p className="meta">
                    {agendaEvents.length
                      ? `${agendaEvents.length} ${agendaEvents.length === 1 ? 'event' : 'events'}`
                      : 'No events scheduled'}
                  </p>
                  <span className="srOnly" role="status">
                    {activeDay
                      ? `Showing events for ${formatCalendarDay(activeDay)}`
                      : `Showing ${formatCalendarMonth(month)}`}
                  </span>
                </div>
                {agendaEvents.length ? (
                  <div className="calendarAgendaList">
                    {agendaEvents.map((event) => (
                      <EventCard key={event.slug} event={event} />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={CalendarOff}
                    title="No events this month"
                    body="Use the arrows to check another month."
                  />
                )}
              </aside>
            </div>
          )
        }}
      </Async>
    </div>
  )
}
