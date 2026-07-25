import { useEffect, useMemo, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  FilePlus2,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { apiGet, apiPost } from '../lib/api.js'
import { useAccount } from '../lib/accountContext.jsx'

function confidenceLabel(value) {
  if (value === 'medium') return 'Evidence-supported'
  if (value === 'low') return 'Limited evidence'
  return 'Insufficient evidence'
}

export function Intelligence() {
  const { account } = useAccount()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState({ status: 'idle', message: '' })
  const [review, setReview] = useState({ items: [], metrics: null, error: '' })
  const [reasons, setReasons] = useState({})
  const citations = useMemo(() => result?.synthesis?.citations || [], [result])

  const refreshReview = async () => {
    if (account?.role !== 'admin') return
    try {
      const [queue, metrics] = await Promise.all([
        apiGet('/intelligence/writebacks'),
        apiGet('/intelligence/metrics'),
      ])
      setReview({ items: queue.items || [], metrics, error: '' })
    } catch (err) {
      setReview((current) => ({ ...current, error: err.message }))
    }
  }
  useEffect(() => {
    refreshReview()
  }, [account?.role])

  const submit = async (event) => {
    event.preventDefault()
    const clean = query.trim()
    if (clean.length < 3) return
    setLoading(true)
    setError('')
    setProposal({ status: 'idle', message: '' })
    try {
      setResult(
        await apiPost('/intelligence/query', { query: clean, limit: 10 }),
      )
    } catch (err) {
      setError(err.message)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const proposeNote = async () => {
    if (!result || !citations.length) return
    setProposal({ status: 'saving', message: '' })
    try {
      const body = [
        result.synthesis.answer,
        ...result.synthesis.bullets.map((item) => `- ${item.text}`),
        '',
        result.synthesis.caveat,
      ].join('\n')
      await apiPost(
        '/intelligence/writebacks',
        {
          action: 'save_research_note',
          title: `Evidence note: ${result.query.slice(0, 120)}`,
          body,
          citations: citations.map((item) => item.evidenceId),
        },
        { 'Idempotency-Key': crypto.randomUUID() },
      )
      setProposal({
        status: 'saved',
        message:
          'Proposed for independent admin review. No source record was changed.',
      })
    } catch (err) {
      setProposal({ status: 'error', message: err.message })
    }
  }

  const reviewWriteback = async (item, action) => {
    try {
      if (action === 'approve')
        await apiPost(`/intelligence/writebacks/${item.id}/approve`, {
          reason: reasons[item.id] || '',
        })
      else await apiPost(`/intelligence/writebacks/${item.id}/apply`, {})
      await refreshReview()
    } catch (err) {
      setReview((current) => ({ ...current, error: err.message }))
    }
  }

  return (
    <div className="intelligencePage">
      <div className="intelligenceHero">
        <div>
          <p className="metaMuted">Evidence workspace</p>
          <h1 className="rowGap">
            <BrainCircuit size={26} strokeWidth={1.7} aria-hidden />
            Hub Intelligence
          </h1>
          <p className="meta intelligenceIntro">
            Ask across YOUNGO Hub events, submissions, Council decisions, COYs,
            working groups, public resources, and the role-scoped context you
            are allowed to see.
          </p>
        </div>
        <div className="intelligenceTrust">
          <ShieldCheck size={18} aria-hidden />
          <span>
            Read-only by default
            <br />
            <small>Private queries are audited</small>
          </span>
        </div>
      </div>

      <form className="intelligenceAsk" onSubmit={submit}>
        <label htmlFor="intelligence-query">Question</label>
        <div className="intelligenceAskRow">
          <textarea
            id="intelligence-query"
            className="input textarea"
            rows="3"
            maxLength="500"
            placeholder="What deadlines and decisions should the climate finance working group know about?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="btn btn-primary"
            disabled={loading || query.trim().length < 3}
          >
            {loading ? (
              'Searching…'
            ) : (
              <>
                <Search size={17} aria-hidden />
                Find evidence
              </>
            )}
          </button>
        </div>
        <p className="metaMuted">
          The answer is extractive and citation-first. Verify source status
          before acting.
        </p>
      </form>

      {error && (
        <div className="card intelligenceError" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="intelligenceResults">
          <section className="card intelligenceSynthesis">
            <div className="intelligenceResultHead">
              <div>
                <p className="metaMuted">Synthesis · {result.audience} scope</p>
                <h2>{result.synthesis.answer}</h2>
              </div>
              <span
                className={`evidenceConfidence confidence-${result.synthesis.confidence}`}
              >
                {confidenceLabel(result.synthesis.confidence)}
              </span>
            </div>
            {result.synthesis.bullets.length ? (
              <ol className="intelligenceBullets">
                {result.synthesis.bullets.map((item, index) => (
                  <li key={index}>
                    {item.text}{' '}
                    {item.citationIndexes.map((citation) => (
                      <a
                        key={citation}
                        className="citationChip"
                        href={`#evidence-${citation}`}
                      >
                        [{citation}]
                      </a>
                    ))}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="meta">
                Try a more specific phrase, working group, deadline, location,
                or decision title.
              </p>
            )}
            <p className="intelligenceCaveat">{result.synthesis.caveat}</p>
            {citations.length > 0 && (
              <div className="intelligenceActions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={proposeNote}
                  disabled={proposal.status === 'saving'}
                >
                  <FilePlus2 size={15} aria-hidden />
                  {proposal.status === 'saving'
                    ? 'Proposing…'
                    : 'Propose research note'}
                </button>
                <span
                  className={`meta ${proposal.status === 'error' ? 'intelligenceErrorText' : ''}`}
                >
                  {proposal.status === 'saved' && (
                    <CheckCircle2 size={14} aria-hidden />
                  )}{' '}
                  {proposal.message}
                </span>
              </div>
            )}
          </section>

          <section>
            <div className="sectionLabel">
              <span>Evidence ({result.evidence.length})</span>
              <span>{result.policy.indexedSources.join(' · ')}</span>
            </div>
            <div className="intelligenceEvidenceGrid">
              {result.evidence.map((item, index) => (
                <article
                  className="card intelligenceEvidence"
                  id={`evidence-${index + 1}`}
                  key={item.id}
                >
                  <div className="intelligenceEvidenceMeta">
                    <span>
                      [{index + 1}] {item.sourceType}
                    </span>
                    <span>{item.audience}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="meta">{item.snippet}</p>
                  <div className="intelligenceEvidenceFoot">
                    <span className="metaMuted">
                      signals: {item.signals.join(', ')} · score{' '}
                      {item.score.toFixed(4)}
                    </span>
                    <a className="btn btn-ghost btn-sm" href={item.url}>
                      Open <ExternalLink size={13} aria-hidden />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <details className="card intelligencePolicy">
            <summary>Access and field policy</summary>
            <p className="meta">
              Indexed for this query: {result.policy.indexedSources.join(', ')}.
            </p>
            <p className="meta">
              Always excluded: {result.policy.alwaysExcluded.join(', ')}.
            </p>
            <p className="metaMuted">
              Signed in as {account?.name}. Audience resolved to{' '}
              {result.audience}.
            </p>
          </details>
        </div>
      )}

      {account?.role === 'admin' && (
        <section className="card intelligenceReview">
          <div className="intelligenceResultHead">
            <div>
              <p className="metaMuted">Controlled writeback</p>
              <h2>Independent review queue</h2>
            </div>
            {review.metrics && (
              <span className="evidenceConfidence">
                {review.metrics.queries.total} queries ·{' '}
                {review.metrics.queries.last_24h} today
              </span>
            )}
          </div>
          <p className="meta">
            Only cited research notes are supported. The proposing admin cannot
            approve their own proposal, and approval is required before
            application.
          </p>
          {review.error && (
            <p className="intelligenceErrorText meta">{review.error}</p>
          )}
          <div className="stackSm" style={{ marginTop: 12 }}>
            {review.items.length === 0 && (
              <p className="metaMuted">No writeback proposals.</p>
            )}
            {review.items.map((item) => {
              const proposedBy = item.proposed_by || item.proposedBy
              const payload = item.payload || {}
              return (
                <div className="intelligenceQueueItem" key={item.id}>
                  <div>
                    <strong>{payload.title || item.action}</strong>
                    <p className="metaMuted">
                      {item.status} · proposed by{' '}
                      {proposedBy === account.id ? 'you' : proposedBy}
                    </p>
                  </div>
                  {item.status === 'proposed' && proposedBy !== account.id && (
                    <input
                      className="input"
                      placeholder="Approval reason (required)"
                      value={reasons[item.id] || ''}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    />
                  )}
                  <div className="rowGap">
                    {item.status === 'proposed' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={
                          proposedBy === account.id ||
                          (reasons[item.id] || '').trim().length < 8
                        }
                        onClick={() => reviewWriteback(item, 'approve')}
                      >
                        Approve
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => reviewWriteback(item, 'apply')}
                      >
                        Apply note
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
