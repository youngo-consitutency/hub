import type { AnyValue, Doc } from '../lib/types'
import { createElement } from 'react'
interface EntityHeaderProps {
  title?: string
  status?: AnyValue
  statusFilterState?: AnyValue
  onStatusFilter?: AnyValue
  children?: import('react').ReactNode
}

interface LinkedEntityCardProps {
  href?: string
  label?: string
  className?: string
  onPeek?: () => void
  children?: import('react').ReactNode
}

interface CardScheduleProps {
  iso?: string
  label?: string
}

interface EventCardProps {
  event?: AnyValue
  onPeek?: (event: AnyValue) => void
}

interface SubmissionCardProps {
  sub?: AnyValue
  statusFilterState?: AnyValue
  groupFilterState?: AnyValue
  onStatusFilter?: AnyValue
  onGroupFilter?: AnyValue
  onPeek?: (sub: AnyValue) => void
}

interface ClosingCardProps {
  item?: AnyValue
}

interface CoyCardProps {
  coy?: AnyValue
  typeFilterState?: AnyValue
  regionFilterState?: AnyValue
  onTypeFilter?: AnyValue
  onRegionFilter?: AnyValue
  onPeek?: (coy: AnyValue) => void
}

interface GroupCardProps {
  group?: AnyValue
  href?: string
  statusLabel?: AnyValue
  statusIcon?: AnyValue
  topicFilterState?: AnyValue
  onTopicFilter?: AnyValue
  onPeek?: (group: AnyValue) => void
}

interface PersonCardProps {
  person?: AnyValue
  onTagClick?: AnyValue
  onOpen?: AnyValue
  expanded?: boolean
}

interface ContactCardProps {
  contact?: AnyValue
}

interface WorkingGroupContactCardProps {
  contact?: AnyValue
}

import { A, StatusChip, FilterChip, LifecycleTiming } from './ui'
import { DateStamp } from './DateStamp'
import { MemberAvatar } from './MemberAvatar'
import { fmtMoment, fmtDateRange } from '../lib/time'
import { useWorkingGroups } from '../lib/workingGroups'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { regionLabel, regionFilterPrefix } from '../lib/regions'
import { DestinationIcon } from './DestinationLink'
import {
  TbCalendar as CalendarDays,
  TbLayoutSidebarRightExpand,
  TbMapPin as MapPin,
  TbUsersGroup as UsersRound,
  TbArrowUpRight as ArrowUpRight,
  TbBuildingCommunity as Building,
  TbBriefcase as Briefcase,
  TbGavel as Gavel,
  TbGlobe as Globe,
  TbMap as Map,
  TbMessageCircle as MessageCircle,
  TbPresentation as Presentation,
  TbSitemap as Network,
  TbTag as Tag,
  TbMail as Mail,
  TbPhone as Phone,
  TbUser as User,
} from 'react-icons/tb'

const EVENT_ICONS = {
  constituency_call: UsersRound,
  wg_call: UsersRound,
  wgf: MessageCircle,
  unfccc_session: Globe,
  webinar: Presentation,
  coordination: Network,
}

const COY_ICONS = { lcoy: MapPin, rcoy: Map, coy: Globe }

const EVENT_LABEL = {
  constituency_call: 'Constituency',
  wg_call: 'WG',
  wgf: 'Forum',
  unfccc_session: 'UNFCCC',
  webinar: 'Webinar',
  workshop: 'Workshop',
  coordination: 'Coordination',
}

const COY_LABEL = { lcoy: 'LCOY', rcoy: 'RCOY', coy: 'COY' }

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
        <div className="entityCardTags entityCardHeaderTags">
          {status && (
            <StatusChip status={status} filterState={statusFilterState} onClick={onStatusFilter} />
          )}
          {children}
        </div>
      </div>
    </div>
  )
}

function LinkedEntityCard({
  href,
  label,
  className = '',
  onPeek,
  children,
}: LinkedEntityCardProps) {
  return (
    <article className={`card entityCard linkedEntityCard ${className}`.trim()}>
      {onPeek ? (
        <button
          type="button"
          className="entityCardLinkOverlay"
          aria-label={label}
          onClick={onPeek}
        />
      ) : (
        <A href={href} className="entityCardLinkOverlay" aria-label={label} peek />
      )}
      {onPeek && (
        <button
          type="button"
          className="cardPeekTrigger"
          onClick={(e) => {
            e.stopPropagation()
            onPeek()
          }}
          aria-label={`Side peek for ${label || 'item'}`}
        >
          <TbLayoutSidebarRightExpand size={13} strokeWidth={1.8} aria-hidden />
          <span>Side peek</span>
        </button>
      )}
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
          {moment.day} · {moment.localTime} {moment.localZone}
        </span>
      </div>
    </div>
  )
}

export function EventCard({ event, onPeek }: EventCardProps) {
  const TypeIcon = (EVENT_ICONS as AnyValue)[event.type] || CalendarDays
  const GroupIcon = event.wg?.slug ? workingGroupIcon(event.wg.slug) : null
  return (
    <article className="card entityCard eventCard linkedEntityCard">
      {onPeek ? (
        <button
          type="button"
          className="entityCardLinkOverlay"
          aria-label={`Open ${event.title}`}
          onClick={() => onPeek(event)}
        />
      ) : (
        <A
          href={`/calendar/${event.slug}`}
          className="entityCardLinkOverlay"
          aria-label={`Open ${event.title}`}
          peek
        />
      )}
      {onPeek && (
        <button
          type="button"
          className="cardPeekTrigger"
          onClick={(e) => {
            e.stopPropagation()
            onPeek(event)
          }}
          aria-label={`Side peek for ${event.title}`}
        >
          <TbLayoutSidebarRightExpand size={13} strokeWidth={1.8} aria-hidden />
          <span>Side peek</span>
        </button>
      )}
      <div className="eventCardIdentity">
        <DateStamp iso={event.startsAt} />
        <EntityHeader title={event.title}>
          <FilterChip icon={TypeIcon}>
            {(EVENT_LABEL as AnyValue)[event.type] || event.type}
          </FilterChip>
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
    <A href={href} className="card entityCard" peek>
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
  const CoyIcon = (COY_ICONS as AnyValue)[coy.type] || Globe
  return (
    <LinkedEntityCard href={`/coys/${coy.slug}`} label={`Open ${coy.title}`} className="coyCard">
      <EntityHeader title={coy.title} status={coy.status}>
        <FilterChip state={typeFilterState} icon={CoyIcon} onClick={onTypeFilter}>
          {(COY_LABEL as AnyValue)[coy.type]}
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
  onPeek,
}: GroupCardProps) {
  const destination = href || `/groups/${group.slug}`
  const wg = useWorkingGroups()
  const topicLabel = group.topic ? wg.topicLabel(group.topic) : null
  return (
    <div className="card cardTight groupCard entityCard">
      {onPeek ? (
        <button
          type="button"
          className="groupCardLinkOverlay"
          aria-label={`Open ${group.name}${href ? ' workspace' : ''}`}
          onClick={() => onPeek(group)}
        />
      ) : (
        <A
          href={destination}
          className="groupCardLinkOverlay"
          aria-label={`Open ${group.name}${href ? ' workspace' : ''}`}
          peek
        />
      )}
      {onPeek && (
        <button
          type="button"
          className="cardPeekTrigger"
          onClick={(e) => {
            e.stopPropagation()
            onPeek(group)
          }}
          aria-label={`Side peek for ${group.name}`}
        >
          <TbLayoutSidebarRightExpand size={13} strokeWidth={1.8} aria-hidden />
          <span>Side peek</span>
        </button>
      )}
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

export function PersonCard({ person, onTagClick, onOpen, expanded = false }: PersonCardProps) {
  return (
    <article className={`card cardTight personCard ${expanded ? 'personDetail' : ''}`}>
      <header className="personCardHeader">
        <MemberAvatar person={person} size="lg" />
        <div>
          <h3>
            {onOpen ? (
              <button
                className="personNameButton"
                type="button"
                aria-haspopup="dialog"
                onClick={onOpen}
              >
                {person.displayName}
              </button>
            ) : (
              person.displayName
            )}
          </h3>
          {person.pronouns && <p className="metaMuted">{person.pronouns}</p>}
        </div>
      </header>
      {person.headline && <p className="personHeadline">{person.headline}</p>}
      {person.bio && <p className="meta personBio">{person.bio}</p>}
      {(person.country || person.organization) && (
        <div className="personConnections">
          {person.country && (
            <p className="entityCardMetaRow">
              <MapPin size={15} aria-hidden />
              <span>{person.country}</span>
            </p>
          )}
          {person.organization?.name && (
            <p className="entityCardMetaRow">
              <Building size={15} aria-hidden />
              <span>
                {person.organization.name}
                {person.organization.seatRole ? ` · ${person.organization.seatRole}` : ''}
              </span>
            </p>
          )}
        </div>
      )}
      {(person.teams?.length > 0 || person.platformRole) && (
        <div className="personRoles" aria-label="Hub roles">
          <Briefcase size={15} aria-hidden />
          <span>
            {[
              ...person.teams.map((team: AnyValue) => team.name),
              person.platformRole?.replaceAll('_', ' '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      )}
      {person.workingGroups?.length > 0 && (
        <div className="entityCardTags personGroupTags" aria-label="Working groups">
          {person.workingGroups.slice(0, expanded ? undefined : 5).map((group: Doc) => {
            return (
              <A
                key={group.slug}
                href={`/groups/${group.slug}`}
                className="chip chip-neutral personLinkChip"
                peek
              >
                {createElement(workingGroupIcon(group.slug), {
                  size: 13,
                  strokeWidth: 1.75,
                  'aria-hidden': true,
                })}
                {group.name}
                {['contact', 'lead'].includes(group.role)
                  ? ` · ${group.role === 'contact' ? 'Contact Point' : 'Legacy access'}`
                  : ''}
              </A>
            )
          })}
        </div>
      )}
      {person.expertiseTags?.length > 0 && (
        <div className="entityCardTags personExpertiseTags" aria-label="Skills and topics">
          {person.expertiseTags.map((tag: AnyValue) =>
            onTagClick ? (
              <button
                key={tag}
                type="button"
                className="chip chip-accent personTagButton"
                onClick={() => onTagClick(tag)}
              >
                <Tag size={13} strokeWidth={1.75} aria-hidden />
                {tag}
              </button>
            ) : (
              <span key={tag} className="chip chip-accent">
                <Tag size={13} strokeWidth={1.75} aria-hidden />
                {tag}
              </span>
            ),
          )}
        </div>
      )}
    </article>
  )
}

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
  const hasDirectContact = Boolean(contact.personName || contact.publicEmail || channel)

  return (
    <div className="card cardTight contactCard">
      <h3 className="contactRole">{contact.roleTitle}</h3>
      {contact.description && <p className="meta contactDescription">{contact.description}</p>}
      {hasDirectContact ? (
        <div className="contactDetails">
          {contact.personName && (
            <p className="meta contactPerson">
              <User size={15} strokeWidth={1.75} aria-hidden />
              {contact.personName}
            </p>
          )}
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

function workingGroupContactSummary(contact: Doc) {
  const description = contact.description || ''
  const contactPointSentence = description
    .split(/(?=\s(?:Join:|Public entry:|LinkedIn|Email\s))/i)[0]
    .trim()
  if (/contact points?/i.test(contactPointSentence)) return contactPointSentence
  if (/not confirmed publicly/i.test(description)) {
    return 'Current Contact Point names have not been confirmed publicly.'
  }
  return 'Contact Point details and public channels are organised in the group page.'
}

export function WorkingGroupContactCard({ contact }: WorkingGroupContactCardProps) {
  const slug = contact.wg?.slug || contact.wg
  const name = contact.wg?.name || contact.roleTitle.replace(/\s+WG.*$/i, '')
  return (
    <A
      href={`/groups/${slug}`}
      className="card cardTight workingGroupContactCard"
      aria-label={`Open ${name} working group`}
      peek
    >
      <div className="workingGroupContactCopy">
        <div className="workingGroupContactTitle">
          <span className="workingGroupContactIcon" aria-hidden>
            {createElement(workingGroupIcon(slug), { size: 18, strokeWidth: 1.75 })}
          </span>
          <h3>{name}</h3>
        </div>
        <p className="meta">{workingGroupContactSummary(contact)}</p>
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
