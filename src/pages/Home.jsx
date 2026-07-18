import { useApi } from '../lib/api.js'
import { A, Button, Async, Section, Empty } from '../components/ui.jsx'
import { EventCard, ClosingCard, CoyCard, GroupCard } from '../components/cards.jsx'
import { fmtDual } from '../lib/time.js'
import { Radio, CalendarOff, Megaphone, Users, Trophy } from 'lucide-react'

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
            <h1>Home</h1>
            <p className="meta homeLede" style={{ marginTop: 4 }}>
              What needs attention this week.
            </p>

            {data.pinned.length > 0 && (
              <Section label="Pinned">
                <div className="stackSm">
                  {data.pinned.slice(0, 2).map((a, i) => (
                    <div key={i} className="card cardTight">
                      <p style={{ fontWeight: 500, fontSize: 14 }}><Megaphone size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--accent)' }} />{a.title}</p>
                      <p className="meta" style={{ marginTop: 4 }}>{a.body}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section label="This week" action={<A href="/calendar" className="metaMuted">Calendar →</A>}>
              {data.week.length
                ? <div className="stackSm">{data.week.slice(0, 4).map((e) => <EventCard key={e.slug} event={e} />)}</div>
                : <Empty icon={CalendarOff} title="Nothing scheduled this week" body="Subscribe from Calendar so new calls show up automatically." />}
            </Section>

            {data.closing.length > 0 && (
              <Section label="Closing soon" action={<A href="/submissions" className="metaMuted">All →</A>}>
                <div className="stackSm">{data.closing.slice(0, 3).map((x) => <ClosingCard key={`${x.kind}-${x.slug}`} item={x} />)}</div>
              </Section>
            )}

            {data.coys.length > 0 && (
              <Section label="COYs" action={<A href="/coys" className="metaMuted">All →</A>}>
                <div className="hscroll">{data.coys.slice(0, 4).map((c) => <CoyCard key={c.slug} coy={c} />)}</div>
              </Section>
            )}
          </>
        )}
      </Async>

      <Section label="Working groups" action={<A href="/groups" className="metaMuted">Browse →</A>}>
        <Async query={groups} skeletons={2} empty={(d) => d.items.length === 0 ? <Empty icon={Users} title="No working groups yet" body="Groups will appear here once they’re set up." /> : null}>
          {(data) => <div className="grid2">{data.items.slice(0, 2).map((g) => <GroupCard key={g.slug} group={g} />)}</div>}
        </Async>
      </Section>

      <Section label="NGO recognition" action={<A href="/recognition" className="metaMuted">Board →</A>}>
        <A href="/recognition" className="card cardTight rowGap">
          <Trophy size={18} strokeWidth={1.75} aria-hidden color="var(--accent)" />
          <div>
            <h3>See which organisations are supporting badges &amp; submissions</h3>
            <p className="meta" style={{ marginTop: 4 }}>Staff-verified contribution points for UNFCCC-facing work.</p>
          </div>
        </A>
      </Section>
    </div>
  )
}
