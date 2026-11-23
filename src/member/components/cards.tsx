import type { DirectoryContact } from '../../shared/contracts'
import type {
  ClosingItem,
  CoySummary,
  EventSummary,
  GroupSummary,
  SubmissionSummary,
} from '../../shared/contracts'
import { createElement, type ElementType, type MouseEventHandler } from 'react'
import type { FilterState } from '../lib/filterState'

type ButtonClick = MouseEventHandler<HTMLButtonElement>

interface EntityHeaderProps {
  title?: string
  status?: string | null
  statusFilterState?: FilterState
  onStatusFilter?: ButtonClick
  children?: import('react').ReactNode
}

interface LinkedEntityCardProps {
  href?: string
  label?: string
  className?: string
  children?: import('react').ReactNode
}

interface CardScheduleProps {
  iso: string
  label?: string
}

interface EventCardProps {
  event: EventSummary
}

interface SubmissionCardProps {
  sub: SubmissionSummary
  statusFilterState?: FilterState
  groupFilterState?: FilterState
  onStatusFilter?: ButtonClick
  onGroupFilter?: ButtonClick
}

interface ClosingCardProps {
  item: ClosingItem
}

interface CoyCardProps {
  coy: CoySummary
  typeFilterState?: FilterState
  regionFilterState?: FilterState
  onTypeFilter?: ButtonClick
  onRegionFilter?: ButtonClick
}

interface GroupCardProps {
  group: GroupSummary
  href?: string
  statusLabel?: string | null
  statusIcon?: ElementType
  topicFilterState?: FilterState
  onTopicFilter?: ButtonClick
}

interface ContactCardProps {
  contact: DirectoryContact
}

interface WorkingGroupContactCardProps {
  contact: DirectoryContact
}

import { A, StatusChip, FilterChip, LifecycleTiming } from './ui'
import { DateStamp } from './DateStamp'
import { fmtMoment, fmtDateRange } from '../lib/time'
import { useWorkingGroups } from '../lib/workingGroups'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { regionLabel, regionFilterPrefix } from '../lib/regions'
import { DestinationIcon } from './DestinationLink'
import { coyDisplayStatus } from '../../shared/coyStatus'
import {
  TbCalendar as CalendarDays,
  TbMapPin as MapPin,
  TbUsersGroup as UsersRound,
  TbArrowUpRight as ArrowUpRight,
  TbBuildingCommunity as Building,
  TbGavel as Gavel,
  TbGlobe as Globe,
  TbMap as Map,
  TbMessageCircle as MessageCircle,
  TbPresentation as Presentation,
  TbSitemap as Network,
  TbMail as Mail,
  TbPhone as Phone,
} from 'react-icons/tb'

const EVENT_ICONS: Record<string, ElementType> = {
  constituency_call: UsersRound,
  wg_call: UsersRound,
  wgf: MessageCircle,
  unfccc_session: Globe,
  webinar: Presentation,
  coordination: Network,
}

const COY_ICONS: Record<string, ElementType> = { lcoy: MapPin, rcoy: Map, coy: Globe }

export const EVENT_LABEL: Record<string, string> = {
  constituency_call: 'Constituency',
  wg_call: 'WG',
  wgf: 'Forum',
  unfccc_session: 'UNFCCC',
  webinar: 'Webinar',
  workshop: 'Workshop',
  coordination: 'Coordination',
}

const COY_LABEL: Record<string, string> = { lcoy: 'LCOY', rcoy: 'RCOY', coy: 'COY' }

function EntityHeader({
  title,
  status,
  statusFilterState,
  onStatusFilter,
  children,
}: EntityHeaderProps) {
  return (
    <div className="entityCardHeader">
      <div className="entityCardHeading">
        <h3>{title}</h3>
        {(status || children) && (
          <div className="entityCardTags entityCardHeaderTags">
            {status && (
              <StatusChip
                status={status}
                filterState={statusFilterState}
                onClick={onStatusFilter}
              />
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

function LinkedEntityCard({ href, label, className = '', children }: LinkedEntityCardProps) {
  return (
    <article className={`card entityCard linkedEntityCard ${className}`.trim()}>
      <A href={href} className="entityCardLinkOverlay" aria-label={label} />
      {children}
    </article>
  )
}

export function CardSchedule({ iso, label }: CardScheduleProps) {
  const moment = fmtMoment(iso)
  return (
    <div className="entityCardSchedule">
      <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
      <div>
        <span className="entityCardMetaLabel">{label}</span>
        <span>
          {moment.stamp} {moment.localZone}
        </span>
      </div>
    </div>
  )
}

export function EventCard({ event }: EventCardProps) {
  const TypeIcon = EVENT_ICONS[event.type] || CalendarDays
  const GroupIcon = event.wg?.slug ? workingGroupIcon(event.wg.slug) : null
  return (
    <article className="card entityCard eventCard linkedEntityCard">
      <A
        href={`/calendar/${event.slug}`}
        className="entityCardLinkOverlay"
        aria-label={`Open ${event.title}`}
      />
      <div className="eventCardIdentity">
        <DateStamp iso={event.startsAt} />
        <EntityHeader title={event.title}>
          <FilterChip icon={TypeIcon}>{EVENT_LABEL[event.type] || event.type}</FilterChip>
          {event.wg && <FilterChip icon={GroupIcon}>{event.wg.name}</FilterChip>}
        </EntityHeader>
      </div>
      <div className="entityCardFooter">
        <CardSchedule iso={event.startsAt} label="Starts" />
      </div>
    </article>
  )
}

export function SubmissionCard({
  sub,
  statusFilterState,
  groupFilterState,
  onStatusFilter,
  onGroupFilter,
}: SubmissionCardProps) {
  return (
    <LinkedEntityCard href={`/submissions/${sub.slug}`} label={`Open ${sub.title}`}>
      <EntityHeader title={sub.title}>
        {sub.wg && (
          <FilterChip
            state={groupFilterState}
            icon={workingGroupIcon(sub.wg.slug)}
            onClick={onGroupFilter}
          >
            {sub.wg.name}
          </FilterChip>
        )}
      </EntityHeader>
      <LifecycleTiming
        status={sub.status}
        iso={sub.deadlineAt}
        statusFilterState={statusFilterState}
        onStatusFilter={onStatusFilter}
      />
    </LinkedEntityCard>
  )
}

// Home closing-soon item: either a submission or a DMP decision.
export function ClosingCard({ item }: ClosingCardProps) {
  const isDecision = item.kind === 'decision'
  const href = `${isDecision ? '/council' : '/submissions'}/${item.slug}`
  return (
    <A href={href} className="card entityCard">
      <EntityHeader title={item.title}>
        {isDecision && <FilterChip icon={Gavel}>Decision</FilterChip>}
      </EntityHeader>
      <LifecycleTiming status={item.status} iso={item.deadlineAt} />
    </A>
  )
}

export function CoyCard({
  coy,
  typeFilterState,
  regionFilterState,
  onTypeFilter,
  onRegionFilter,
}: CoyCardProps) {
  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  const CoyIcon = COY_ICONS[coy.type] || Globe
  return (
    <LinkedEntityCard href={`/coys/${coy.slug}`} label={`Open ${coy.title}`} className="coyCard">
      <EntityHeader title={coy.title} status={coyDisplayStatus(coy)}>
        <FilterChip state={typeFilterState} icon={CoyIcon} onClick={onTypeFilter}>
          {COY_LABEL[coy.type]}
        </FilterChip>
        {coy.region && (
          <FilterChip
            state={regionFilterState}
            prefix={regionFilterPrefix(coy.region, regionLabel(coy.region))}
            onClick={onRegionFilter}
          >
            {regionLabel(coy.region)}
          </FilterChip>
        )}
      </EntityHeader>
      <div className="entityCardFooter">
        <p className="entityCardMetaRow">
          <MapPin size={16} strokeWidth={1.75} aria-hidden />
          <span>{place || 'Location to be announced'}</span>
        </p>
        <p className="entityCardMetaRow">
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
          <span>{fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}</span>
        </p>
        {coy.organizerName && (
          <p className="entityCardMetaRow">
            <Building size={16} strokeWidth={1.75} aria-hidden />
            <span>{coy.organizerName}</span>
          </p>
        )}
      </div>
    </LinkedEntityCard>
  )
}

export function GroupCard({
  group,
  href,
  statusLabel,
  statusIcon: StatusIcon,
  topicFilterState,
  onTopicFilter,
}: GroupCardProps) {
  const destination = href || `/groups/${group.slug}`
  const wg = useWorkingGroups()
  const topicLabel = group.topic ? wg.topicLabel(group.topic) : null
  return (
    <div className="card cardTight groupCard entityCard" data-wg={group.slug}>
      <A
        href={destination}
        className="groupCardLinkOverlay"
        aria-label={`Open ${group.name}${href ? ' workspace' : ''}`}
      />
      <div className="groupCardBody">
        <div className="groupCardCopy">
          <div className="groupCardTitle">
            {createElement(workingGroupIcon(group.slug), {
              size: 19,
              strokeWidth: 1.75,
              'aria-hidden': true,
            })}
            <h3>{group.name}</h3>
          </div>
          <p className="meta groupCardFocus">{group.focusLine}</p>
        </div>
      </div>
      {group.cadenceNote && (
        <p className="entityCardMetaRow">
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
          <span>{group.cadenceNote}</span>
        </p>
      )}
      <div className="entityCardTags groupCardTags">
        {statusLabel && (
          <FilterChip tone="accent" icon={StatusIcon}>
            {statusLabel}
          </FilterChip>
        )}
        {topicLabel && (
          <FilterChip state={topicFilterState} onClick={onTopicFilter}>
            {topicLabel}
          </FilterChip>
        )}
      </div>
    </div>
  )
}

const holderNames = (contact: DirectoryContact): string[] =>
  (contact.holders || []).flatMap((holder) => (holder.displayName ? [holder.displayName] : []))

export function ContactCard({ contact }: ContactCardProps) {
  const rawChannel = contact.channelValue?.trim()
  const channel =
    rawChannel?.replace(/^mailto:/i, '').toLowerCase() === contact.publicEmail?.trim().toLowerCase()
      ? null
      : rawChannel
  const channelHref = channel
    ? /^https?:\/\//i.test(channel)
      ? channel
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(channel)
        ? `mailto:${channel}`
        : /^\+?[\d\s()-]+$/.test(channel)
          ? `tel:${channel.replace(/[^+\d]/g, '')}`
          : null
    : null
  const holders = holderNames(contact)
  const hasDirectContact = Boolean(holders.length || contact.publicEmail || channel)

  return (
    <div className="card cardTight contactCard">
      <h3 className="contactRole">{contact.roleTitle}</h3>
      {contact.description && <p className="meta contactDescription">{contact.description}</p>}
      {hasDirectContact ? (
        <div className="contactDetails">
          {holders.length > 0 && <p className="meta contactPerson">{holders.join(', ')}</p>}
          {contact.publicEmail && (
            <a className="inlineLink contactChannel" href={`mailto:${contact.publicEmail}`}>
              <Mail size={15} strokeWidth={1.75} aria-hidden />
              {contact.publicEmail}
            </a>
          )}
          {channel &&
            (channelHref ? (
              <a
                className="inlineLink contactChannel"
                href={channelHref}
                target={channelHref.startsWith('http') ? '_blank' : undefined}
                rel={channelHref.startsWith('http') ? 'noopener noreferrer' : undefined}
              >
                {channelHref.startsWith('tel:') ? (
                  <Phone size={15} strokeWidth={1.75} aria-hidden />
                ) : (
                  <DestinationIcon url={channelHref} size={15} />
                )}
                {channel}
              </a>
            ) : (
              <p className="meta">{channel}</p>
            ))}
        </div>
      ) : (
        <p className="metaMuted contactUnavailable">No direct contact has been published yet.</p>
      )}
    </div>
  )
}

export function WorkingGroupContactCard({ contact }: WorkingGroupContactCardProps) {
  const slug = contact.wg?.slug
  const name = contact.wg?.name || contact.roleTitle.replace(/\s+WG.*$/i, '')
  // holders come from authority records on the server, never from the row's text
  const holders = holderNames(contact)
  return (
    <A
      href={`/groups/${slug}`}
      className="card cardTight workingGroupContactCard"
      aria-label={`Open ${name} working group`}
    >
      <div className="workingGroupContactCopy">
        <div className="workingGroupContactTitle">
          <span className="workingGroupContactIcon" aria-hidden>
            {createElement(workingGroupIcon(slug ?? ''), { size: 18, strokeWidth: 1.75 })}
          </span>
          <h3>{name}</h3>
        </div>
        <p className="meta">
          {!contact.holders
            ? 'Sign in to see the Contact Points.'
            : holders.length
              ? `Contact Points: ${holders.join(', ')}`
              : 'No Contact Point recorded yet.'}
        </p>
        <span className="workingGroupContactMeta">
          {contact.publicEmail || 'Contact details and channels'}
        </span>
      </div>
      <ArrowUpRight
        className="workingGroupContactAction"
        size={17}
        strokeWidth={1.75}
        aria-hidden
      />
    </A>
  )
}
