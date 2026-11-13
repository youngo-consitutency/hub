'use client'

interface LiveBannerProps {
  event?: AnyValue
}

interface ResponsibilitySectionProps {
  account?: AnyValue
}

interface WorkspaceSectionProps {
  groups?: AnyValue
  workspaces?: AnyValue
}

import type { AnyValue, Doc } from '../lib/types'
import { canManageGroups } from '../lib/groupPermissions'
import { responsibilitiesFor, viewerOf } from '../lib/routes'
import { useApi } from '../lib/api'
import { A, Async, LifecycleTiming, Section, PageHeader } from '../components/ui'
import { EventCard, ClosingCard, CoyCard, GroupCard } from '../components/cards'
import { MissionMetric } from '../components/MissionConsole'
import { fmtDual } from '../lib/time'
import { useAccount } from '../lib/accountContext'
import { DestinationIcon } from '../components/DestinationLink'
import {
  TbRadio as Radio,
  TbUsers as Users,
  TbArrowUpRight as ArrowUpRight,
  TbPin as Pin,
  TbClipboardCheck as ClipboardCheck,
  TbSitemap as Network,
  TbCircleCheck as CircleCheck,
  TbProgress as Progress,
  TbAlarm as Alarm,
  TbCalendarStats as CalendarStats,
  TbSpeakerphone as Megaphone,
} from 'react-icons/tb'

function LiveBanner({ event }: LiveBannerProps) {
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

/** Show the member feed, summary counts, workspaces, responsibilities and upcoming activities. */
export function Home() {
  const feed = useApi('/feed')
  const groups = useApi('/groups')
  const workspaces = useApi('/member/workspace')
  const { account } = useAccount()

  return (
    <div className="homePage">
      <Async query={feed} skeletons={4}>
        {(data: Doc) => (
          <>
            {data.live && <LiveBanner event={data.live} />}
            <PageHeader
              title="Your Hub"
              icon={Network}
              action={
                <A href="/calendar" className="btn btn-secondary">
                  <CalendarStats size={17} aria-hidden /> Calendar
                </A>
              }
            />

            <div className="homeSummary" aria-label="Hub overview">
              <div className="homeMetrics">
                <MissionMetric
                  value={String(data.counts?.closing ?? data.closing.length)}
                  label="Closing soon"
                  href="/submissions"
                  tone={data.closing.length > 0 ? 'warn' : undefined}
                  icon={Alarm}
                />
                <MissionMetric
                  value={String(data.counts?.week ?? data.week.length)}
                  label="Events this week"
                  href="/calendar"
                  icon={CalendarStats}
                />
                <MissionMetric
                  value={String(data.counts?.coys ?? data.coys.length)}
                  label="COYs listed"
                  href="/coys"
                  icon={Megaphone}
                />
              </div>
            </div>

            <WorkspaceSection groups={groups} workspaces={workspaces} />
            {canManageGroups(account) && (
              <Section label="Group support">
                <A href="/book" className="card cardTight roleHubCard">
                  <span className="iconTile" aria-hidden>
                    <ClipboardCheck size={20} strokeWidth={1.75} />
                  </span>
                  <span className="roleHubCopy">
                    <strong>Book a group support call</strong>
                    <small>Get help with your group’s page and member induction.</small>
                  </span>
                </A>
              </Section>
            )}
            <ResponsibilitySection account={account} />

            {data.closing.length > 0 && (
              <Section
                label="Closing soon"
                action={
                  <A href="/submissions" className="metaMuted">
                    All →
                  </A>
                }
              >
                <div className="dashboardCardGrid">
                  {data.closing.map((x: AnyValue) => (
                    <ClosingCard key={`${x.kind}-${x.slug}`} item={x} />
                  ))}
                </div>
              </Section>
            )}

            {data.pinned.length > 0 && (
              <Section label="Pinned">
                <div className="pinnedStack">
                  {data.pinned.map((a: AnyValue) => (
                    <div key={a.slug || a.title} className="pinnedBanner">
                      <span className="pinnedBannerIcon" aria-hidden>
                        <Pin size={16} strokeWidth={2} />
                      </span>
                      <div className="pinnedBannerCopy">
                        <h3 className="pinnedBannerTitle">{a.title}</h3>
                        <p className="pinnedBannerBody">{a.body}</p>
                      </div>
                      {(a.ctaUrl || a.ctaDeadlineAt) && (
                        <div className="announcementActions pinnedBannerActions">
                          {a.ctaDeadlineAt && (
                            <LifecycleTiming iso={a.ctaDeadlineAt} label="Closes" />
                          )}
                          {a.ctaUrl && (
                            <a
                              className="btn btn-primary btn-sm"
                              href={a.ctaUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <DestinationIcon url={a.ctaUrl} size={16} />
                              {a.ctaLabel || 'Open'}
                            </a>
                          )}
                        </div>
                      )}
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
                <div className="dashboardCardGrid">
                  {data.week.map((e: AnyValue) => (
                    <EventCard key={e.slug} event={e} />
                  ))}
                </div>
              ) : (
                <p className="meta">No meetings are scheduled this week.</p>
              )}
            </Section>

            {data.coys.length > 0 && (
              <Section
                label="COYs"
                action={
                  <A href="/coys" className="metaMuted">
                    All →
                  </A>
                }
              >
                <div className="dashboardCardGrid">
                  {data.coys.map((c: AnyValue) => (
                    <CoyCard key={c.slug} coy={c} />
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

function ResponsibilitySection({ account }: ResponsibilitySectionProps) {
  // same routes and rules as the sidebar's mandate, team and operator sections
  const responsibilities = responsibilitiesFor(viewerOf(account))
  if (!responsibilities.length) return null

  return (
    <Section label="Your responsibilities">
      <div className="roleHubGrid">
        {responsibilities.map(({ href, label, summary, icon: Icon }) => (
          <A key={href} href={href} className="card cardTight roleHubCard">
            <span className="iconTile" aria-hidden>
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span className="roleHubCopy">
              <strong>{label}</strong>
              <span className="meta">{summary}</span>
            </span>
            <ArrowUpRight size={17} strokeWidth={1.75} aria-hidden />
          </A>
        ))}
      </div>
    </Section>
  )
}

/** Combine group and workspace queries to show joined groups and their setup status, or a join link. */
function WorkspaceSection({ groups, workspaces }: WorkspaceSectionProps) {
  return (
    <Section
      label="Your workspaces"
      action={
        <A href="/groups" className="metaMuted">
          Manage →
        </A>
      }
    >
      <Async query={workspaces} skeletons={2}>
        {(workspaceData: AnyValue) => (
          <Async query={groups} skeletons={2}>
            {(groupData: AnyValue) => {
              const progressBySlug = new Map<AnyValue, AnyValue>(
                workspaceData.items.map((item: Doc) => [item.wg_slug, item]),
              )
              const joined = groupData.items.filter((group: Doc) => progressBySlug.has(group.slug))
              if (!joined.length) {
                return (
                  <A className="workspaceStart" href="/groups">
                    <Users size={20} aria-hidden />
                    <span>Join a working group</span>
                    <ArrowUpRight size={18} aria-hidden />
                  </A>
                )
              }
              return (
                <div className="dashboardCardGrid">
                  {joined.map((group: Doc) => {
                    const progress = progressBySlug.get(group.slug)
                    const ready = Boolean(progress?.presentation_ok && progress?.rules_ok)
                    return (
                      <GroupCard
                        key={group.slug}
                        group={group}
                        href={`/workspace/${group.slug}`}
                        statusLabel={ready ? 'Workspace ready' : 'Finish setup'}
                        statusIcon={ready ? CircleCheck : Progress}
                      />
                    )
                  })}
                </div>
              )
            }}
          </Async>
        )}
      </Async>
    </Section>
  )
}
