import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  LifecycleTiming,
  Timeline,
  A,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { DestinationIcon } from '../components/DestinationLink.jsx'

const STEPS = ['Open', 'Drafting', 'Internal review', 'Submitted']
const STEP_INDEX = {
  open: 0,
  drafting: 1,
  internal_review: 2,
  submitted: 3,
  archived: 3,
}

export function SubmissionDetail({ slug }) {
  const query = useApi(`/submissions/${slug}`)
  return (
    <div className="detailPage">
      <BackLink href="/submissions">Submissions</BackLink>
      <Async query={query}>
        {(sub) => {
          const archived = !['open', 'drafting', 'internal_review'].includes(
            sub.status,
          )
          return (
            <>
              <PageHeader title={sub.title}>
                <div className="detailHeaderMeta">
                  {sub.wg && (
                    <A
                      href={`/groups/${sub.wg.slug}`}
                      className="chip chip-neutral"
                    >
                      {sub.wg.name} WG
                    </A>
                  )}
                </div>
              </PageHeader>

              <Section label="Progress">
                <div className="card detailProcess">
                  <LifecycleTiming
                    status={sub.status}
                    iso={sub.deadlineAt}
                    label={archived ? 'Submitted' : 'Deadline'}
                    showCountdown={!archived}
                    className="detailLifecycleTiming"
                  />
                  <Timeline
                    steps={STEPS}
                    currentIndex={STEP_INDEX[sub.status] ?? 0}
                  />
                </div>
              </Section>

              {!archived && (
                <Section label="How to contribute">
                  <div className="card detailPanel detailActionPanel">
                    {sub.contributeNote && (
                      <p className="meta">{sub.contributeNote}</p>
                    )}
                    <div className="detailActions">
                      {sub.draftUrl && (
                        <a
                          className="btn btn-primary"
                          href={sub.draftUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon url={sub.draftUrl} size={18} />
                          {/forms\.gle|docs\.google\.com\/forms/i.test(
                            sub.draftUrl,
                          )
                            ? 'Submit inputs'
                            : 'Open draft'}
                        </a>
                      )}
                      {sub.unfcccUrl && (
                        <a
                          className="btn btn-secondary"
                          href={sub.unfcccUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon url={sub.unfcccUrl} size={18} />
                          UNFCCC reference
                        </a>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {archived && sub.finalUrl && (
                <Section label="Published submission">
                  <div className="detailActions detailStandaloneActions detailPageActions">
                    <a
                      className="btn btn-primary"
                      href={sub.finalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <DestinationIcon url={sub.finalUrl} size={18} />
                      Final submission
                    </a>
                    {sub.unfcccUrl && (
                      <a
                        className="btn btn-secondary"
                        href={sub.unfcccUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <DestinationIcon url={sub.unfcccUrl} size={18} />
                        UNFCCC reference
                      </a>
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
