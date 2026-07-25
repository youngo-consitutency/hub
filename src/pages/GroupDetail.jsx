import { useApi } from '../lib/api.js'
import { A, Async, BackLink, Section, Empty } from '../components/ui.jsx'
import { EventCard, SubmissionCard } from '../components/cards.jsx'
import { CopyFeedButton } from '../components/Subscribe.jsx'
import {
  Users,
  MessageCircle,
  ArrowUpRight,
  CalendarOff,
  Unlock,
} from 'lucide-react'

export function GroupDetail({ slug }) {
  const query = useApi(`/groups/${slug}`)
  return (
    <div>
      <BackLink href="/groups">Working groups</BackLink>
      <Async query={query}>
        {(g) => (
          <>
            <div
              className="rowGap"
              style={{ marginTop: 8, alignItems: 'flex-start' }}
            >
              <span className="monogram">
                {g.monogram || g.name.slice(0, 2)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1>{g.name}</h1>
                <p className="meta" style={{ marginTop: 4 }}>
                  {g.focusLine}
                </p>
              </div>
            </div>
            {g.cadenceNote && (
              <p className="metaMuted mono" style={{ marginTop: 12 }}>
                {g.cadenceNote}
              </p>
            )}

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
            <p className="metaMuted" style={{ marginTop: 8 }}>
              Read the workspace introduction and accept the group rules to view
              its WhatsApp link and full Contact Point details.
            </p>

            {g.contact?.publicEmail && (
              <p className="meta" style={{ marginTop: 12 }}>
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
                <div className="stackSm">
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
                <div className="stackSm">
                  {g.submissions.map((s) => (
                    <SubmissionCard key={s.slug} sub={s} />
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
