'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import {
  TbCalendar,
  TbCalendarClock,
  TbCalendarPlus,
  TbChevronRight,
  TbExternalLink,
  TbFileDescription,
  TbFileText,
  TbGlobe,
  TbHeartHandshake,
  TbInfoCircle,
  TbLink,
  TbMapPin,
  TbPlayerPlay,
  TbShare,
  TbShieldCheck,
  TbSpeakerphone,
  TbTag,
  TbUsers,
  TbVideo,
} from 'react-icons/tb'
import {
  NotionSidePeek,
  NotionCallout,
  type NotionPeekTab,
  type NotionProperty,
} from './NotionSidePeek'
import { A, Button, LifecycleTiming, StatusChip } from './ui'
import { AddToCalendar } from './AddToCalendar'
import { DestinationIcon } from './DestinationLink'
import { fmtDual, fmtDateRange } from '../lib/time'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { regionLabel } from '../lib/regions'
import { resolveCoyStatus, coyApplicationsAreOpen } from '../../shared/coyStatus'
import type { AnyValue, Doc } from '../lib/types'

// ── Peek framework ─────────────────────────────────────────
// Every entity peek is a declarative descriptor rendered by the same
// wrapper, so panels can only diverge where the entity genuinely does.

type PeekIcon = ComponentType<{
  size?: number
  strokeWidth?: number
  className?: string
  'aria-hidden'?: boolean
}>

interface PeekContext<T, P> {
  item: T
  extras: P
  /** Timestamp captured when the panel mounted (for live/concluded state). */
  now: number
  onClose: () => void
}

interface PeekDef<T, P = object> {
  eyebrow: (ctx: PeekContext<T, P>) => string
  title: (ctx: PeekContext<T, P>) => string
  subtitle?: (ctx: PeekContext<T, P>) => ReactNode
  icon?: PeekIcon | ReactNode
  /** Resolves the icon per item when it depends on record fields. */
  iconFor?: (ctx: PeekContext<T, P>) => PeekIcon | ReactNode
  badge?: (ctx: PeekContext<T, P>) => ReactNode
  fullPageHref?: (ctx: PeekContext<T, P>) => string
  copyUrl?: (ctx: PeekContext<T, P>) => string | undefined
  actions?: (ctx: PeekContext<T, P>) => ReactNode
  properties: (ctx: PeekContext<T, P>) => NotionProperty[]
  tabs: (ctx: PeekContext<T, P>) => NotionPeekTab[]
}

function createPeek<T extends AnyValue, P = object>(def: PeekDef<T, P>) {
  // Keyed inner component: `now` is captured per opened entity, not per
  // page mount, so live/concluded state is fresh each time a peek opens.
  function PeekBody({ item, extras, onClose }: { item: T; extras: P; onClose: () => void }) {
    const [now] = useState(() => Date.now())
    const ctx: PeekContext<T, P> = { item, extras, now, onClose }
    const icon = def.icon ?? def.iconFor?.(ctx)
    return (
      <NotionSidePeek
        isOpen
        onClose={onClose}
        eyebrow={def.eyebrow(ctx)}
        title={def.title(ctx)}
        subtitle={def.subtitle?.(ctx)}
        icon={icon}
        badge={def.badge?.(ctx)}
        fullPageHref={def.fullPageHref?.(ctx)}
        copyUrl={def.copyUrl?.(ctx)}
        actions={def.actions?.(ctx)}
        properties={def.properties(ctx)}
        tabs={def.tabs(ctx)}
      />
    )
  }

  return function EntityPeek(props: { item: T | null; onClose: () => void } & P) {
    const { item, onClose, ...rest } = props
    if (!item) return null
    const doc = item as Doc
    return (
      <PeekBody
        key={doc.id ?? doc.slug ?? doc.url ?? doc.title}
        item={item}
        extras={rest as unknown as P}
        onClose={onClose}
      />
    )
  }
}

// Declarative property rows: null/false entries drop out, so a missing
// field produces no row rather than fabricated fallback copy.
function properties(rows: Array<NotionProperty | null | false>): NotionProperty[] {
  return rows.filter((row): row is NotionProperty => Boolean(row))
}

function prop(label: string, icon: PeekIcon, value: ReactNode): NotionProperty {
  return { label, icon, value }
}

function text(value: string): ReactNode {
  return <span>{value}</span>
}

function mono(value: string): ReactNode {
  return <span className="mono">{value}</span>
}

const external = { target: '_blank', rel: 'noreferrer' } as const

// ── Opportunity Peek ─────────────────────────────────────────

const OPPORTUNITY_KINDS: Record<string, string> = {
  event: 'Event',
  workshop: 'Workshop',
  hackathon: 'Hackathon',
  opportunity: 'Opportunity',
  call: 'Open call',
  training: 'Training',
}

const OPPORTUNITY_FORMATS: Record<string, string> = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Hybrid',
}

const opportunityPeek: PeekDef<AnyValue> = {
  eyebrow: ({ item }) =>
    `Opportunities › ${OPPORTUNITY_KINDS[item.kind] || item.kind || 'Opportunity'}`,
  title: ({ item }) => item.title,
  subtitle: ({ item }) => item.organizationName,
  icon: TbSpeakerphone,
  badge: ({ item }) => (
    <span className="chip chip-accent">
      {OPPORTUNITY_KINDS[item.kind] || item.kind || 'Opportunity'}
    </span>
  ),
  copyUrl: ({ item }) => item.linkUrl,
  properties: ({ item }) => {
    const formatLabel = OPPORTUNITY_FORMATS[item.format] || item.format
    const where = item.format === 'online' ? 'Online / Remote' : item.location
    const region = item.region ? regionLabel(item.region) : null
    return properties([
      prop(
        'Type',
        TbTag,
        <span className="chip chip-accent">
          {OPPORTUNITY_KINDS[item.kind] || item.kind || 'Opportunity'}
        </span>,
      ),
      formatLabel &&
        prop('Format', item.format === 'online' ? TbVideo : TbMapPin, text(formatLabel)),
      where && prop('Location', TbMapPin, text(where)),
      region && prop('Region', TbGlobe, text(region)),
      item.organizationName &&
        prop('Organisation', TbHeartHandshake, <strong>{item.organizationName}</strong>),
      item.deadlineAt &&
        prop('Application deadline', TbCalendarClock, mono(fmtDual(item.deadlineAt))),
      item.startsAt && prop('Commences', TbCalendar, mono(fmtDual(item.startsAt))),
    ])
  },
  actions: ({ item }) =>
    item.linkUrl ? (
      <a className="btn btn-primary btn-sm" href={item.linkUrl} {...external}>
        <TbExternalLink size={15} strokeWidth={1.75} aria-hidden />
        <span>Apply now</span>
      </a>
    ) : null,
  tabs: ({ item }) => {
    const formatLabel = OPPORTUNITY_FORMATS[item.format] || item.format
    const where = item.format === 'online' ? 'Online / Remote' : item.location
    const region = item.region ? regionLabel(item.region) : null
    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: TbFileDescription,
        content: (
          <div className="notionTabContent">
            {item.summary && (
              <NotionCallout icon={TbInfoCircle} tone="accent">
                <p>{item.summary}</p>
              </NotionCallout>
            )}
            <div className="notionSection">
              <h4 className="notionSectionHeading">Key particulars</h4>
              <ul className="notionBulletList">
                {formatLabel && (
                  <li>
                    <strong>Delivery mode:</strong> {formatLabel}
                    {where && item.format !== 'online' ? ` (${where})` : ''}
                  </li>
                )}
                {region && (
                  <li>
                    <strong>Regional scope:</strong> {region}
                  </li>
                )}
                {item.startsAt && (
                  <li>
                    <strong>Commencement date:</strong> {fmtDual(item.startsAt)}
                  </li>
                )}
                {item.deadlineAt && (
                  <li>
                    <strong>Closing date:</strong> {fmtDual(item.deadlineAt)}
                  </li>
                )}
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'apply',
        label: 'Application & timeline',
        icon: TbExternalLink,
        content: (
          <div className="notionTabContent">
            {item.deadlineAt && (
              <div className="notionCardGroup">
                <LifecycleTiming iso={item.deadlineAt} label="Apply by" showCountdown />
              </div>
            )}
            {item.linkUrl && (
              <div className="notionSection">
                <h4 className="notionSectionHeading">Submission portal</h4>
                <p className="notionBodyText">
                  Applications are managed by {item.organizationName || 'the organising body'}{' '}
                  through its own portal.
                </p>
                <div className="notionActionRow">
                  <a className="btn btn-primary btn-lg" href={item.linkUrl} {...external}>
                    <TbExternalLink size={18} strokeWidth={1.75} aria-hidden />
                    <span>Open application portal</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'actions',
        label: 'Actions & share',
        icon: TbShare,
        content: (
          <div className="notionTabContent">
            <div className="notionActionButtonsList">
              {item.deadlineAt && (
                <div className="notionCalendarActionWrap">
                  <AddToCalendar
                    event={{
                      title: `Deadline: ${item.title}`,
                      description: `${item.summary || ''}\n\nApply: ${item.linkUrl || ''}`,
                      startsAt: item.deadlineAt,
                      endsAt: item.deadlineAt,
                    }}
                  />
                </div>
              )}
              {item.linkUrl && (
                <a className="btn btn-secondary" href={item.linkUrl} {...external}>
                  <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                  <span>Direct link</span>
                </a>
              )}
            </div>
          </div>
        ),
      },
    ]
  },
}

export const OpportunityPeek = createPeek(opportunityPeek)

// ── Event Peek ───────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  constituency_call: 'Constituency call',
  wg_call: 'Working Group call',
  wgf: 'Working Group Forum',
  unfccc_session: 'UNFCCC Session',
  webinar: 'Webinar',
  workshop: 'Workshop',
  coordination: 'Coordination meeting',
}

const eventPeek: PeekDef<AnyValue> = {
  eyebrow: ({ item }) => `Calendar › ${EVENT_TYPE_LABELS[item.type] || item.type || 'Event'}`,
  title: ({ item }) => item.title,
  subtitle: ({ item }) => (item.wg ? `${item.wg.name} WG` : undefined),
  icon: TbCalendar,
  fullPageHref: ({ item }) => `/calendar/${item.slug}`,
  badge: ({ item, now }) => {
    const live = now >= Date.parse(item.startsAt) && now <= Date.parse(item.endsAt)
    return live ? (
      <StatusChip status="live_now" />
    ) : (
      <span className="chip chip-neutral">
        {EVENT_TYPE_LABELS[item.type] || item.type || 'Event'}
      </span>
    )
  },
  properties: ({ item, now }) => {
    const startMs = Date.parse(item.startsAt)
    const endMs = Date.parse(item.endsAt)
    const live = now >= startMs && now <= endMs
    const concluded = now > endMs
    const GroupIcon = item.wg?.slug ? workingGroupIcon(item.wg.slug) : TbUsers
    return properties([
      prop(
        'Type',
        TbTag,
        <span className="chip chip-neutral">
          {EVENT_TYPE_LABELS[item.type] || item.type || 'Event'}
        </span>,
      ),
      prop(
        'Status',
        TbCalendarClock,
        live ? (
          <StatusChip status="live_now" />
        ) : concluded ? (
          <span className="chip chip-neutral">Concluded</span>
        ) : (
          <span className="chip chip-accent">Upcoming</span>
        ),
      ),
      prop('Date & time', TbCalendar, mono(fmtDual(item.startsAt))),
      item.wg &&
        prop(
          'Working Group',
          GroupIcon,
          <A href={`/groups/${item.wg.slug}`} className="inlineLink">
            {item.wg.name}
          </A>,
        ),
      item.meetingUrl &&
        !concluded &&
        prop(
          'Meeting room',
          TbVideo,
          <a href={item.meetingUrl} {...external} className="inlineLink">
            Join link available
          </a>,
        ),
    ])
  },
  actions: ({ item, now }) =>
    item.meetingUrl && now <= Date.parse(item.endsAt) ? (
      <a className="btn btn-primary btn-sm" href={item.meetingUrl} {...external}>
        <TbVideo size={15} strokeWidth={1.75} aria-hidden />
        <span>Join call</span>
      </a>
    ) : null,
  tabs: ({ item, now }) => {
    const startMs = Date.parse(item.startsAt)
    const endMs = Date.parse(item.endsAt)
    const live = now >= startMs && now <= endMs
    const concluded = now > endMs
    const descriptionUrl = item.description
      ?.match(/https?:\/\/\S+/)?.[0]
      ?.replace(/[),.;:!?'">\]]+$/, '')
    const cleanDescription = item.description
      ?.replace(/\s*(?:Slides:\s*)?https?:\/\/\S+/i, '')
      .trim()
    const GroupIcon = item.wg?.slug ? workingGroupIcon(item.wg.slug) : TbUsers
    return [
      {
        id: 'overview',
        label: 'Overview & agenda',
        icon: TbFileDescription,
        content: (
          <div className="notionTabContent">
            {live && item.meetingUrl && (
              <NotionCallout icon={TbVideo} tone="accent">
                <strong>This meeting is live now.</strong> Use the join button below to take part.
              </NotionCallout>
            )}
            {cleanDescription ? (
              <div className="notionSection">
                <h4 className="notionSectionHeading">Meeting briefing</h4>
                <p className="notionBodyText">{cleanDescription}</p>
              </div>
            ) : (
              <p className="metaMuted">No agenda notes attached to this session.</p>
            )}
            {item.wg && (
              <div className="notionSection">
                <h4 className="notionSectionHeading">Working Group</h4>
                <div className="notionInlineCard">
                  <GroupIcon size={20} strokeWidth={1.75} aria-hidden />
                  <div>
                    <strong>{item.wg.name}</strong>
                  </div>
                  <A href={`/groups/${item.wg.slug}`} className="btn btn-ghost btn-sm" peek={false}>
                    View group
                  </A>
                </div>
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'join',
        label: 'Join & calendar',
        icon: TbCalendarPlus,
        content: (
          <div className="notionTabContent">
            <div className="notionSection">
              <h4 className="notionSectionHeading">Live participation</h4>
              {concluded ? (
                <p className="metaMuted">
                  This call has concluded.
                  {item.recordingUrl ? ' See the recording tab for past outputs.' : ''}
                </p>
              ) : (
                <div className="notionActionRow">
                  {item.meetingUrl && (
                    <a
                      className={`btn ${live ? 'btn-primary btn-glow' : 'btn-primary'}`}
                      href={item.meetingUrl}
                      {...external}
                    >
                      <TbVideo size={18} strokeWidth={1.75} aria-hidden />
                      <span>{live ? 'Join meeting — live now' : 'Join meeting'}</span>
                    </a>
                  )}
                  <AddToCalendar event={item} />
                </div>
              )}
            </div>
            {descriptionUrl && (
              <div className="notionSection">
                <h4 className="notionSectionHeading">Session materials</h4>
                <a className="btn btn-secondary" href={descriptionUrl} {...external}>
                  <DestinationIcon url={descriptionUrl} size={16} />
                  <span>Open linked material</span>
                </a>
              </div>
            )}
          </div>
        ),
      },
      ...(concluded && item.recordingUrl
        ? [
            {
              id: 'recording',
              label: 'Recording',
              icon: TbPlayerPlay,
              content: (
                <div className="notionTabContent">
                  <div className="notionSection">
                    <h4 className="notionSectionHeading">Archived recording</h4>
                    <p className="notionBodyText">The recording is available for review.</p>
                    <div className="notionActionRow">
                      <a className="btn btn-primary" href={item.recordingUrl} {...external}>
                        <TbPlayerPlay size={18} strokeWidth={1.75} aria-hidden />
                        <span>Watch session recording</span>
                      </a>
                    </div>
                  </div>
                </div>
              ),
            } satisfies NotionPeekTab,
          ]
        : []),
    ]
  },
}

export const EventPeek = createPeek(eventPeek)

// ── Working Group Peek ───────────────────────────────────────
// Descriptive copy tracks Governance Policy §4: Working Groups follow
// international climate negotiations, conduct research and policy
// analysis, and draft policy positions and submissions.

const groupPeek: PeekDef<AnyValue> = {
  eyebrow: () => 'Working Groups',
  title: ({ item }) => item.name,
  subtitle: ({ item }) => item.focusLine,
  iconFor: ({ item }) => workingGroupIcon(item.slug),
  fullPageHref: ({ item }) => `/groups/${item.slug}`,
  badge: () => <span className="chip chip-accent">Working Group</span>,
  properties: ({ item }) =>
    properties([
      item.focusLine && prop('Focus', TbTag, text(item.focusLine)),
      item.cadenceNote && prop('Meeting cadence', TbCalendarClock, text(item.cadenceNote)),
    ]),
  actions: ({ item }) => (
    <A href={`/groups/${item.slug}`} className="btn btn-primary btn-sm" peek={false}>
      <span>Open workspace</span>
    </A>
  ),
  tabs: ({ item }) => {
    const GroupIcon = workingGroupIcon(item.slug)
    return [
      {
        id: 'overview',
        label: 'Overview & mandate',
        icon: TbFileDescription,
        content: (
          <div className="notionTabContent">
            {item.focusLine && (
              <NotionCallout icon={GroupIcon} tone="accent">
                <p>{item.focusLine}</p>
              </NotionCallout>
            )}
            <div className="notionSection">
              <h4 className="notionSectionHeading">Constituency mandate</h4>
              <p className="notionBodyText">
                Working Groups follow international climate negotiations, conduct research and
                policy analysis, and draft policy positions and submissions.
              </p>
            </div>
            <div className="notionActionRow">
              <A href={`/groups/${item.slug}`} className="btn btn-primary" peek={false}>
                <span>Open full workspace</span>
                <TbChevronRight size={16} strokeWidth={2} aria-hidden />
              </A>
            </div>
          </div>
        ),
      },
    ]
  },
}

export const GroupPeek = createPeek(groupPeek)

// ── COY Peek ─────────────────────────────────────────────────

const coyPeek: PeekDef<AnyValue> = {
  eyebrow: ({ item }) => `COY Tracker › ${item.type?.toUpperCase() || 'COY'}`,
  title: ({ item }) => item.title,
  subtitle: ({ item }) => [item.city, item.country].filter(Boolean).join(', ') || undefined,
  icon: TbMapPin,
  fullPageHref: ({ item }) => `/coys/${item.slug}`,
  badge: ({ item }) => <StatusChip status={resolveCoyStatus(item)} />,
  properties: ({ item }) =>
    properties([
      prop(
        'Type',
        TbTag,
        <span className="chip chip-neutral">{item.type?.toUpperCase() || 'COY'}</span>,
      ),
      item.city || item.country
        ? prop('Location', TbMapPin, text([item.city, item.country].filter(Boolean).join(', ')))
        : null,
      prop('Dates', TbCalendar, mono(fmtDateRange(item.startsOn, item.endsOn, item.datesTbc))),
      prop('Status', TbShieldCheck, <StatusChip status={resolveCoyStatus(item)} />),
      item.region && prop('Region', TbGlobe, text(regionLabel(item.region))),
    ]),
  tabs: ({ item }) => [
    {
      id: 'overview',
      label: 'Overview & venue',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          <NotionCallout icon={TbMapPin} tone="accent">
            <strong>{item.type?.toUpperCase() || 'COY'}</strong>
            {[item.city, item.country].filter(Boolean).join(', ')
              ? ` — ${[item.city, item.country].filter(Boolean).join(', ')}`
              : ''}
          </NotionCallout>
          {item.applicationsCloseAt && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Application deadline</h4>
              <LifecycleTiming
                iso={item.applicationsCloseAt}
                label="Applications close"
                showCountdown={coyApplicationsAreOpen(item)}
              />
            </div>
          )}
          {item.registerUrl && (
            <div className="notionActionRow">
              <a className="btn btn-primary" href={item.registerUrl} {...external}>
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>Registration portal</span>
              </a>
            </div>
          )}
        </div>
      ),
    },
  ],
}

export const CoyPeek = createPeek(coyPeek)

// ── Submission Peek ──────────────────────────────────────────

const submissionPeek: PeekDef<AnyValue> = {
  eyebrow: () => 'Policy & Statements',
  title: ({ item }) => item.title,
  subtitle: ({ item }) => (item.wg ? `${item.wg.name} Working Group` : undefined),
  icon: TbFileText,
  fullPageHref: ({ item }) => `/submissions/${item.slug}`,
  badge: ({ item }) => <StatusChip status={item.status} />,
  properties: ({ item }) =>
    properties([
      prop('Status', TbShieldCheck, <StatusChip status={item.status} />),
      item.wg &&
        prop(
          'Working Group',
          TbUsers,
          <A href={`/groups/${item.wg.slug}`} className="inlineLink">
            {item.wg.name} WG
          </A>,
        ),
      item.deadlineAt && prop('Deadline', TbCalendarClock, mono(fmtDual(item.deadlineAt))),
    ]),
  tabs: ({ item }) => [
    {
      id: 'overview',
      label: 'Statement summary',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          {item.description && (
            <NotionCallout icon={TbFileText} tone="default">
              <p>{item.description}</p>
            </NotionCallout>
          )}
          {item.contributeNote && (
            <div className="notionSection">
              <h4 className="notionSectionHeading">Consultation guidance</h4>
              <p className="notionBodyText">{item.contributeNote}</p>
            </div>
          )}
          <div className="notionActionRow">
            {item.draftUrl && (
              <a className="btn btn-primary" href={item.draftUrl} {...external}>
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>Open drafting document</span>
              </a>
            )}
            {item.finalUrl && (
              <a className="btn btn-secondary" href={item.finalUrl} {...external}>
                <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                <span>View published statement</span>
              </a>
            )}
          </div>
        </div>
      ),
    },
  ],
}

export const SubmissionPeek = createPeek(submissionPeek)

// ── Resource Peek ────────────────────────────────────────────

const resourcePeek: PeekDef<AnyValue, { onReport?: (resource: AnyValue) => void }> = {
  eyebrow: () => 'Resource Hub',
  title: ({ item }) => item.title,
  subtitle: ({ item }) => item.publisher,
  icon: TbFileText,
  copyUrl: ({ item }) => item.url,
  badge: ({ item }) =>
    item.verification?.status === 'verified' ? (
      <span className="chip chip-accent">Verified</span>
    ) : (
      <span className="chip chip-neutral">Resource</span>
    ),
  properties: ({ item }) =>
    properties([
      prop('Type', TbTag, <span className="chip chip-accent">{item.type || 'Resource'}</span>),
      prop(
        'Verification',
        TbShieldCheck,
        item.verification?.status === 'verified' ? (
          <span className="chip chip-accent">Verified</span>
        ) : (
          <span className="chip chip-neutral">Community submitted</span>
        ),
      ),
      item.publisher && prop('Publisher', TbUsers, <strong>{item.publisher}</strong>),
      item.language && prop('Language', TbGlobe, text(item.language)),
      item.region && prop('Region', TbMapPin, text(regionLabel(item.region))),
      item.url &&
        prop(
          'Resource link',
          TbLink,
          <a href={item.url} {...external} className="inlineLink">
            Open material
          </a>,
        ),
    ]),
  tabs: ({ item, extras, onClose }) => {
    const verified = item.verification?.status === 'verified'
    const topics = item.topics || (item.topic ? [item.topic] : [])
    return [
      {
        id: 'overview',
        label: 'Summary & scope',
        icon: TbFileDescription,
        content: (
          <div className="notionTabContent">
            {item.summary && (
              <NotionCallout icon={TbFileText} tone="default">
                <p>{item.summary}</p>
              </NotionCallout>
            )}
            {topics.length > 0 && (
              <div className="notionSection">
                <h4 className="notionSectionHeading">Thematic areas</h4>
                <div className="notionPeekBadgesRow">
                  {topics.map((t: string) => (
                    <span key={t} className="chip chip-neutral">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="notionActionRow">
              {item.url && (
                <a className="btn btn-primary" href={item.url} {...external}>
                  <TbExternalLink size={16} strokeWidth={1.75} aria-hidden />
                  <span>Open resource</span>
                </a>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'verification',
        label: 'Verification & feedback',
        icon: TbShieldCheck,
        content: (
          <div className="notionTabContent">
            <div className="notionSection">
              <h4 className="notionSectionHeading">Verification</h4>
              <p className="notionBodyText">
                {verified
                  ? 'This resource has been reviewed and marked as verified.'
                  : 'This resource has not been verified.'}
              </p>
              {item.verification?.checkedAt && (
                <p className="metaMuted">
                  Last checked on {new Date(item.verification.checkedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {extras.onReport && (
              <div className="notionActionRow">
                <Button
                  variant="secondary"
                  onClick={() => {
                    onClose()
                    extras.onReport!(item)
                  }}
                >
                  Report an issue with this resource
                </Button>
              </div>
            )}
          </div>
        ),
      },
    ]
  },
}

export const ResourcePeek = createPeek(resourcePeek)
