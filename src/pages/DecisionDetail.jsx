import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  CountdownChip,
  Timeline,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { fmtMoment, fmtDay } from '../lib/time.js'
import { FileText, ExternalLink } from 'lucide-react'

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
    <div className="detailPage">
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
          const deadline = windowIso ? fmtMoment(windowIso) : null
          return (
            <>
              <PageHeader
                eyebrow="Council decision"
                title={d.title}
                description={d.summary}
              >
                <div className="detailHeaderMeta">
                  <StatusChip status={d.status} />
                  <p className="metaMuted">Proposed by {d.proposer}</p>
                </div>
              </PageHeader>

              <Section label="Decision process">
                <div className="card detailProcess">
                  {deadline && (
                    <div className="detailDeadline">
                      <div>
                        <p className="metaMuted detailMetaLabel">Deadline</p>
                        <p className="mono">
                          {deadline.day} · {deadline.localTime}{' '}
                          {deadline.localZone}
                        </p>
                        {!deadline.isUtc && (
                          <p className="metaMuted mono">
                            UTC: {deadline.utcTime}
                          </p>
                        )}
                      </div>
                      <CountdownChip iso={windowIso} label="Closes in" />
                    </div>
                  )}

                  <Timeline
                    steps={STEPS}
                    currentIndex={STEP_INDEX[d.status] ?? 0}
                  />
                </div>
              </Section>

              {!decided && (
                <Section label="How to respond">
                  <div className="card detailPanel">
                    {d.respondNote && <p className="meta">{d.respondNote}</p>}
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
                </Section>
              )}

              {decided && (
                <Section label="Outcome">
                  <div className="card detailPanel">
                    {d.outcomeNote && <p className="meta">{d.outcomeNote}</p>}
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
                </Section>
              )}

              {d.statusLog?.length > 0 && (
                <Section label="Activity">
                  <ol className="card statusLog">
                    {d.statusLog.map((entry, i) => (
                      <li key={i} className="logRow">
                        <span className="logDot" />
                        <div>
                          <p className="logHead">
                            {LOG_LABEL[entry.status] || entry.status}
                            <span className="metaMuted mono logDate">
                              {fmtDay(entry.at, 'UTC')}
                            </span>
                          </p>
                          {entry.note && (
                            <p className="meta logNote">{entry.note}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
