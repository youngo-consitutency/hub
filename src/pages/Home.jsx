import { useApi } from '../lib/api.js'
import { A, Async, Section, Empty, PageHeader } from '../components/ui.jsx'
import {
  EventCard,
  ClosingCard,
  CoyCard,
  GroupCard,
} from '../components/cards.jsx'
import {
  MissionCountdown,
  MissionMetric,
} from '../components/MissionConsole.jsx'
import { fmtDual } from '../lib/time.js'
import { Radio, CalendarOff, Users } from 'lucide-react'

function LiveBanner({ event }) {
  return (
    <div className="liveBanner">
      <span className="liveDot pulse" />
      <div className="liveBannerCopy">
        <p className="liveBannerTitle">
          <Radio size={14} strokeWidth={1.75} aria-hidden />
          {event.title} — live now
        </p>
        <p className="mono liveBannerTime">{fmtDual(event.startsAt)}</p>
      </div>
      {event.meetingUrl && (
        <a
          className="btn btn-primary btn-glow btn-sm"
          href={event.meetingUrl}
          target="_blank"
          rel="noreferrer"
        >
          Join
        </a>
      )}
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
            <PageHeader
              eyebrow="Member overview"
              title="YOUNGO, in one place"
            />

            <div className="mcHero homeHero">
              <MissionCountdown label="Days to COP31 · Antalya, Türkiye" />
              <div className="mcHeroMetrics">
                <MissionMetric
                  value={String(data.closing.length)}
                  label="Closing soon"
                  tone={data.closing.length > 0 ? 'warn' : undefined}
                />
                <MissionMetric
                  value={String(data.week.length)}
                  label="Meetings this week"
                />
                <MissionMetric
                  value={String(data.coys.length)}
                  label="COYs listed"
                />
              </div>
            </div>

            {data.pinned.length > 0 && (
              <Section label="Pinned">
                <div className="cardGrid">
                  {data.pinned.map((a, i) => (
                    <div key={i} className="card cardTight announcementCard">
                      <h3>{a.title}</h3>
                      <p className="meta">{a.body}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <Section
              label="This week"
              action={
                <A href="/calendar" className="metaMuted">
                  Calendar →
                </A>
              }
            >
              {data.week.length ? (
                <div className="cardGrid">
                  {data.week.slice(0, 6).map((e) => (
                    <EventCard key={e.slug} event={e} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={CalendarOff}
                  title="Nothing scheduled this week"
                  body="Subscribe from Calendar so new calls show up automatically."
                />
              )}
            </Section>

            {data.closing.length > 0 && (
              <Section
                label="Closing soon"
                action={
                  <A href="/submissions" className="metaMuted">
                    All →
                  </A>
                }
              >
                <div className="cardGrid">
                  {data.closing.slice(0, 3).map((x) => (
                    <ClosingCard key={`${x.kind}-${x.slug}`} item={x} />
                  ))}
                </div>
              </Section>
            )}

            {data.coys.length > 0 && (
              <Section
                label="COYs"
                action={
                  <A href="/coys" className="metaMuted">
                    All →
                  </A>
                }
              >
                <div className="cardGrid">
                  {data.coys.slice(0, 6).map((c) => (
                    <CoyCard key={c.slug} coy={c} />
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Async>

      <Section
        label="Working groups"
        action={
          <A href="/groups" className="metaMuted">
            Browse →
          </A>
        }
      >
        <Async
          query={groups}
          skeletons={2}
          empty={(d) =>
            d.items.length === 0 ? (
              <Empty
                icon={Users}
                title="No working groups yet"
                body="Groups will appear here once they’re set up."
              />
            ) : null
          }
        >
          {(data) => (
            <div className="cardGrid">
              {data.items.slice(0, 3).map((g) => (
                <GroupCard key={g.slug} group={g} />
              ))}
            </div>
          )}
        </Async>
      </Section>

      <Section
        label="NGO recognition"
        action={
          <A href="/recognition" className="metaMuted">
            Board →
          </A>
        }
      >
        <A href="/recognition" className="card cardTight recognitionPromo">
          <h3>
            See which organisations are supporting badges &amp; submissions
          </h3>
          <p className="meta">
            Staff-verified contribution points for UNFCCC-facing work.
          </p>
        </A>
      </Section>
    </div>
  )
}
