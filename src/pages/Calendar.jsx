import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty } from '../components/ui.jsx'
import { EventCard } from '../components/cards.jsx'
import { CalendarSubscribe } from '../components/Subscribe.jsx'
import { fmtDay } from '../lib/time.js'
import { CalendarOff } from 'lucide-react'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'constituency_call', label: 'Constituency' },
  { key: 'wg_call', label: 'Working groups' },
  { key: 'wgf', label: 'Forums' },
  { key: 'unfccc_session', label: 'UNFCCC' },
  { key: 'webinar', label: 'Webinars' },
]

function groupByDay(items) {
  const days = new Map()
  for (const e of items) {
    const key = fmtDay(e.startsAt, 'UTC')
    if (!days.has(key)) days.set(key, [])
    days.get(key).push(e)
  }
  return [...days.entries()]
}

export function Calendar() {
  const [type, setType] = useState('all')
  const query = useApi(`/events?type=${type}`, [type])
  const today = fmtDay(new Date().toISOString(), 'UTC')

  return (
    <div>
      <div className="rowBetween">
        <h1>Calendar</h1>
        <CalendarSubscribe type={type} />
      </div>
      <div className="pillRow" style={{ marginTop: 12 }}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`pill ${type === f.key ? 'active' : ''}`} onClick={() => setType(f.key)}>{f.label}</button>
        ))}
      </div>
      <Async query={query} empty={(d) => d.items.length === 0 ? <Empty icon={CalendarOff} title="Nothing scheduled for this filter" body="Try another type or check back soon." /> : null}>
        {(data) => (
          <div className="stack">
            {groupByDay(data.items).map(([day, events]) => (
              <div key={day}>
                <div className={`dayHeader ${day === today ? 'today' : ''}`}>{day === today ? 'Today' : day}</div>
                <div className="stackSm">{events.map((e) => <EventCard key={e.slug} event={e} />)}</div>
              </div>
            ))}
          </div>
        )}
      </Async>
    </div>
  )
}
