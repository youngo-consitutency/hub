import type { AnyValue } from '../../lib/types'
import { TbArrowUpRight, TbCalendarEvent } from 'react-icons/tb'
import { A, Button } from '../../components/ui'
import { DateStamp } from '../../components/DateStamp'
import { useApi } from '../../lib/api'
import { fmtMoment } from '../../lib/time'

/** Load public upcoming events with local times and full-page event links, including retry and empty states. */
export function UpcomingEvents() {
  const { data, loading, error, retry } = useApi('/landing')
  return (
    <aside className="siteUpcoming" aria-labelledby="upcoming-title">
      <div className="siteUpcomingHeading">
        <span className="iconTile" aria-hidden>
          <TbCalendarEvent size={22} />
        </span>
        <div>
          <p className="pageEyebrow">Around YOUNGO</p>
          <h2 id="upcoming-title">Coming up</h2>
        </div>
      </div>
      <div className="siteUpcomingBody" aria-busy={loading}>
        {loading ? (
          <p className="meta" role="status">
            Loading events…
          </p>
        ) : error ? (
          <div className="stackSm">
            <p className="meta">Events could not be loaded.</p>
            <Button sm onClick={retry}>
              Try again
            </Button>
          </div>
        ) : data?.events?.length ? (
          <ol className="siteEventList">
            {data.events.map((event: AnyValue) => {
              const moment = fmtMoment(event.startsAt)
              return (
                <li key={event.slug}>
                  <DateStamp iso={event.startsAt} />
                  <div>
                    <h3>
                      <A href={`/calendar/${event.slug}`} peek={false}>
                        {event.title}
                      </A>
                    </h3>
                    <p className="meta">
                      {moment.localTime} {moment.localZone}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="meta">No upcoming events have been published.</p>
        )}
      </div>
      <A href="/calendar" className="siteUpcomingLink" peek={false}>
        Open the Hub calendar <TbArrowUpRight size={19} aria-hidden />
      </A>
    </aside>
  )
}
