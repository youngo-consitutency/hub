import { useApi } from '../lib/api.js'
import {
  A,
  Async,
  BackLink,
  Section,
  Empty,
  PageHeader,
} from '../components/ui.jsx'
import { EventCard, SubmissionCard } from '../components/cards.jsx'
import { ContactCard } from '../components/cards.jsx'
import { CopyFeedButton } from '../components/Subscribe.jsx'
import {
  Users,
  MessageCircle,
  ArrowUpRight,
  CalendarOff,
  Unlock,
  BookOpen,
} from 'lucide-react'

export function GroupDetail({ slug }) {
  const query = useApi(`/groups/${slug}`)
  return (
    <div className="detailPage">
      <BackLink href="/groups">Working groups</BackLink>
      <Async query={query}>
        {(g) => (
          <>
            <PageHeader title={g.name} description={g.focusLine}>
              {g.cadenceNote && (
                <p className="metaMuted mono">{g.cadenceNote}</p>
              )}
            </PageHeader>

            <section className="card groupOverview" aria-label="Group access">
              <div className="groupOverviewCopy">
                <h2>Member workspace</h2>
                <p className="metaMuted detailHelp">
                  Complete the short group introduction once to open member
                  channels, activities, and full Contact Point details.
                </p>
              </div>
              <div className="detailActions groupOverviewActions">
                <A href={`/workspace/${g.slug}`} className="btn btn-primary">
                  <Unlock size={18} strokeWidth={1.75} aria-hidden />
                  Open workspace
                </A>
                {g.whatsappUrl && (
                  <a
                    className="btn btn-secondary"
                    href={g.whatsappUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={18} strokeWidth={1.75} aria-hidden />
                    WhatsApp
                  </a>
                )}
                {g.groupUrl && (
                  <a
                    className="btn btn-secondary"
                    href={g.groupUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Users size={18} strokeWidth={1.75} aria-hidden />
                    Mailing list
                  </a>
                )}
                {g.driveUrl && (
                  <a
                    className="btn btn-ghost"
                    href={g.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Drive
                    <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                  </a>
                )}
              </div>
            </section>

            {g.contact && (
              <Section label="Contact point">
                <div className="groupContactGrid">
                  <ContactCard contact={g.contact} />
                </div>
              </Section>
            )}

            <Section
              label="Upcoming meetings"
              action={
                g.events?.length ? (
                  <CopyFeedButton
                    path={`/ics/wg/${g.slug}.ics`}
                    label="Subscribe"
                    className="btn btn-ghost btn-sm"
                  />
                ) : null
              }
            >
              {g.events?.length ? (
                <div className="cardGrid">
                  {g.events.map((e) => (
                    <EventCard key={e.slug} event={e} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={CalendarOff}
                  title="Nothing scheduled"
                  body="No upcoming calls for this group right now."
                />
              )}
            </Section>

            {g.submissions?.length > 0 && (
              <Section label="Open submissions">
                <div className="cardGrid">
                  {g.submissions.map((s) => (
                    <SubmissionCard key={s.slug} sub={s} />
                  ))}
                </div>
              </Section>
            )}

            {g.resources?.length > 0 && (
              <Section label="Learning & resources">
                <div className="groupResourceGrid">
                  {g.resources.map((r) => (
                    <a
                      key={r.url}
                      className="card cardTight groupResourceCard"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <BookOpen
                        className="groupResourceIcon"
                        size={20}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <div className="groupResourceCopy">
                        <strong>{r.label}</strong>
                        {r.description && (
                          <p className="meta">{r.description}</p>
                        )}
                      </div>
                      <ArrowUpRight
                        className="groupResourceAction"
                        size={17}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </Async>
    </div>
  )
}
