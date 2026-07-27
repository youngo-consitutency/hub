import { useApi } from '../lib/api.js'
import { Async, CountdownChip, PageHeader, Section } from '../components/ui.jsx'
import { GysSignup } from '../components/GysSignup.jsx'
import { ArrowUpRight, ExternalLink, ScrollText } from 'lucide-react'

export function Statement() {
  const query = useApi('/gys')

  return (
    <div>
      <Async query={query} skeletons={4}>
        {(gys) => {
          const current = gys.current
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
                  {current.editions.map((edition) => (
                    <span key={edition} className="chip chip-neutral">
                      {edition}
                    </span>
                  ))}
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
              </section>

              <Section label="Take part">
                <GysSignup />
              </Section>

              <Section label={`${current.year} policy priorities`}>
                <div className="cardGrid">
                  {gys.priorities.map((priority) => (
                    <article key={priority.title} className="card gysPriority">
                      <h3>{priority.title}</h3>
                      <p className="meta">{priority.body}</p>
                    </article>
                  ))}
                </div>
              </Section>

              <Section label="How the statement is developed">
                <ol className="gysSteps">
                  {gys.process.map((item, index) => (
                    <li key={item.step} className="card gysStep">
                      <span className="stepNum" aria-hidden>
                        {index + 1}
                      </span>
                      <div>
                        <h3>{item.step}</h3>
                        <p className="meta">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>

              <Section label="Previous statements">
                <div className="stackSm">
                  {gys.archive.map((archive) => (
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
