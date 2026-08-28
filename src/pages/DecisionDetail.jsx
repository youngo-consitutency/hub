import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  LifecycleTiming,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { fmtDay } from '../lib/time.js'
import { DestinationIcon } from '../components/DestinationLink.jsx'
import {
  TbCircle as Circle,
  TbCircleFilled as CircleFilled,
} from 'react-icons/tb'

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

function processEntry(statusLog, stepIndex) {
  return statusLog?.find((entry) => STEP_INDEX[entry.status] === stepIndex)
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
          const currentStep = STEP_INDEX[d.status] ?? 0
          return (
            <>
              <PageHeader title={d.title} description={d.summary}>
                <div className="detailHeaderMeta">
                  {!windowIso && <StatusChip status={d.status} />}
                  <p className="metaMuted">Proposed by {d.proposer}</p>
                </div>
              </PageHeader>

              <Section label="Decision process">
                <div className="card detailProcess">
                  {windowIso && (
                    <LifecycleTiming
                      status={d.status}
                      iso={windowIso}
                      label="Decision window"
                      className="detailLifecycleTiming"
                    />
                  )}

                  <ol
                    className="decisionTimeline"
                    aria-label="Decision timeline"
                  >
                    {STEPS.map((step, index) => {
                      const entry = processEntry(d.statusLog, index)
                      const state =
                        index < currentStep
                          ? 'done'
                          : index === currentStep
                            ? 'current'
                            : 'future'
                      const Marker = state === 'future' ? Circle : CircleFilled

                      return (
                        <li
                          key={step}
                          className={`decisionTimelineStep ${state}`}
                          aria-current={
                            state === 'current' ? 'step' : undefined
                          }
                        >
                          <Marker
                            className="decisionTimelineMarker"
                            size={11}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          <div className="decisionTimelineCopy">
                            <p className="decisionTimelineHead">
                              <span>
                                {entry
                                  ? LOG_LABEL[entry.status] || entry.status
                                  : step}
                              </span>
                              {entry ? (
                                <span className="metaMuted mono">
                                  {fmtDay(entry.at, 'UTC')}
                                </span>
                              ) : (
                                <span className="metaMuted">Pending</span>
                              )}
                            </p>
                            {entry?.note && (
                              <p className="meta decisionTimelineNote">
                                {entry.note}
                              </p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </Section>

              {!decided && (
                <Section label="How to respond">
                  <div className="card detailPanel detailActionPanel">
                    {d.respondNote && <p className="meta">{d.respondNote}</p>}
                    {d.proposalUrl && (
                      <div className="detailActions">
                        <a
                          className="btn btn-primary"
                          href={d.proposalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon url={d.proposalUrl} size={18} />
                          Read the proposal
                        </a>
                      </div>
                    )}
                  </div>
                </Section>
              )}

              {decided && (
                <Section label="Outcome">
                  <div className="card detailPanel detailActionPanel">
                    {d.outcomeNote && <p className="meta">{d.outcomeNote}</p>}
                    {d.finalUrl && (
                      <div className="detailActions">
                        <a
                          className="btn btn-primary"
                          href={d.finalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon url={d.finalUrl} size={18} />
                          Final text
                        </a>
                      </div>
                    )}
                  </div>
                </Section>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
