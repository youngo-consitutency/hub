import { useApi } from '../lib/api.js'
import {
  A,
  Async,
  LifecycleTiming,
  Section,
  Empty,
  PageHeader,
} from '../components/ui.jsx'
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
import { useAccount } from '../lib/accountContext.jsx'
import { DestinationIcon } from '../components/DestinationLink.jsx'
import {
  TbRadio as Radio,
  TbCalendarOff as CalendarOff,
  TbUsers as Users,
  TbArrowUpRight as ArrowUpRight,
  TbPin as Pin,
  TbBriefcase as Briefcase,
  TbClipboardCheck as ClipboardCheck,
  TbTools as PenTool,
  TbFilePencil as FilePenLine,
  TbSitemap as Network,
  TbBuilding as Building2,
  TbShield as Shield,
  TbCircleCheck as CircleCheck,
  TbProgress as Progress,
} from 'react-icons/tb'

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
  const workspaces = useApi('/member/workspace')
  const { account } = useAccount()

  return (
    <div>
      <Async query={feed} skeletons={4}>
        {(data) => (
          <>
            {data.live && <LiveBanner event={data.live} />}
            <PageHeader title="YOUNGO, in one place" />

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

            <WorkspaceSection groups={groups} workspaces={workspaces} />
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
                  {data.closing.map((x) => (
                    <ClosingCard key={`${x.kind}-${x.slug}`} item={x} />
                  ))}
                </div>
              </Section>
            )}

            {data.pinned.length > 0 && (
              <Section label="Pinned">
                <div className="pinnedStack">
                  {data.pinned.map((a) => (
                    <div key={a.slug || a.title} className="pinnedBanner">
                      <span className="pinnedBannerIcon" aria-hidden>
                        <Pin size={16} strokeWidth={2} />
                      </span>
                      <div className="pinnedBannerCopy">
                        <p className="pinnedBannerEyebrow">
                          Pinned announcement
                        </p>
                        <h3 className="pinnedBannerTitle">{a.title}</h3>
                        <p className="pinnedBannerBody">{a.body}</p>
                      </div>
                      {(a.ctaUrl || a.ctaDeadlineAt) && (
                        <div className="announcementActions pinnedBannerActions">
                          {a.ctaDeadlineAt && (
                            <LifecycleTiming
                              iso={a.ctaDeadlineAt}
                              label="Closes"
                            />
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
                  {data.week.map((e) => (
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
                  {data.coys.map((c) => (
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

function ResponsibilitySection({ account }) {
  const access = account?.access || {}
  const teamRoles = access.teamRoles || account?.teamRoles || []
  const capabilities = access.capabilities || []
  const isAdmin = account?.role === 'admin'
  const responsibilities = [
    {
      href: '/cp',
      label: 'WG Contact Point',
      detail: 'Manage your working groups, calls, channels, and member access.',
      icon: Briefcase,
      visible:
        account?.isWgContact ||
        access.wgAssignments?.length > 0 ||
        access.manageAllWgs,
    },
    {
      href: '/focal',
      label: 'Global Focal Point',
      detail: 'Coordinate constituency-wide mandates and UNFCCC-facing work.',
      icon: Network,
      visible: isAdmin || account?.role === 'focal_point',
    },
    {
      href: '/team/membership',
      label: 'Membership Team',
      detail: 'Review membership and onboarding work.',
      icon: ClipboardCheck,
      visible: teamRoles.includes('membership_team'),
    },
    {
      href: '/team/gys',
      label: 'GYS Policy Team',
      detail: 'Coordinate Global Youth Statement drafting.',
      icon: PenTool,
      visible: teamRoles.includes('gys_policy_team'),
    },
    {
      href: '/staff/content',
      label: 'Content operations',
      detail: 'Draft, review, and publish Hub content.',
      icon: FilePenLine,
      visible:
        capabilities.includes('content.draft') ||
        capabilities.includes('content.review'),
    },
    {
      href: '/ngo',
      label: 'NGO workspace',
      detail: 'Manage organisation participation and representatives.',
      icon: Building2,
      visible: access.ngo || isAdmin || account?.role === 'ngo_admin',
    },
    {
      href: '/admin',
      label: 'Platform administration',
      detail: 'Manage system-wide access and operations.',
      icon: Shield,
      visible: isAdmin,
    },
  ].filter((item) => item.visible)

  if (!responsibilities.length) return null

  return (
    <Section label="Your responsibilities">
      <div className="roleHubGrid">
        {responsibilities.map(({ href, label, detail, icon: Icon }) => (
          <A key={href} href={href} className="card cardTight roleHubCard">
            <span className="iconTile" aria-hidden>
              <Icon size={20} strokeWidth={1.75} />
            </span>
            <span className="roleHubCopy">
              <strong>{label}</strong>
              <span className="meta">{detail}</span>
            </span>
            <ArrowUpRight size={17} strokeWidth={1.75} aria-hidden />
          </A>
        ))}
      </div>
    </Section>
  )
}

function WorkspaceSection({ groups, workspaces }) {
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
        {(workspaceData) => (
          <Async query={groups} skeletons={2}>
            {(groupData) => {
              const progressBySlug = new Map(
                workspaceData.items.map((item) => [item.wg_slug, item]),
              )
              const joined = groupData.items.filter((group) =>
                progressBySlug.has(group.slug),
              )
              if (!joined.length) {
                return (
                  <Empty
                    icon={Users}
                    title="No group workspaces yet"
                    body="Choose a working group to open its member workspace."
                  />
                )
              }
              return (
                <div className="dashboardCardGrid">
                  {joined.map((group) => {
                    const progress = progressBySlug.get(group.slug)
                    const ready = Boolean(
                      progress?.presentation_ok && progress?.rules_ok,
                    )
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
