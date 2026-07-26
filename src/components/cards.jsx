import { A, StatusChip, CountdownChip } from './ui.jsx'
import { fmtMoment, fmtDateRange } from '../lib/time.js'
import {
  Users,
  MapPin,
  CalendarDays,
  MessageCircle,
  ArrowUpRight,
} from 'lucide-react'

const EVENT_LABEL = {
  constituency_call: 'Constituency',
  wg_call: 'Working group',
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

function EntityHeader({ title, status }) {
  return (
    <div className="entityCardHeader">
      <div className="entityCardHeading">
        <h3>{title}</h3>
        {status && (
          <div className="entityCardStatus">
            <StatusChip status={status} />
          </div>
        )}
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
    <A href={`/calendar/${event.slug}`} className="card cardTight entityCard">
      <EntityHeader title={event.title} />
      <div className="entityCardBody">
        <MomentRow iso={event.startsAt} label="Starts" />
      </div>
      <div className="entityCardFooter">
        <span className="chip chip-neutral">
          {EVENT_LABEL[event.type] || event.type}
        </span>
        {event.wg && <span className="chip chip-neutral">{event.wg.name}</span>}
      </div>
    </A>
  )
}

export function SubmissionCard({ sub }) {
  return (
    <A href={`/submissions/${sub.slug}`} className="card entityCard">
      <EntityHeader title={sub.title} status={sub.status} />
      <div className="entityCardBody">
        <MomentRow iso={sub.deadlineAt} label="Deadline" />
      </div>
      <div className="entityCardFooter">
        <CountdownChip iso={sub.deadlineAt} label="Closes in" />
        {sub.wg && (
          <span className="chip chip-neutral entityCardOwner">
            {sub.wg.name}
          </span>
        )}
      </div>
    </A>
  )
}

// Home closing-soon item: either a submission or a DMP decision.
export function ClosingCard({ item }) {
  const isDecision = item.kind === 'decision'
  const href = `${isDecision ? '/council' : '/submissions'}/${item.slug}`
  return (
    <A href={href} className="card entityCard">
      <EntityHeader title={item.title} status={item.status} />
      <div className="entityCardBody">
        <MomentRow iso={item.deadlineAt} label="Deadline" />
      </div>
      <div className="entityCardFooter">
        <CountdownChip iso={item.deadlineAt} label="Closes in" />
        <span className="chip chip-neutral entityCardOwner">
          {isDecision ? 'Council' : 'Submission'}
        </span>
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
    <A href={`/council/${decision.slug}`} className="card entityCard">
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
    <A href={`/coys/${coy.slug}`} className="card entityCard coyCard">
      <EntityHeader title={coy.title} status={coy.status} />
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
      <div className="entityCardFooter">
        <span className="chip chip-neutral">{COY_LABEL[coy.type]}</span>
        <span className="chip chip-neutral">
          {REGION_LABEL[coy.region] || coy.region}
        </span>
      </div>
    </A>
  )
}

export function GroupCard({ group }) {
  return (
    <div className="card groupCard entityCard">
      <div className="groupCardBody">
        <A href={`/groups/${group.slug}`} className="monogram">
          {group.monogram || group.name.slice(0, 2)}
        </A>
        <div className="groupCardCopy">
          <h3>
            <A href={`/groups/${group.slug}`} className="inlineLink">
              {group.name}
            </A>
          </h3>
          <p className="meta" style={{ marginTop: 2 }}>
            {group.focusLine}
          </p>
        </div>
      </div>
      {group.cadenceNote && (
        <p className="entityCardMetaRow">
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
          <span>{group.cadenceNote}</span>
        </p>
      )}
      {group.tags?.length > 0 && (
        <div className="entityCardTags">
          {group.tags.map((tag) => (
            <span key={tag} className="chip chip-neutral">
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="groupCardActions">
        {group.whatsappUrl && (
          <a
            className="btn btn-secondary btn-sm"
            href={group.whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
            WhatsApp
          </a>
        )}
        {group.groupUrl && (
          <a
            className="btn btn-secondary btn-sm"
            href={group.groupUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Users size={16} strokeWidth={1.75} aria-hidden />
            Group
          </a>
        )}
        {group.driveUrl && (
          <a
            className="btn btn-ghost btn-sm"
            href={group.driveUrl}
            target="_blank"
            rel="noreferrer"
          >
            Drive
            <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
          </a>
        )}
        <A href={`/groups/${group.slug}`} className="btn btn-ghost btn-sm">
          Open workspace
          <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
        </A>
      </div>
    </div>
  )
}

export function ContactCard({ contact }) {
  return (
    <div className="card cardTight contactCard">
      <h3 style={{ fontSize: 14 }}>{contact.roleTitle}</h3>
      {contact.description && (
        <p className="meta" style={{ marginTop: 4 }}>
          {contact.description}
        </p>
      )}
      {contact.publicEmail ? (
        <a
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 8, paddingLeft: 0 }}
          href={`mailto:${contact.publicEmail}`}
        >
          {contact.publicEmail}
        </a>
      ) : (
        <p className="metaMuted" style={{ marginTop: 8 }}>
          Sign in to see contact details
        </p>
      )}
    </div>
  )
}
