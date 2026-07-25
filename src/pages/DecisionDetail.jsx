import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  CountdownChip,
  Timeline,
} from '../components/ui.jsx'
import { fmtDual, fmtDay } from '../lib/time.js'
import { Gavel, FileText, ArrowUpRight, ExternalLink } from 'lucide-react'

const STEPS = ['Proposed', 'Open for input', 'Objection window', 'Outcome']
const STEP_INDEX = {
  proposed: 0,
  open_for_input: 1,
  objection_window: 2,
  adopted: 3,
  not_adopted: 3,
  withdrawn: 3,
}
const DECIDED = ['adopted', 'not_adopted', 'withdrawn']

const LOG_LABEL = {
  proposed: 'Proposed',
  open_for_input: 'Open for input',
  objection_window: 'Objection window',
  adopted: 'Adopted',
  not_adopted: 'Not adopted',
  withdrawn: 'Withdrawn',
}

export function DecisionDetail({ slug }) {
  const query = useApi(`/council/${slug}`)
  return (
    <div>
      <BackLink href="/council">Council</BackLink>
      <Async query={query}>
        {(d) => {
          const decided = DECIDED.includes(d.status)
          const windowIso =
            d.status === 'objection_window'
              ? d.objectionDeadline
              : d.status === 'open_for_input'
                ? d.inputDeadline
                : null
          return (
            <>
              <div className="rowGap" style={{ marginTop: 8 }}>
                <Gavel
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: 'var(--text-2)' }}
                />
                <StatusChip status={d.status} />
                <span className="metaMuted">{d.proposer}</span>
              </div>
              <h1 style={{ marginTop: 10 }}>{d.title}</h1>
              {d.summary && (
                <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
                  {d.summary}
                </p>
              )}

              {windowIso && (
                <div className="detailHeroRow">
                  <span className="mono detailHero">
                    Closes {fmtDual(windowIso)}
                  </span>
                  <CountdownChip iso={windowIso} />
                </div>
              )}

              <Timeline
                steps={STEPS}
                currentIndex={STEP_INDEX[d.status] ?? 0}
              />

              {!decided && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>How to respond</h3>
                  {d.respondNote && (
                    <p className="meta" style={{ marginTop: 6 }}>
                      {d.respondNote}
                    </p>
                  )}
                  {d.proposalUrl && (
                    <div className="detailActions">
                      <a
                        className="btn btn-primary"
                        href={d.proposalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FileText size={18} strokeWidth={1.75} aria-hidden />
                        Read the proposal
                      </a>
                    </div>
                  )}
                </div>
              )}

              {decided && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>Outcome</h3>
                  {d.outcomeNote && (
                    <p className="meta" style={{ marginTop: 6 }}>
                      {d.outcomeNote}
                    </p>
                  )}
                  {d.finalUrl && (
                    <div className="detailActions">
                      <a
                        className="btn btn-primary"
                        href={d.finalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink
                          size={18}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        Final text
                      </a>
                    </div>
                  )}
                </div>
              )}

              {d.statusLog?.length > 0 && (
                <>
                  <div className="sectionLabel">
                    <span>Status log</span>
                  </div>
                  <ol className="statusLog">
                    {d.statusLog.map((entry, i) => (
                      <li key={i} className="logRow">
                        <span className="logDot" />
                        <div>
                          <p className="logHead">
                            {LOG_LABEL[entry.status] || entry.status}
                            <span
                              className="metaMuted mono"
                              style={{ marginLeft: 8 }}
                            >
                              {fmtDay(entry.at, 'UTC')}
                            </span>
                          </p>
                          {entry.note && (
                            <p className="meta" style={{ marginTop: 2 }}>
                              {entry.note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
