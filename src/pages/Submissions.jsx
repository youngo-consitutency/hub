import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, A, PageHeader } from '../components/ui.jsx'
import { SubmissionCard } from '../components/cards.jsx'
import { fmtDay } from '../lib/time.js'
import { FileText } from 'lucide-react'

export function Submissions() {
  const [state, setState] = useState('open')
  const query = useApi(`/submissions?state=${state}`, [state])

  return (
    <div>
      <PageHeader
        eyebrow="Policy work"
        title="Submissions"
        description="Open drafting processes and YOUNGO’s submitted positions."
      >
        <div className="pillRow" aria-label="Filter submissions">
          <button type="button" aria-pressed={state === 'open'} className={`pill ${state === 'open' ? 'active' : ''}`} onClick={() => setState('open')}>Open</button>
          <button type="button" aria-pressed={state === 'archive'} className={`pill ${state === 'archive' ? 'active' : ''}`} onClick={() => setState('archive')}>Archive</button>
        </div>
      </PageHeader>
      <Async query={query} empty={(d) => d.items.length === 0 ? (
        state === 'open'
          ? <Empty icon={FileText} title="Nothing open right now" body="The archive shows what YOUNGO has said before." cta={<A href="#" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); setState('archive') }}>View archive</A>} />
          : <Empty icon={FileText} title="No archived submissions yet" />
      ) : null}>
        {(data) => (
          <div className="stack">
            {state === 'archive' && <p className="metaMuted">{data.items.length} past submission{data.items.length === 1 ? '' : 's'} — institutional memory.</p>}
            {data.items.map((s) => state === 'archive'
              ? (
                <A key={s.slug} href={`/submissions/${s.slug}`} className="card cardTight rowBetween archiveRow">
                  <span><FileText size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--text-2)' }} />{s.title}</span>
                  <span className="metaMuted mono">{s.finalUrl ? fmtDay(s.deadlineAt, 'UTC') : 'submitted'}</span>
                </A>
              )
              : <SubmissionCard key={s.slug} sub={s} />)}
          </div>
        )}
      </Async>
    </div>
  )
}
