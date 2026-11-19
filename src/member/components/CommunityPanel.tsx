import type { EventSummary } from '../../shared/contracts'
import { A } from './ui'
import { DateStamp } from './DateStamp'
import { useApi } from '../lib/api'
import { fmtMoment } from '../lib/time'

// the roles that run the constituency, drawn as characters; deliberately not real people
// (child safeguarding: no member photos or names are ever published here)
const FIGURES = ['amara', 'jun', 'lucia', 'tariq', 'ingrid', 'kofi']

function Count({ path, label }: { path: string; label: string }) {
  const { data } = useApi(path)
  const n = data?.items?.length ?? 0
  // a failed or empty count is left out, never shown as zero
  if (!n) return null
  return (
    <li>
      <strong>{n}</strong> <span>{label}</span>
    </li>
  )
}

/**
 * The "someone is home" side of sign-in: what is actually coming up and how big the community's
 * work is, from the same public endpoints as the landing page. Renders nothing it cannot back up.
 */
export function CommunityPanel() {
  const { data } = useApi<{ events: Pick<EventSummary, 'slug' | 'title' | 'startsAt'>[] }>(
    '/landing',
  )
  const next = data?.events?.[0]
  const moment = next ? fmtMoment(next.startsAt) : null
  return (
    <aside className="authCommunity" aria-labelledby="auth-community-title">
      <p className="eyebrow">YOUNGO Hub</p>
      <h2 id="auth-community-title">Young people shaping climate policy, together.</h2>
      <ul className="dlStack authPeople" aria-hidden>
        {FIGURES.map((name) => (
          <li key={name} className="dlAvatar" style={{ '--size': '44px' } as React.CSSProperties}>
            <img src={`/illustrations/community/${name}.svg`} alt="" width={44} height={44} />
          </li>
        ))}
      </ul>
      <ul className="authCounts">
        <Count path="/groups" label="working groups" />
        <Count path="/coys" label="Conferences of Youth" />
        <Count path="/resources" label="science resources" />
      </ul>
      {next && moment && (
        <div className="authNext">
          <p className="dlLive">
            Next call · {moment.day}, {moment.localTime} {moment.localZone}
          </p>
          <div className="authNextRow">
            <DateStamp iso={next.startsAt} />
            <A href={`/calendar/${next.slug}`}>{next.title}</A>
          </div>
        </div>
      )}
    </aside>
  )
}
