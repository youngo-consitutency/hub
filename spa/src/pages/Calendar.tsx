interface CalendarEventIconProps {
  type: string
}

import { TbCalendar as CalendarIcon } from 'react-icons/tb'
import { useEffect, useState } from 'react'
import { useApi } from '../lib/api'
import { useContentOptions } from '../lib/documents'
import { Async, Empty, FilterMenu, FilterPill, PageHeader } from '../components/ui'
import { EventCard } from '../components/cards'
import { CalendarSubscribe } from '../components/Subscribe'
import { activeFilterCount, matchesFilters, toggleFilter } from '../lib/filterState'
import {
  buildCalendarDays,
  calendarMonth,
  eventsInCalendarWeek,
  eventsInCalendarMonth,
  eventsOnCalendarDay,
  formatCalendarDay,
  formatCalendarMonth,
  groupEventsByDate,
  shiftCalendarMonth,
} from '../lib/monthCalendar'
import {
  TbCalendarOff as CalendarOff,
  TbChevronLeft as ChevronLeft,
  TbChevronRight as ChevronRight,
  TbFilter as ListFilter,
  TbUsersGroup as UsersRound,
  TbSitemap as Network,
  TbBuildingBank as Landmark,
  TbMessages as MessagesSquare,
  TbDeviceDesktop as MonitorPlay,
  TbCalendarTime as CalendarClock,
  TbCalendarMonth as CalendarMonth,
  TbCalendarWeek as CalendarWeek,
  TbSun as Sun,
} from 'react-icons/tb'

const FILTERS = [
  { key: 'all', label: 'All', icon: ListFilter },
  { key: 'constituency_call', label: 'Constituency', icon: UsersRound },
  { key: 'wg_call', label: 'Working groups', icon: Network },
  { key: 'wgf', label: 'Forums', icon: MessagesSquare },
  { key: 'unfccc_session', label: 'UNFCCC', icon: Landmark },
  { key: 'webinar', label: 'Webinars', icon: MonitorPlay },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EVENT_ICONS = {
  constituency_call: UsersRound,
  wg_call: Network,
  wgf: MessagesSquare,
  unfccc_session: Landmark,
  webinar: MonitorPlay,
  coordination: CalendarClock,
}

function CalendarEventIcon({ type }: CalendarEventIconProps) {
  const Icon = (EVENT_ICONS as any)[type] || CalendarClock
  return (
    <span className="calendarEventIcon" data-event-type={type} aria-hidden>
      <Icon size={15} strokeWidth={1.8} />
    </span>
  )
}

export function Calendar() {
  const { eventTypes } = useContentOptions()
  const EVENT_TYPES = Object.fromEntries(eventTypes.map((t: any) => [t.value, t.short || t.label]))
  const [typeFilters, setTypeFilters] = useState<Record<string, any>>({})
  const [month, setMonth] = useState(calendarMonth)
  const [selectedDay, setSelectedDay] = useState<any>(null)
  const [agendaScope, setAgendaScope] = useState('month')
  const [calendarPanel, setCalendarPanel] = useState<any>(null)
  const [calendarHeight, setCalendarHeight] = useState<any>(null)
  const query = useApi('/events?type=all')
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (!calendarPanel) return undefined
    const measure = () => setCalendarHeight(calendarPanel.offsetHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(calendarPanel)
    return () => observer.disconnect()
  }, [calendarPanel])

  const changeType = (nextType: any) => {
    if (nextType === 'all') setTypeFilters({})
    else {
      setTypeFilters((current) => toggleFilter(current, nextType))
    }
    setSelectedDay(null)
    if (agendaScope === 'day') setAgendaScope('month')
  }

  const changeMonth = (amount: any) => {
    setMonth((current) => shiftCalendarMonth(current, amount))
    setSelectedDay(null)
    setAgendaScope('month')
  }

  const returnToThisMonth = () => {
    setMonth(calendarMonth())
    setSelectedDay(null)
    setAgendaScope('month')
  }

  const changeAgendaScope = (scope: any) => {
    setAgendaScope(scope)
    setSelectedDay(null)
    if (scope !== 'month') setMonth(calendarMonth())
  }

  return (
    <div>
      <PageHeader
        icon={CalendarIcon}
        title="Calendar"
        description="Calls, forums, sessions, and webinars in one UTC-first agenda."
        action={<CalendarSubscribe type="all" />}
      >
        <FilterMenu
          onClear={() => {
            setTypeFilters({})
          }}
          label={activeFilterCount(typeFilters) === 0 ? 'Filter events' : 'Event filters'}
          activeCount={activeFilterCount(typeFilters)}
        >
          <fieldset className="filterLevel">
            <legend>Event type</legend>
            <div className="pillRow">
              {FILTERS.map((f) => (
                <FilterPill
                  key={f.key}
                  active={f.key === 'all' && activeFilterCount(typeFilters) === 0}
                  state={f.key === 'all' ? undefined : typeFilters[f.key] || 'neutral'}
                  icon={f.icon}
                  onClick={() => changeType(f.key)}
                >
                  {f.label}
                </FilterPill>
              ))}
            </div>
          </fieldset>
        </FilterMenu>
      </PageHeader>
      <Async
        query={query}
        empty={(d: any) =>
          d.items.length === 0 ? (
            <Empty
              icon={CalendarOff}
              title="Nothing scheduled for this filter"
              body="Try another type or check back soon."
            />
          ) : null
        }
      >
        {(data: any) => {
          const events = data.items.filter((event: any) => matchesFilters(event.type, typeFilters))
          const grouped = groupEventsByDate(events)
          const days = buildCalendarDays(month, grouped)
          const monthEvents = eventsInCalendarMonth(events, month)
          const activeDay = selectedDay && grouped.has(selectedDay) ? selectedDay : null
          const agendaEvents = activeDay
            ? eventsOnCalendarDay(events, activeDay)
            : agendaScope === 'today'
              ? eventsOnCalendarDay(events, today)
              : agendaScope === 'week'
                ? eventsInCalendarWeek(events)
                : monthEvents
          const agendaGroups = [
            ...groupEventsByDate(
              [...agendaEvents].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
            ),
          ].sort(([a], [b]) => a.localeCompare(b))
          const agendaTitle = activeDay
            ? formatCalendarDay(activeDay)
            : agendaScope === 'today'
              ? 'Today'
              : agendaScope === 'week'
                ? 'This week'
                : formatCalendarMonth(month)
          const visibleTypes = [...new Set<any>(monthEvents.map((event: any) => event.type))]

          return (
            <div className="calendarLayout">
              <section
                ref={setCalendarPanel}
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
                    const label = `${formatCalendarDay(date.key)}: ${date.events.map((event: any) => event.title).join(', ')}`
                    const content = (
                      <>
                        <time
                          dateTime={date.key}
                          aria-current={date.key === today ? 'date' : undefined}
                          className={`calendarDayNumber ${date.key === today ? 'today' : ''}`}
                        >
                          {date.day}
                        </time>
                        {dots.length > 0 && (
                          <span className="calendarDots" aria-hidden>
                            {dots.map((event: any) => (
                              <CalendarEventIcon key={event.slug} type={event.type} />
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
                        onClick={() => {
                          setSelectedDay(date.key)
                          setAgendaScope('day')
                        }}
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
                  <div className="calendarLegend" aria-label="Event types">
                    {visibleTypes.map((eventType) => (
                      <span key={eventType}>
                        <CalendarEventIcon type={eventType} />
                        {EVENT_TYPES[eventType] || eventType}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <aside
                className="calendarAgenda"
                aria-labelledby="calendar-agenda-title"
                style={calendarHeight ? { height: `${calendarHeight}px` } : undefined}
              >
                <div className="calendarAgendaHeader">
                  <p className="eyebrow">Agenda</p>
                  <div className="calendarAgendaSummary">
                    <h2 id="calendar-agenda-title">{agendaTitle}</h2>
                    <p className="meta">
                      {agendaEvents.length
                        ? `${agendaEvents.length} ${agendaEvents.length === 1 ? 'event' : 'events'}`
                        : 'No events'}
                    </p>
                  </div>
                  <div
                    className="viewSwitch calendarAgendaScope"
                    role="group"
                    aria-label="Agenda range"
                  >
                    <FilterPill
                      active={agendaScope === 'today'}
                      icon={Sun}
                      onClick={() => changeAgendaScope('today')}
                    >
                      Today
                    </FilterPill>
                    <FilterPill
                      active={agendaScope === 'week'}
                      icon={CalendarWeek}
                      onClick={() => changeAgendaScope('week')}
                    >
                      This week
                    </FilterPill>
                    <FilterPill
                      active={agendaScope === 'month'}
                      icon={CalendarMonth}
                      onClick={() => changeAgendaScope('month')}
                    >
                      Month
                    </FilterPill>
                  </div>
                  {activeDay && (
                    <button
                      type="button"
                      className="calendarAgendaClear"
                      onClick={() => changeAgendaScope('month')}
                    >
                      Clear selected day
                    </button>
                  )}
                  <span className="srOnly" role="status">
                    {activeDay
                      ? `Showing events for ${formatCalendarDay(activeDay)}`
                      : `Showing ${agendaTitle.toLowerCase()}`}
                  </span>
                </div>
                {agendaEvents.length ? (
                  <div className="calendarAgendaList">
                    {agendaGroups.map(([dateKey, dateEvents]) => (
                      <section
                        key={dateKey}
                        className="calendarAgendaGroup"
                        aria-label={formatCalendarDay(dateKey)}
                      >
                        {agendaScope !== 'today' && !activeDay && (
                          <div className="calendarAgendaDate">
                            <h3 id={`agenda-${dateKey}`}>
                              {dateKey === today
                                ? `Today · ${formatCalendarDay(dateKey)}`
                                : formatCalendarDay(dateKey)}
                            </h3>
                            <span>
                              {dateEvents.length} {dateEvents.length === 1 ? 'event' : 'events'}
                            </span>
                          </div>
                        )}
                        <div className="calendarAgendaCards">
                          {dateEvents.map((event: any) => (
                            <EventCard key={event.slug} event={event} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={CalendarOff}
                    title={
                      agendaScope === 'today'
                        ? 'No events today'
                        : agendaScope === 'week'
                          ? 'No events this week'
                          : activeDay
                            ? 'No events on this day'
                            : 'No events this month'
                    }
                    body={
                      agendaScope === 'month'
                        ? 'Use the arrows to check another month.'
                        : 'Try another agenda range or event type.'
                    }
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
