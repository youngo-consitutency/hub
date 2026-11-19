import { A } from '../components/ui'
import { useApi } from '../lib/api'
import { fmtMoment } from '../lib/time'

/** Next published call, or nothing when there is no upcoming event. */
export function HeroPulse() {
  const { data } = useApi('/landing')
  const next = data?.events?.[0]
  if (!next) return null
  const moment = fmtMoment(next.startsAt)
  return (
    <p className="dlLive heroPulse">
      <span>
        Next call · {moment.day}, {moment.localTime} {moment.localZone}
      </span>
      <A href={`/calendar/${next.slug}`}>{next.title}</A>
    </p>
  )
}
