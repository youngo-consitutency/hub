import { A, StatusChip, FilterChip, LifecycleTiming } from './ui.jsx'
import { MemberAvatar } from './MemberAvatar.jsx'
import { fmtMoment, fmtDateRange } from '../lib/time.js'
import { workingGroupTopic } from '../../shared/workingGroups.js'
import { workingGroupIcon } from '../lib/workingGroupIcons.js'
import { regionLabel, regionFilterPrefix } from '../lib/regions.js'
import {
  TbCalendar as CalendarDays,
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
  coordination: 'Coordination',
}

const COY_LABEL = { lcoy: 'LCOY', rcoy: 'RCOY', coy: 'COY' }

function EntityHeader({
  title,
  status,
  statusFilterState,
  onStatusFilter,
  children,
}) {
  return (
    <div className="entityCardHeader">
      <div className="entityCardHeading">
        <h3>{title}</h3>
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
      </div>
    </div>
  )
}

function LinkedEntityCard({ href, label, className = '', children }) {
  return (
    <article className={`card entityCard linkedEntityCard ${className}`.trim()}>
      <A
        href={href}
        className="entityCardLinkOverlay"
        aria-label={label}
        peek
      />
      {children}
    </article>
  )
}

export function CardSchedule({ iso, label }) {
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

export function EventCard({ event }) {
  const TypeIcon = EVENT_ICONS[event.type] || CalendarDays
  const GroupIcon = event.wg?.slug ? workingGroupIcon(event.wg.slug) : null
  return (
    <A
      href={`/calendar/${event.slug}`}
      className="card cardTight entityCard"
      peek
    >
      <EntityHeader title={event.title}>
        <FilterChip icon={TypeIcon}>
          {EVENT_LABEL[event.type] || event.type}
        </FilterChip>
        {event.wg && <FilterChip icon={GroupIcon}>{event.wg.name}</FilterChip>}
      </EntityHeader>
      <div className="entityCardFooter">
        <CardSchedule iso={event.startsAt} label="Starts" />
      </div>
    </A>
  )
}

export function SubmissionCard({
  sub,
  statusFilterState,
  groupFilterState,
  onStatusFilter,
  onGroupFilter,
}) {
  return (
    <LinkedEntityCard
      href={`/submissions/${sub.slug}`}
      label={`Open ${sub.title}`}
    >
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
export function ClosingCard({ item }) {
  const isDecision = item.kind === 'decision'
  const href = `${isDecision ? '/council' : '/submissions'}/${item.slug}`
  return (
    <A href={href} className="card entityCard" peek>
      <EntityHeader title={item.title}>
        {isDecision && <FilterChip icon={Gavel}>Council</FilterChip>}
      </EntityHeader>
      <LifecycleTiming status={item.status} iso={item.deadlineAt} />
    </A>
  )
}

export function DecisionCard({ decision, statusFilterState, onStatusFilter }) {
  const windowIso =
    decision.status === 'objection_window'
      ? decision.objectionDeadline
      : decision.inputDeadline
  return (
    <LinkedEntityCard
      href={`/council/${decision.slug}`}
      label={`Open ${decision.title}`}
    >
      <EntityHeader title={decision.title} />
      <div className="entityCardBody">
        {decision.summary && <p className="meta">{decision.summary}</p>}
      </div>
      <div className="entityCardFooter">
        <LifecycleTiming
          status={decision.status}
          iso={windowIso}
          label="Decision window"
          statusFilterState={statusFilterState}
          onStatusFilter={onStatusFilter}
        />
        <span className="metaMuted entityCardOwner">{decision.proposer}</span>
      </div>
    </LinkedEntityCard>
  )
}

export function CoyCard({
  coy,
  typeFilterState,
  regionFilterState,
  onTypeFilter,
  onRegionFilter,
}) {
  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  const CoyIcon = COY_ICONS[coy.type] || Globe
  return (
    <LinkedEntityCard
      href={`/coys/${coy.slug}`}
      label={`Open ${coy.title}`}
      className="coyCard"
    >
      <EntityHeader title={coy.title} status={coy.status}>
        <FilterChip
          state={typeFilterState}
          icon={CoyIcon}
          onClick={onTypeFilter}
        >
          {COY_LABEL[coy.type]}
        </FilterChip>
        <FilterChip
          state={regionFilterState}
          prefix={regionFilterPrefix(coy.region, regionLabel(coy.region))}
          onClick={onRegionFilter}
        >
          {regionLabel(coy.region)}
        </FilterChip>
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
}) {
  const GroupIcon = workingGroupIcon(group.slug)
  const destination = href || `/groups/${group.slug}`
  const topic = workingGroupTopic(group.slug)
  return (
    <div className="card cardTight groupCard entityCard">
      <A
        href={destination}
        className="groupCardLinkOverlay"
        aria-label={`Open ${group.name}${href ? ' workspace' : ''}`}
        peek
      />
      <div className="groupCardBody">
        <div className="groupCardCopy">
          <div className="groupCardTitle">
            <GroupIcon size={19} strokeWidth={1.75} aria-hidden />
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
        {topic && (
          <FilterChip state={topicFilterState} onClick={onTopicFilter}>
            {topic.label}
          </FilterChip>
        )}
      </div>
    </div>
  )
}

export function PersonCard({ person, onTagClick, onOpen, expanded = false }) {
  return (
    <article
      className={`card cardTight personCard ${expanded ? 'personDetail' : ''}`}
    >
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
                {person.organization.seatRole
                  ? ` · ${person.organization.seatRole}`
                  : ''}
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
              ...person.teams.map((team) => team.name),
              person.platformRole?.replaceAll('_', ' '),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      )}
      {person.workingGroups?.length > 0 && (
        <div
          className="entityCardTags personGroupTags"
          aria-label="Working groups"
        >
          {person.workingGroups
            .slice(0, expanded ? undefined : 5)
            .map((group) => {
              const GroupIcon = workingGroupIcon(group.slug)
              return (
                <A
                  key={group.slug}
                  href={`/groups/${group.slug}`}
                  className="chip chip-neutral personLinkChip"
                  peek
                >
                  <GroupIcon size={13} strokeWidth={1.75} aria-hidden />
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
        <div
          className="entityCardTags personExpertiseTags"
          aria-label="Skills and topics"
        >
          {person.expertiseTags.map((tag) =>
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

export function ContactCard({ contact }) {
  const rawChannel = contact.channelValue?.trim()
  const channel =
    rawChannel?.replace(/^mailto:/i, '').toLowerCase() ===
    contact.publicEmail?.trim().toLowerCase()
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
  const hasDirectContact = Boolean(
    contact.personName || contact.publicEmail || channel,
  )

  return (
    <div className="card cardTight contactCard">
      <h3 className="contactRole">{contact.roleTitle}</h3>
      {contact.description && (
        <p className="meta contactDescription">{contact.description}</p>
      )}
      {hasDirectContact ? (
        <div className="contactDetails">
          {contact.personName && (
            <p className="meta contactPerson">{contact.personName}</p>
          )}
          {contact.publicEmail && (
            <a className="inlineLink" href={`mailto:${contact.publicEmail}`}>
              {contact.publicEmail}
            </a>
          )}
          {channel &&
            (channelHref ? (
              <a
                className="inlineLink"
                href={channelHref}
                target={channelHref.startsWith('http') ? '_blank' : undefined}
                rel={
                  channelHref.startsWith('http')
                    ? 'noopener noreferrer'
                    : undefined
                }
              >
                {channel}
              </a>
            ) : (
              <p className="meta">{channel}</p>
            ))}
        </div>
      ) : (
        <p className="metaMuted contactUnavailable">
          No direct contact has been published yet.
        </p>
      )}
    </div>
  )
}

function workingGroupContactSummary(contact) {
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

export function WorkingGroupContactCard({ contact }) {
  const slug = contact.wg?.slug || contact.wg
  const name = contact.wg?.name || contact.roleTitle.replace(/\s+WG.*$/i, '')
  const GroupIcon = workingGroupIcon(slug)
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
            <GroupIcon size={18} strokeWidth={1.75} />
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
