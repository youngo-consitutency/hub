import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, A, StatusChip } from '../components/ui.jsx'
import { DecisionCard } from '../components/cards.jsx'
import { fmtDay } from '../lib/time.js'
import { Gavel } from 'lucide-react'

export function Council() {
  const [state, setState] = useState('active')
  const query = useApi(`/council?state=${state}`, [state])

  return (
    <div>
      <h1>Council</h1>
      <p className="meta" style={{ marginTop: 4 }}>Decisions moving through YOUNGO’s decision-making process.</p>
      <div className="pillRow" style={{ marginTop: 12 }}>
        <button className={`pill ${state === 'active' ? 'active' : ''}`} onClick={() => setState('active')}>In progress</button>
        <button className={`pill ${state === 'decided' ? 'active' : ''}`} onClick={() => setState('decided')}>Decided</button>
      </div>
      <Async query={query} empty={(d) => d.items.length === 0 ? (
        state === 'active'
          ? <Empty icon={Gavel} title="No open decisions" body="The archive shows how past decisions went." cta={<A href="#" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); setState('decided') }}>View decided</A>} />
          : <Empty icon={Gavel} title="No decisions recorded yet" />
      ) : null}>
        {(data) => (
          <div className="stack">
            {state === 'decided'
              ? data.items.map((d) => (
                <A key={d.slug} href={`/council/${d.slug}`} className="card cardTight rowBetween">
                  <span><Gavel size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -3, marginRight: 6, color: 'var(--text-2)' }} />{d.title}</span>
                  <span className="rowGap">
                    <StatusChip status={d.status} />
                    <span className="metaMuted mono">{d.decidedAt ? fmtDay(d.decidedAt, 'UTC') : ''}</span>
                  </span>
                </A>
              ))
              : data.items.map((d) => <DecisionCard key={d.slug} decision={d} />)}
          </div>
        )}
      </Async>
    </div>
  )
}
