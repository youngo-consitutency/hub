interface TicketCardProps {
  ticket: FeedbackTicket
  onUpdate: (id: number, body: Record<string, string>) => Promise<void>
}

import type { FeedbackTicket, FeedbackTicketsResponse } from '../../shared/contracts'
import { formatDateTime } from '../lib/time'
import { useEffect, useState } from 'react'
import { apiPatch, useApi, errorMessage } from '../lib/api'
import { Button, Empty, ErrorCard, FilterPill, Section, Skeletons } from './ui'
import { TbMessagePlus as MessageSquarePlus, TbExternalLink as ExternalLink } from 'react-icons/tb'

const STATUS_FILTERS = [
  ['', 'All'],
  ['new', 'New'],
  ['triaged', 'Triaged'],
  ['in_progress', 'In progress'],
  ['resolved', 'Resolved'],
  ['declined', 'Declined'],
]

const NEXT_STATUS = [
  ['triaged', 'Triage'],
  ['in_progress', 'Start'],
  ['resolved', 'Resolve'],
  ['declined', 'Decline'],
]

const KIND_LABEL = {
  bug: 'Broken',
  ui_ux: 'Design / usability',
  feature: 'Idea',
  blocker: 'Blocker',
  content: 'Content',
  other: 'Other',
}

const SEVERITY_CHIP = {
  low: 'chip-neutral',
  normal: 'chip-info',
  high: 'chip-warn',
  critical: 'chip-danger',
}

function TicketCard({ ticket, onUpdate }: TicketCardProps) {
  const [note, setNote] = useState(ticket.triageNote || '')
  const [saving, setSaving] = useState(false)
  const noteDirty = note !== (ticket.triageNote || '')

  useEffect(() => {
    setNote(ticket.triageNote || '')
  }, [ticket.id, ticket.triageNote])

  const patch = async (body: Record<string, string>) => {
    setSaving(true)
    try {
      await onUpdate(ticket.id, body)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card cardTight feedbackTicket">
      <div className="feedbackTicketMain">
        <div className="rowGap" style={{ flexWrap: 'wrap' }}>
          <span className="chip chip-info">
            {KIND_LABEL[ticket.kind as keyof typeof KIND_LABEL] || ticket.kind}
          </span>
          <span
            className={`chip ${SEVERITY_CHIP[ticket.severity as keyof typeof SEVERITY_CHIP] || 'chip-neutral'}`}
          >
            {ticket.severity}
          </span>
          <span className="chip chip-neutral">{ticket.status}</span>
        </div>
        <h3 style={{ marginTop: 6 }}>{ticket.title}</h3>
        {ticket.body && <p className="meta">{ticket.body}</p>}
        <p className="metaMuted" style={{ marginTop: 4 }}>
          {ticket.contactEmail || 'Unknown member'}
          {ticket.pageUrl ? ` · ${ticket.pageUrl}` : ''}
          {ticket.viewport ? ` · ${ticket.viewport}` : ''}
          {ticket.createdAt ? ` · ${formatDateTime(ticket.createdAt)}` : ''}
        </p>
        {ticket.githubIssueUrl && (
          <a
            className="metaMuted rowGap"
            href={ticket.githubIssueUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
            GitHub issue
          </a>
        )}
        <label className="field feedbackTriageNote">
          <span>Triage note</span>
          <textarea
            className="input textarea"
            rows={2}
            maxLength={2000}
            placeholder="Internal context for the next person who picks this up"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="feedbackTicketActions">
          {noteDirty && (
            <Button
              sm
              variant="secondary"
              disabled={saving}
              onClick={() => patch({ triageNote: note })}
            >
              Save note
            </Button>
          )}
          {NEXT_STATUS.filter(([value]) => value !== ticket.status).map(([value, label]) => (
            <Button
              key={value}
              sm
              variant="ghost"
              disabled={saving}
              onClick={() =>
                patch({
                  status: value,
                  ...(noteDirty ? { triageNote: note } : {}),
                })
              }
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function FeedbackQueue() {
  const [status, setStatus] = useState('new')
  // SWR drops a response that arrives after the filter has changed
  const {
    data,
    error: loadError,
    retry,
  } = useApi<FeedbackTicketsResponse>(`/member/feedback${status ? `?status=${status}` : ''}`, {
    keepPrevious: true,
  })
  const [actionError, setActionError] = useState<string | null>(null)
  const items: FeedbackTicket[] | null = data?.items ?? null
  const error = actionError || loadError

  const updateTicket = async (id: number, body: Record<string, string>) => {
    try {
      await apiPatch(`/member/feedback/${id}`, body)
      setActionError(null)
      retry()
    } catch (e) {
      setActionError(errorMessage(e))
      throw e
    }
  }

  return (
    <Section
      label="Member feedback"
      action={
        <div className="pillRow">
          {STATUS_FILTERS.map(([value, label]) => (
            <FilterPill
              key={value || 'all'}
              active={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </FilterPill>
          ))}
        </div>
      }
    >
      {error && <ErrorCard message={error} onRetry={retry} />}
      {!items && !error && <Skeletons n={2} />}
      {items?.length === 0 && (
        <Empty
          icon={MessageSquarePlus}
          title="Nothing in this queue"
          body="Reports members send with the feedback button land here."
        />
      )}
      <div className="stackSm">
        {(items || []).map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} onUpdate={updateTicket} />
        ))}
      </div>
    </Section>
  )
}
