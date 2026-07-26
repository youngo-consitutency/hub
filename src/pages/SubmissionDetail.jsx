import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  CountdownChip,
  Timeline,
  A,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { fmtMoment } from '../lib/time.js'
import { FileText, ArrowUpRight, ExternalLink } from 'lucide-react'

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
          const deadline = fmtMoment(sub.deadlineAt)
          return (
            <>
              <PageHeader eyebrow="Submission" title={sub.title}>
                <div className="detailHeaderMeta">
                  <StatusChip status={sub.status} />
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

              <Section label="Submission process">
                <div className="card detailProcess">
                  <div className="detailDeadline">
                    <div>
                      <p className="metaMuted detailMetaLabel">
                        {archived ? 'Submitted' : 'Deadline'}
                      </p>
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
                    {!archived && (
                      <CountdownChip iso={sub.deadlineAt} label="Closes in" />
                    )}
                  </div>
                  <Timeline
                    steps={STEPS}
                    currentIndex={STEP_INDEX[sub.status] ?? 0}
                  />
                </div>
              </Section>

              {!archived && (
                <Section label="How to contribute">
                  <div className="card detailPanel">
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
                          <FileText size={18} strokeWidth={1.75} aria-hidden />
                          Open draft
                        </a>
                      )}
                      {sub.unfcccUrl && (
                        <a
                          className="btn btn-secondary"
                          href={sub.unfcccUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          UNFCCC reference
                          <ArrowUpRight
                            size={16}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </a>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {archived && sub.finalUrl && (
                <Section label="Published submission">
                  <div className="detailActions detailStandaloneActions">
                    <a
                      className="btn btn-primary"
                      href={sub.finalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
                      Final submission
                    </a>
                    {sub.unfcccUrl && (
                      <a
                        className="btn btn-secondary"
                        href={sub.unfcccUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        UNFCCC reference
                        <ArrowUpRight
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden
                        />
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
