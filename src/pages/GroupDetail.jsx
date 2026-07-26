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
            <PageHeader
              eyebrow={`${g.monogram || g.name.slice(0, 2)} · Working group`}
              title={g.name}
              description={g.focusLine}
            >
              {g.cadenceNote && (
                <p className="metaMuted mono">{g.cadenceNote}</p>
              )}
            </PageHeader>

            <div className="detailActions">
              <A
                href={`/workspace/${g.slug}`}
                className="btn btn-primary btn-glow"
              >
                <Unlock size={18} strokeWidth={1.75} aria-hidden />
                WG workspace
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
            <p className="metaMuted detailHelp">
              Read the workspace introduction and accept the group rules to view
              its WhatsApp link and full Contact Point details.
            </p>

            {g.contact?.publicEmail && (
              <p className="meta detailContact">
                Contact:{' '}
                <a
                  className="inlineLink"
                  href={`mailto:${g.contact.publicEmail}`}
                >
                  {g.contact.publicEmail}
                </a>
              </p>
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
                <div className="grid2">
                  {g.resources.map((r) => (
                    <a
                      key={r.url}
                      className="card cardTight"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="rowGap">
                        <BookOpen size={18} strokeWidth={1.75} aria-hidden />
                        <strong>{r.label}</strong>
                        <ArrowUpRight
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden
                          style={{ marginLeft: 'auto' }}
                        />
                      </div>
                      {r.description && (
                        <p className="meta" style={{ marginTop: 6 }}>
                          {r.description}
                        </p>
                      )}
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
