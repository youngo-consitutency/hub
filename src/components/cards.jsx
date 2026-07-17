import { A, StatusChip, CountdownChip } from './ui.jsx'
import { fmtDual, fmtDateRange } from '../lib/time.js'
import {
  Video, Users, FileText, Gavel, MapPin, CalendarDays, Landmark, MessageCircle, ArrowUpRight,
} from 'lucide-react'

const EVENT_ICON = {
  constituency_call: Video, wg_call: Video, wgf: Users,
  unfccc_session: Landmark, webinar: CalendarDays, coordination: Users,
}

export function EventCard({ event }) {
  const Icon = EVENT_ICON[event.type] || CalendarDays
  return (
    <A href={`/calendar/${event.slug}`} className="card cardTight">
      <div className="eventRow">
        <span className="eventIcon"><Icon size={18} strokeWidth={1.75} aria-hidden /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="rowBetween">
            <h3 style={{ fontSize: 14 }}>{event.title}</h3>
            {event.wg && <span className="metaMuted">{event.wg.name}</span>}
          </div>
          <p className="mono" style={{ color: 'var(--text-2)', marginTop: 2 }}>{fmtDual(event.startsAt)}</p>
        </div>
      </div>
    </A>
  )
}

export function SubmissionCard({ sub }) {
  return (
    <A href={`/submissions/${sub.slug}`} className="card">
      <div className="rowBetween">
        <h3><FileText size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--text-2)' }} />{sub.title}</h3>
        <StatusChip status={sub.status} />
      </div>
      <div className="rowGap" style={{ marginTop: 8 }}>
        <span className="mono" style={{ color: 'var(--text-2)' }}>Due {fmtDual(sub.deadlineAt)}</span>
        <CountdownChip iso={sub.deadlineAt} />
        {sub.wg && <span className="metaMuted" style={{ marginLeft: 'auto' }}>{sub.wg.name}</span>}
      </div>
    </A>
  )
}

// Home closing-soon item: either a submission or a DMP decision.
export function ClosingCard({ item }) {
  const isDecision = item.kind === 'decision'
  const Icon = isDecision ? Gavel : FileText
  const href = `${isDecision ? '/council' : '/submissions'}/${item.slug}`
  return (
    <A href={href} className="card">
      <div className="rowBetween">
        <h3><Icon size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--text-2)' }} />{item.title}</h3>
        <StatusChip status={item.status} />
      </div>
      <div className="rowGap" style={{ marginTop: 8 }}>
        <span className="mono" style={{ color: 'var(--text-2)' }}>{fmtDual(item.deadlineAt)}</span>
        <CountdownChip iso={item.deadlineAt} />
      </div>
    </A>
  )
}

export function DecisionCard({ decision }) {
  const windowIso = decision.status === 'objection_window' ? decision.objectionDeadline : decision.inputDeadline
  return (
    <A href={`/council/${decision.slug}`} className="card">
      <div className="rowBetween">
        <h3><Gavel size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--text-2)' }} />{decision.title}</h3>
        <StatusChip status={decision.status} />
      </div>
      {decision.summary && <p className="meta" style={{ marginTop: 6 }}>{decision.summary}</p>}
      <div className="rowGap" style={{ marginTop: 8 }}>
        {windowIso && <><span className="mono" style={{ color: 'var(--text-2)' }}>{fmtDual(windowIso)}</span><CountdownChip iso={windowIso} /></>}
        <span className="metaMuted" style={{ marginLeft: 'auto' }}>{decision.proposer}</span>
      </div>
    </A>
  )
}

const COY_LABEL = { lcoy: 'LCOY', rcoy: 'RCOY', coy: 'COY' }

export function CoyCard({ coy }) {
  return (
    <A href={`/coys/${coy.slug}`} className="card">
      <div className="rowBetween">
        <h3><MapPin size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--text-2)' }} />{coy.title}</h3>
        <StatusChip status={coy.status} />
      </div>
      <p className="meta" style={{ marginTop: 6 }}>
        {[coy.city, coy.country].filter(Boolean).join(', ')} · <span className="mono">{fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}</span>
      </p>
      <span className="chip chip-neutral" style={{ marginTop: 8 }}>{COY_LABEL[coy.type]}</span>
    </A>
  )
}

export function GroupCard({ group }) {
  return (
    <div className="card">
      <div className="rowGap" style={{ alignItems: 'flex-start' }}>
        <A href={`/groups/${group.slug}`} className="monogram">{group.monogram || group.name.slice(0, 2)}</A>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3><A href={`/groups/${group.slug}`} className="inlineLink">{group.name}</A></h3>
          <p className="meta" style={{ marginTop: 2 }}>{group.focusLine}</p>
        </div>
      </div>
      {group.cadenceNote && <p className="metaMuted mono" style={{ marginTop: 10 }}>{group.cadenceNote}</p>}
      <div className="rowGap" style={{ marginTop: 10 }}>
        {group.whatsappUrl && <a className="btn btn-secondary btn-sm" href={group.whatsappUrl} target="_blank" rel="noreferrer"><MessageCircle size={16} strokeWidth={1.75} aria-hidden />WhatsApp</a>}
        {group.groupUrl && <a className="btn btn-secondary btn-sm" href={group.groupUrl} target="_blank" rel="noreferrer"><Users size={16} strokeWidth={1.75} aria-hidden />Group</a>}
        {group.driveUrl && <a className="btn btn-ghost btn-sm" href={group.driveUrl} target="_blank" rel="noreferrer">Drive<ArrowUpRight size={16} strokeWidth={1.75} aria-hidden /></a>}
      </div>
    </div>
  )
}

const CONTACT_GROUP = {
  focal_points: 'Global focal points', wg_contacts: 'Working group contacts',
  liaisons: 'Thematic liaisons', operations: 'Operations',
}
export { CONTACT_GROUP }

export function ContactCard({ contact }) {
  return (
    <div className="card cardTight">
      <h3 style={{ fontSize: 14 }}>{contact.roleTitle}</h3>
      {contact.description && <p className="meta" style={{ marginTop: 4 }}>{contact.description}</p>}
      {contact.publicEmail
        ? <a className="btn btn-ghost btn-sm" style={{ marginTop: 8, paddingLeft: 0 }} href={`mailto:${contact.publicEmail}`}>{contact.publicEmail}</a>
        : <p className="metaMuted" style={{ marginTop: 8 }}>Sign in to see contact details</p>}
    </div>
  )
}
