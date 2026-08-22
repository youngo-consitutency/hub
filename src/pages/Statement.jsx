import { useApi } from '../lib/api.js'
import { Async, CountdownChip, PageHeader, Section } from '../components/ui.jsx'
import { GysSignup } from '../components/GysSignup.jsx'
import {
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  ScrollText,
} from 'lucide-react'

const PRIORITY_GROUP_ORDER = [
  'Climate ambition',
  'Justice and resilience',
  'Participation and rights',
]

const PROCESS_COPY = {
  'Collection of inputs':
    'Collect submissions from young people, working groups, and regional COYs.',
  'Regional & thematic synthesis':
    'Combine regional outputs and working-group policy drafts.',
  'Editing & endorsement':
    'Edit a balanced draft and seek endorsement at COY21.',
  'Advocacy & handover':
    'Present the final statement at COP31 and use it in YOUNGO advocacy.',
}

function groupPriorities(priorities) {
  return PRIORITY_GROUP_ORDER.map((name) => ({
    name,
    items: priorities.filter((priority) => {
      if (priority.group) return priority.group === name
      if (/NDC|energy/i.test(priority.title)) return name === 'Climate ambition'
      if (/finance|adaptation|loss/i.test(priority.title)) {
        return name === 'Justice and resilience'
      }
      return name === 'Participation and rights'
    }),
  })).filter((group) => group.items.length > 0)
}

export function Statement() {
  const query = useApi('/gys')

  return (
    <div>
      <Async query={query} skeletons={4}>
        {(gys) => {
          const current = gys.current
          const priorityGroups = groupPriorities(gys.priorities)
          return (
            <>
              <PageHeader
                eyebrow="YOUNGO policy"
                title={current.title}
                description={current.intro}
                action={
                  <a
                    className="btn btn-primary"
                    href={current.fullUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ScrollText size={18} strokeWidth={1.75} aria-hidden />
                    Read the statement
                  </a>
                }
              />

              <section
                className="card gysOverview"
                aria-label="Current edition"
              >
                <div className="gysFacts">
                  <div>
                    <p className="metaMuted">Edition</p>
                    <strong>{current.edition}</strong>
                  </div>
                  <div>
                    <p className="metaMuted">Prepared in</p>
                    <strong>{current.location}</strong>
                  </div>
                  <div>
                    <p className="metaMuted">Climate conference</p>
                    <strong>{current.targetSession}</strong>
                  </div>
                </div>
                <p className="meta">{current.note}</p>
                <div className="gysResources" aria-label="Available resources">
                  {current.inputsDeadlineAt && (
                    <CountdownChip
                      iso={current.inputsDeadlineAt}
                      label="Inputs close"
                    />
                  )}
                  {current.inputsUrl && (
                    <a
                      className="btn btn-primary btn-sm"
                      href={current.inputsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Submit inputs
                      <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                  {current.releaseUrl && (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={current.releaseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      UNFCCC background
                      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                </div>
                <div className="gysParticipation">
                  <GysSignup embedded />
                </div>
              </section>

              <Section label={`${current.year} policy priorities`}>
                <div className="gysPriorityGroups">
                  {priorityGroups.map((group) => (
                    <article key={group.name} className="card gysPriorityGroup">
                      <p className="pageEyebrow">{group.name}</p>
                      <ul className="gysPriorityList">
                        {group.items.map((priority) => (
                          <li key={priority.title} className="gysPriority">
                            <h3>{priority.title}</h3>
                            <p className="meta">{priority.body}</p>
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </Section>

              <Section label="How the statement is developed">
                <ol className="gysSteps">
                  {gys.process.map((item, index) => (
                    <li key={item.step} className="card gysStep">
                      <div className="gysStepHeading">
                        <span className="stepNum" aria-hidden>
                          {index + 1}
                        </span>
                        <h3>{item.step}</h3>
                      </div>
                      <p className="meta">
                        {PROCESS_COPY[item.step] || item.body}
                      </p>
                      {index < gys.process.length - 1 && (
                        <span
                          className="gysStepArrow gysStepArrowRight"
                          aria-hidden
                        >
                          <ArrowRight size={18} strokeWidth={1.75} />
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </Section>

              <Section label="Previous statements">
                <div className="gysArchiveGrid">
                  {[...gys.archive]
                    .sort((a, b) => Number(a.year) - Number(b.year))
                    .map((archive) => (
                      <article
                        key={archive.edition}
                        className="card cardTight gysArchiveItem"
                      >
                        <div>
                          <h3>{archive.edition}</h3>
                          <p className="metaMuted">
                            {archive.year} · {archive.host}
                          </p>
                        </div>
                        <div className="gysArchiveLinks">
                          {archive.links.map((link) => (
                            <a
                              key={link.url}
                              className="btn btn-ghost btn-sm"
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {link.label}
                              <ArrowUpRight
                                size={16}
                                strokeWidth={1.75}
                                aria-hidden
                              />
                            </a>
                          ))}
                        </div>
                      </article>
                    ))}
                </div>
              </Section>
            </>
          )
        }}
      </Async>
    </div>
  )
}
