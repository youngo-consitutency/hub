import type { FeedbackTicket, FeedbackTicketsResponse } from '../../shared/contracts'
import { formatDateTime } from '../lib/time'
import { useEffect, useState } from 'react'
import { apiGet, errorMessage } from '../lib/api'
import { Empty, ErrorCard, Section, Skeletons } from './ui'
import { TbMessagePlus as MessageSquarePlus } from 'react-icons/tb'

const KIND_LABEL: Record<string, string> = {
  bug: 'Broken',
  ui_ux: 'Design / usability',
  feature: 'Idea',
  blocker: 'Blocker',
  content: 'Content',
  other: 'Other',
}

const STATUS_LABEL: Record<string, string> = {
  new: 'Received',
  triaged: 'Triaged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  declined: 'Declined',
}

export function MyFeedback() {
  const [state, setState] = useState<{ items: FeedbackTicket[] | null; error: string | null }>({
    items: null,
    error: null,
  })

  const load = () => {
    apiGet<FeedbackTicketsResponse>('/member/feedback/mine')
      .then((data) => setState({ items: data.items, error: null }))
      .catch((error) => setState({ items: null, error: errorMessage(error) }))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <Section label="Your feedback">
      {state.error && <ErrorCard message={state.error} onRetry={load} />}
      {!state.items && !state.error && <Skeletons n={1} />}
      {state.items?.length === 0 && (
        <Empty
          icon={MessageSquarePlus}
          title="No reports yet"
          body="Open Help & support when something is wrong or missing."
        />
      )}
      <div className="stackSm">
        {(state.items || []).map((ticket) => (
          <div key={ticket.id} className="card cardTight">
            <div className="rowGap" style={{ flexWrap: 'wrap' }}>
              <span className="chip chip-info">{KIND_LABEL[ticket.kind] || ticket.kind}</span>
              <span className="chip chip-neutral">
                {STATUS_LABEL[ticket.status] || ticket.status}
              </span>
            </div>
            <h3 style={{ marginTop: 6 }}>{ticket.title}</h3>
            <p className="metaMuted">
              {ticket.pageUrl ? `${ticket.pageUrl} · ` : ''}
              {ticket.createdAt ? formatDateTime(ticket.createdAt) : ''}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}
