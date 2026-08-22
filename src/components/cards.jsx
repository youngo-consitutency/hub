import { A, StatusChip, CountdownChip } from './ui.jsx'
import { fmtMoment, fmtDateRange } from '../lib/time.js'
import {
  CircleDollarSign,
  CloudRain,
  Cpu,
  CalendarDays,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Leaf,
  MapPin,
  Scale,
  ShieldCheck,
  Sprout,
  Target,
  UsersRound,
  Waves,
  Wind,
  Zap,
  ArrowUpRight,
} from 'lucide-react'

const GROUP_ICONS = {
  ace: GraduationCap,
  adaptation: CloudRain,
  agriculture: Sprout,
  'conflict-of-interest': ShieldCheck,
  coy: UsersRound,
  energy: Zap,
  finance: CircleDollarSign,
  gender: Scale,
  health: HeartPulse,
  'human-rights': HandHeart,
  'loss-and-damage': Waves,
  mitigation: Wind,
  nature: Leaf,
  ndcs: Target,
  oceans: Waves,
  technology: Cpu,
}

const EVENT_LABEL = {
  constituency_call: 'Constituency',
  wg_call: 'WG',
  wgf: 'Forum',
  unfccc_session: 'UNFCCC',
  webinar: 'Webinar',
  coordination: 'Coordination',
}

const COY_LABEL = { lcoy: 'LCOY', rcoy: 'RCOY', coy: 'COY' }
const REGION_LABEL = {
  africa: 'Africa',
  apac: 'Asia-Pacific',
  eca: 'ECA',
  lac: 'LAC',
  mena: 'MENA',
  noram: 'North America',
  weog: 'WEOG',
}

function EntityHeader({ title, status, children }) {
  return (
    <div className="entityCardHeader">
      <div className="entityCardHeading">
        <h3>{title}</h3>
        <div className="entityCardTags entityCardHeaderTags">
          {status && <StatusChip status={status} />}
          {children}
        </div>
      </div>
    </div>
  )
}

function MomentRow({ iso, label }) {
  const moment = fmtMoment(iso)
  return (
    <div className="entityCardSchedule">
      <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
      <div>
        <span className="entityCardMetaLabel">{label}</span>
        <span>
          {moment.day} · {moment.localTime} {moment.localZone}
        </span>
        {!moment.isUtc && (
          <span className="entityCardSecondary">UTC: {moment.utcTime}</span>
        )}
      </div>
    </div>
  )
}

export function EventCard({ event }) {
  return (
    <A
      href={`/calendar/${event.slug}`}
      className="card cardTight entityCard"
      peek
    >
      <EntityHeader title={event.title}>
        <span className="chip chip-neutral">
          {EVENT_LABEL[event.type] || event.type}
        </span>
        {event.wg && <span className="chip chip-neutral">{event.wg.name}</span>}
      </EntityHeader>
      <div className="entityCardBody">
        <MomentRow iso={event.startsAt} label="Starts" />
      </div>
    </A>
  )
}

export function SubmissionCard({ sub }) {
  return (
    <A href={`/submissions/${sub.slug}`} className="card entityCard" peek>
      <EntityHeader title={sub.title} status={sub.status}>
        {sub.wg && <span className="chip chip-neutral">{sub.wg.name}</span>}
      </EntityHeader>
      <div className="entityCardBody">
        <MomentRow iso={sub.deadlineAt} label="Deadline" />
      </div>
      <div className="entityCardFooter">
        <CountdownChip iso={sub.deadlineAt} label="Closes in" />
      </div>
    </A>
  )
}

// Home closing-soon item: either a submission or a DMP decision.
export function ClosingCard({ item }) {
  const isDecision = item.kind === 'decision'
  const href = `${isDecision ? '/council' : '/submissions'}/${item.slug}`
  return (
    <A href={href} className="card entityCard" peek>
      <EntityHeader title={item.title} status={item.status}>
        {isDecision && <span className="chip chip-neutral">Council</span>}
      </EntityHeader>
      <div className="entityCardBody">
        <MomentRow iso={item.deadlineAt} label="Deadline" />
      </div>
      <div className="entityCardFooter">
        <CountdownChip iso={item.deadlineAt} label="Closes in" />
      </div>
    </A>
  )
}

export function DecisionCard({ decision }) {
  const windowIso =
    decision.status === 'objection_window'
      ? decision.objectionDeadline
      : decision.inputDeadline
  return (
    <A href={`/council/${decision.slug}`} className="card entityCard" peek>
      <EntityHeader title={decision.title} status={decision.status} />
      <div className="entityCardBody">
        {decision.summary && <p className="meta">{decision.summary}</p>}
        {windowIso && <MomentRow iso={windowIso} label="Decision window" />}
      </div>
      <div className="entityCardFooter">
        {windowIso && <CountdownChip iso={windowIso} label="Closes in" />}
        <span className="metaMuted entityCardOwner">{decision.proposer}</span>
      </div>
    </A>
  )
}

export function CoyCard({ coy }) {
  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  return (
    <A href={`/coys/${coy.slug}`} className="card entityCard coyCard" peek>
      <EntityHeader title={coy.title} status={coy.status}>
        <span className="chip chip-neutral">{COY_LABEL[coy.type]}</span>
        <span className="chip chip-neutral">
          {REGION_LABEL[coy.region] || coy.region}
        </span>
      </EntityHeader>
      <div className="entityCardBody">
        <p className="entityCardMetaRow">
          <MapPin size={16} strokeWidth={1.75} aria-hidden />
          <span>{place || 'Location to be announced'}</span>
        </p>
        <p className="entityCardMetaRow">
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
          <span>{fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}</span>
        </p>
      </div>
    </A>
  )
}

export function GroupCard({ group, href, statusLabel }) {
  const GroupIcon = GROUP_ICONS[group.slug] || UsersRound
  const destination = href || `/groups/${group.slug}`
  return (
    <div className="card groupCard entityCard">
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
        {statusLabel && <span className="chip chip-accent">{statusLabel}</span>}
        {group.tags?.map((tag) => (
          <span key={tag} className="chip chip-neutral">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ContactCard({ contact }) {
  const channel = contact.channelValue?.trim()
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
  const GroupIcon = GROUP_ICONS[slug] || UsersRound
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
