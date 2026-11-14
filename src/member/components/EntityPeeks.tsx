'use client'

import { useState, type ComponentType, type ReactNode } from 'react'
import {
  TbBuilding,
  TbBroadcast,
  TbCalendar,
  TbCalendarClock,
  TbExternalLink,
  TbFileDescription,
  TbFileText,
  TbGlobe,
  TbInfoCircle,
  TbMapPin,
  TbPlayerPlay,
  TbUsers,
  TbVideo,
} from 'react-icons/tb'
import {
  NotionSidePeek,
  NotionCallout,
  type NotionPeekTab,
  type NotionProperty,
} from './NotionSidePeek'
import { A, LifecycleTiming, StatusChip, Timeline } from './ui'
import { AddToCalendar } from './AddToCalendar'
import { EVENT_LABEL } from './cards'
import { GroupPanel } from './GroupPanel'
import { CoyOrganiser } from './CoyOrganiser'
import { CoyLive } from './CoyLive'
import { DestinationIcon } from './DestinationLink'
import { fmtDual, fmtDateRange } from '../lib/time'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { regionLabel } from '../lib/regions'
import { useContentOptionLabels } from '../lib/documents'
import { OPPORTUNITY_FORMAT_LABELS, OPPORTUNITY_KIND_LABELS } from '../../shared/opportunities.js'
import { coyDisplayStatus, coyApplicationsAreOpen } from '../../shared/coyStatus'
import type { AnyValue, Doc } from '../lib/types'

// ── Peek framework ─────────────────────────────────────────
// Every entity is a declarative descriptor rendered by the same
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
  copyUrl?: (ctx: PeekContext<T, P>) => string | undefined
  actions?: (ctx: PeekContext<T, P>) => ReactNode
  properties: (ctx: PeekContext<T, P>) => NotionProperty[]
  tabs: (ctx: PeekContext<T, P>) => NotionPeekTab[]
}

function createPeek<T extends AnyValue, P = object>(def: PeekDef<T, P>) {
  // Keyed inner component: `now` is captured per opened entity, not per
  // page mount, so live/concluded state is fresh each time a opens.
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

const opportunityPeek: PeekDef<AnyValue> = {
  eyebrow: () => 'Opportunities',
  title: ({ item }) => item.title,
  subtitle: ({ item }) => item.organizationName,
  badge: ({ item }) => (
    <span className="chip chip-accent">
      {OPPORTUNITY_KIND_LABELS[item.kind] || item.kind || 'Opportunity'}
    </span>
  ),
  copyUrl: ({ item }) => item.linkUrl,
  // the organisation is the subtitle and the type is the chip, so neither repeats here
  properties: ({ item }) => {
    const formatLabel = OPPORTUNITY_FORMAT_LABELS[item.format] || item.format
    const where = item.format === 'online' ? 'Online / Remote' : item.location
    const region = item.region ? regionLabel(item.region) : null
    return properties([
      formatLabel &&
        prop('Format', item.format === 'online' ? TbVideo : TbMapPin, text(formatLabel)),
      where && prop('Location', TbMapPin, text(where)),
      region && prop('Region', TbGlobe, text(region)),
      item.deadlineAt &&
        prop('Application deadline', TbCalendarClock, mono(fmtDual(item.deadlineAt))),
      item.startsAt && prop('Commences', TbCalendar, mono(fmtDual(item.startsAt))),
    ])
  },
  actions: ({ item }) => (
    <>
      {item.linkUrl && (
        <a className="btn btn-primary btn-sm" href={item.linkUrl} {...external}>
          <TbExternalLink size={15} strokeWidth={1.75} aria-hidden />
          <span>Apply now</span>
        </a>
      )}
      {item.deadlineAt && (
        <AddToCalendar
          className="btn btn-secondary btn-sm"
          event={{
            title: `Deadline: ${item.title}`,
            description: `${item.summary || ''}\n\nApply: ${item.linkUrl || ''}`,
            startsAt: item.deadlineAt,
            endsAt: item.deadlineAt,
          }}
        />
      )}
    </>
  ),
  tabs: ({ item }) => [
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
          {item.deadlineAt && (
            <LifecycleTiming iso={item.deadlineAt} label="Apply by" showCountdown />
          )}
        </div>
      ),
    },
  ],
}

export const OpportunityPeek = createPeek(opportunityPeek)

// ── Event Peek ───────────────────────────────────────────────

// event type labels are staff-editable (content-options), so they ride in as extras; a type with no
// entry there falls back to the shared card label and never shows the raw slug
const eventTypeLabel = (type: string, labels: Record<string, string>) =>
  labels[type] ?? (EVENT_LABEL as Record<string, string>)[type] ?? 'Event'

const eventPhase = (item: AnyValue, now: number) => {
  if (now > Date.parse(item.endsAt)) return 'concluded'
  return now >= Date.parse(item.startsAt) ? 'live' : 'upcoming'
}

const eventPeek: PeekDef<AnyValue, { typeLabels: Record<string, string> }> = {
  eyebrow: () => 'Calendar',
  title: ({ item }) => item.title,
  // type and status appear once, as chips under the bar
  badge: ({ item, now, extras }) => {
    const phase = eventPhase(item, now)
    return (
      <>
        <span className="chip chip-neutral">{eventTypeLabel(item.type, extras.typeLabels)}</span>
        {phase === 'live' && <StatusChip status="live_now" />}
        {phase === 'concluded' && <span className="chip chip-neutral">Concluded</span>}
      </>
    )
  },
  properties: ({ item }) => {
    const GroupIcon = item.wg?.slug ? workingGroupIcon(item.wg.slug) : TbUsers
    return properties([
      prop('Date & time', TbCalendar, mono(fmtDual(item.startsAt))),
      item.wg &&
        prop(
          'Working Group',
          GroupIcon,
          <A href={`/groups/${item.wg.slug}`} className="inlineLink">
            {item.wg.name}
          </A>,
        ),
    ])
  },
  // one primary action for the moment the panel is opened: join, add to calendar, or watch
  actions: ({ item, now }) => {
    const phase = eventPhase(item, now)
    if (phase === 'concluded')
      return item.recordingUrl ? (
        <a className="btn btn-primary btn-sm" href={item.recordingUrl} {...external}>
          <TbPlayerPlay size={15} strokeWidth={1.75} aria-hidden />
          <span>Watch recording</span>
        </a>
      ) : null
    return (
      <>
        {item.meetingUrl && (
          <a
            className={`btn btn-primary btn-sm ${phase === 'live' ? 'btn-glow' : ''}`}
            href={item.meetingUrl}
            {...external}
          >
            <TbVideo size={15} strokeWidth={1.75} aria-hidden />
            <span>{phase === 'live' ? 'Join now' : 'Join call'}</span>
          </a>
        )}
        <AddToCalendar event={item} className="btn btn-secondary btn-sm" />
      </>
    )
  },
  // the briefing and its linked material: one block, so no tab bar
  tabs: ({ item }) => {
    const descriptionUrl = item.description
      ?.match(/https?:\/\/\S+/)?.[0]
      ?.replace(/[),.;:!?'">\]]+$/, '')
    const cleanDescription = item.description
      ?.replace(/\s*(?:Slides:\s*)?https?:\/\/\S+/i, '')
      .trim()
    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: TbFileDescription,
        content: (
          <div className="notionTabContent">
            {cleanDescription ? (
              <div className="notionSection">
                <h4 className="notionSectionHeading">Meeting briefing</h4>
                <p className="notionBodyText">{cleanDescription}</p>
              </div>
            ) : (
              <p className="metaMuted">No agenda notes attached to this session.</p>
            )}
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
    ]
  },
}

const EventPeekBody = createPeek(eventPeek)

export function EventPeek(props: { item: AnyValue | null; onClose: () => void }) {
  const { eventTypes } = useContentOptionLabels()
  return <EventPeekBody {...props} typeLabels={eventTypes} />
}

// ── Working Group Peek ───────────────────────────────────────
// Descriptive copy tracks Governance Policy §4: Working Groups follow
// international climate negotiations, conduct research and policy
// analysis, and draft policy positions and submissions.

const groupPeek: PeekDef<AnyValue> = {
  eyebrow: () => 'Working Groups',
  title: ({ item }) => item.name,
  subtitle: ({ item }) => item.focusLine,
  iconFor: ({ item }) => workingGroupIcon(item.slug),
  properties: ({ item }) =>
    properties([
      item.cadenceNote && prop('Meeting cadence', TbCalendarClock, text(item.cadenceNote)),
    ]),
  tabs: ({ item }) => [
    {
      id: 'overview',
      label: 'Overview',
      icon: TbFileDescription,
      content: (
        <div className="notionTabContent">
          <div className="notionSection">
            <h4 className="notionSectionHeading">Constituency mandate</h4>
            <p className="notionBodyText">
              Working Groups follow international climate negotiations, conduct research and policy
              analysis, and draft policy positions and submissions.
            </p>
          </div>
          <GroupPanel g={item} />
        </div>
      ),
    },
  ],
}

export const GroupPeek = createPeek(groupPeek)

// ── COY Peek ─────────────────────────────────────────────────

const coyPeek: PeekDef<AnyValue> = {
  eyebrow: () => 'COY Tracker',
  title: ({ item }) => item.title,
  subtitle: ({ item }) => [item.city, item.country].filter(Boolean).join(', ') || undefined,
  // type and status appear once, as chips under the bar
  badge: ({ item }) => (
    <>
      <span className="chip chip-neutral">{item.type?.toUpperCase() || 'COY'}</span>
      <StatusChip status={coyDisplayStatus(item)} />
    </>
  ),
  properties: ({ item }) =>
    properties([
      prop('Dates', TbCalendar, mono(fmtDateRange(item.startsOn, item.endsOn, item.datesTbc))),
      item.region && prop('Region', TbGlobe, text(regionLabel(item.region))),
    ]),
  actions: ({ item }) =>
    item.registerUrl ? (
      <a className="btn btn-primary btn-sm" href={item.registerUrl} {...external}>
        <TbExternalLink size={15} strokeWidth={1.75} aria-hidden />
        <span>Register</span>
      </a>
    ) : null,
  // a tab exists only for separately browsable content: the deadline is shown only when there is one
  tabs: ({ item }) => [
    ...(item.applicationsCloseAt
      ? [
          {
            id: 'overview',
            label: 'Overview',
            icon: TbFileDescription,
            content: (
              <div className="notionTabContent">
                <LifecycleTiming
                  iso={item.applicationsCloseAt}
                  label="Applications close"
                  showCountdown={coyApplicationsAreOpen(item)}
                />
              </div>
            ),
          } satisfies NotionPeekTab,
        ]
      : []),
    {
      id: 'organiser',
      label: 'Organiser & links',
      icon: TbBuilding,
      content: <CoyOrganiser coy={item} />,
    },
    ...(item.liveOps
      ? [
          {
            id: 'live',
            label: 'Live',
            icon: TbBroadcast,
            content: <CoyLive slug={item.slug} />,
          } satisfies NotionPeekTab,
        ]
      : []),
  ],
}

export const CoyPeek = createPeek(coyPeek)

const SUBMISSION_STEPS = ['Open', 'Drafting', 'Internal review', 'Submitted']
const SUBMISSION_STEP_INDEX: Record<string, number> = {
  open: 0,
  drafting: 1,
  internal_review: 2,
  submitted: 3,
  archived: 3,
}

function SubmissionProgress({ sub }: { sub: AnyValue }) {
  const archived = !['open', 'drafting', 'internal_review'].includes(sub.status)
  return (
    <div className="notionTabContent">
      <LifecycleTiming
        status={sub.status}
        iso={sub.deadlineAt}
        label={archived ? 'Submitted' : 'Deadline'}
        showCountdown={!archived}
      />
      <Timeline steps={SUBMISSION_STEPS} currentIndex={SUBMISSION_STEP_INDEX[sub.status] ?? 0} />
      {sub.unfcccUrl && (
        <div className="notionActionRow">
          <a className="btn btn-secondary" href={sub.unfcccUrl} {...external}>
            <DestinationIcon url={sub.unfcccUrl} size={16} />
            <span>UNFCCC reference</span>
          </a>
        </div>
      )}
    </div>
  )
}

// ── Submission Peek ──────────────────────────────────────────

const submissionPeek: PeekDef<AnyValue> = {
  eyebrow: () => 'Policy & Statements',
  title: ({ item }) => item.title,
  badge: ({ item }) => <StatusChip status={item.status} />,
  properties: ({ item }) =>
    properties([
      item.wg &&
        prop(
          'Working Group',
          TbUsers,
          <A href={`/groups/${item.wg.slug}`} className="inlineLink">
            {item.wg.name}
          </A>,
        ),
      item.deadlineAt && prop('Deadline', TbCalendarClock, mono(fmtDual(item.deadlineAt))),
    ]),
  actions: ({ item }) => (
    <>
      {item.draftUrl && (
        <a className="btn btn-primary btn-sm" href={item.draftUrl} {...external}>
          <TbExternalLink size={15} strokeWidth={1.75} aria-hidden />
          <span>Open drafting document</span>
        </a>
      )}
      {item.finalUrl && (
        <a className="btn btn-secondary btn-sm" href={item.finalUrl} {...external}>
          <TbExternalLink size={15} strokeWidth={1.75} aria-hidden />
          <span>View published statement</span>
        </a>
      )}
    </>
  ),
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
        </div>
      ),
    },
    {
      id: 'progress',
      label: 'Progress',
      icon: TbCalendarClock,
      content: <SubmissionProgress sub={item} />,
    },
  ],
}

export const SubmissionPeek = createPeek(submissionPeek)
