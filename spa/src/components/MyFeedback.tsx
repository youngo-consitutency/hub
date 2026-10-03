import { formatDateTime } from '../lib/time'
import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { Empty, ErrorCard, Section, Skeletons } from './ui'
import { TbMessagePlus as MessageSquarePlus } from 'react-icons/tb'

const KIND_LABEL = {
  bug: 'Broken',
  ui_ux: 'Design / usability',
  feature: 'Idea',
  blocker: 'Blocker',
  content: 'Content',
  other: 'Other',
}

const STATUS_LABEL = {
  new: 'Received',
  triaged: 'Triaged',
  in_progress: 'In progress',
  resolved: 'Resolved',
  declined: 'Declined',
}

export function MyFeedback() {
  const [state, setState] = useState<Record<string, any>>({ items: null, error: null })

  const load = () => {
    apiGet('/member/feedback/mine')
      .then((data) => setState({ items: data.items, error: null }))
      .catch((error) => setState({ items: null, error: error.message }))
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
        {(state.items || []).map((ticket: any) => (
          <div key={(ticket as any).id} className="card cardTight">
            <div className="rowGap" style={{ flexWrap: 'wrap' }}>
              <span className="chip chip-info">
                {(KIND_LABEL as any)[(ticket as any).kind] || (ticket as any).kind}
              </span>
              <span className="chip chip-neutral">
                {(STATUS_LABEL as any)[(ticket as any).status] || (ticket as any).status}
              </span>
            </div>
            <h3 style={{ marginTop: 6 }}>{(ticket as any).title}</h3>
            <p className="metaMuted">
              {(ticket as any).pagePath ? `${(ticket as any).pagePath} · ` : ''}
              {(ticket as any).createdAt ? formatDateTime((ticket as any).createdAt) : ''}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}
