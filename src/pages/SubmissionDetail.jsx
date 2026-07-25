import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  CountdownChip,
  Timeline,
  A,
} from '../components/ui.jsx'
import { fmtDual } from '../lib/time.js'
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
    <div>
      <BackLink href="/submissions">Submissions</BackLink>
      <Async query={query}>
        {(sub) => {
          const archived = !['open', 'drafting', 'internal_review'].includes(
            sub.status,
          )
          return (
            <>
              <div className="rowGap" style={{ marginTop: 8 }}>
                <FileText
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: 'var(--text-2)' }}
                />
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
              <h1 style={{ marginTop: 10 }}>{sub.title}</h1>

              <div className="detailHeroRow">
                <span className="mono detailHero">
                  {archived ? 'Submitted' : 'Due'} {fmtDual(sub.deadlineAt)}
                </span>
                {!archived && <CountdownChip iso={sub.deadlineAt} />}
              </div>

              <Timeline
                steps={STEPS}
                currentIndex={STEP_INDEX[sub.status] ?? 0}
              />

              {!archived && (
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>How to contribute</h3>
                  {sub.contributeNote && (
                    <p className="meta" style={{ marginTop: 6 }}>
                      {sub.contributeNote}
                    </p>
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
              )}

              {archived && sub.finalUrl && (
                <div className="detailActions">
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
                      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                </div>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
