import { useApi } from '../lib/api.js'
import { A, Button, Async, Section, Empty } from '../components/ui.jsx'
import { EventCard, ClosingCard, CoyCard, GroupCard } from '../components/cards.jsx'
import { fmtDual } from '../lib/time.js'
import { Radio, CalendarOff, Megaphone, Users } from 'lucide-react'

function LiveBanner({ event }) {
  return (
    <div className="liveBanner">
      <span className="liveDot pulse" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 500, fontSize: 14 }}><Radio size={14} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -2, marginRight: 6, color: 'var(--live)' }} />{event.title} — live now</p>
        <p className="mono" style={{ color: 'var(--live)', marginTop: 2 }}>{fmtDual(event.startsAt)}</p>
      </div>
      {event.meetingUrl && <a className="btn btn-primary btn-glow btn-sm" href={event.meetingUrl} target="_blank" rel="noreferrer">Join</a>}
    </div>
  )
}

export function Home() {
  const feed = useApi('/feed')
  const groups = useApi('/groups')

  return (
    <div>
      <Async query={feed} skeletons={4}>
        {(data) => (
          <>
            {data.live && <LiveBanner event={data.live} />}
            <h1>YOUNGO, in one place</h1>
            <p className="meta" style={{ marginTop: 4 }}>
              {data.closing.length} closing soon · {data.week.length} meetings this week
            </p>

            {data.pinned.length > 0 && (
              <Section label="Pinned">
                <div className="stackSm">
                  {data.pinned.map((a, i) => (
                    <div key={i} className="card cardTight">
                      <p style={{ fontWeight: 500, fontSize: 14 }}><Megaphone size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--accent)' }} />{a.title}</p>
                      <p className="meta" style={{ marginTop: 4 }}>{a.body}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section label="This week" action={<A href="/calendar" className="metaMuted">Full calendar →</A>}>
              {data.week.length
                ? <div className="stackSm">{data.week.map((e) => <EventCard key={e.slug} event={e} />)}</div>
                : <Empty icon={CalendarOff} title="Nothing scheduled this week" body="Subscribe to the calendar and you’ll never miss a call." />}
            </Section>

            {data.closing.length > 0 && (
              <Section label="Closing soon" action={<A href="/submissions" className="metaMuted">All submissions →</A>}>
                <div className="stackSm">{data.closing.map((x) => <ClosingCard key={`${x.kind}-${x.slug}`} item={x} />)}</div>
              </Section>
            )}

            {data.coys.length > 0 && (
              <Section label="COYs" action={<A href="/coys" className="metaMuted">All COYs →</A>}>
                <div className="hscroll">{data.coys.map((c) => <CoyCard key={c.slug} coy={c} />)}</div>
              </Section>
            )}
          </>
        )}
      </Async>

      <Section label="Find your working group" action={<A href="/groups" className="metaMuted">Browse all →</A>}>
        <Async query={groups} skeletons={2} empty={(d) => d.items.length === 0 ? <Empty icon={Users} title="No working groups yet" body="Groups will appear here once they’re set up." /> : null}>
          {(data) => <div className="grid2">{data.items.slice(0, 4).map((g) => <GroupCard key={g.slug} group={g} />)}</div>}
        </Async>
      </Section>
    </div>
  )
}
