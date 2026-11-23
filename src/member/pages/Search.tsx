interface DirectMatchesProps {
  query: string
  data: SearchResponse
}

import type {} from 'react-icons'
import type {
  IntelligenceMetrics,
  IntelligenceResult,
  SearchResponse,
  WritebackView,
} from '../../shared/contracts'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  TbCircleCheck as CheckCircle2,
  TbExternalLink as ExternalLink,
  TbFilePlus as FilePlus2,
  TbSearch as SearchIcon,
  TbShieldCheck as ShieldCheck,
} from 'react-icons/tb'
import { apiGet, apiPost, useApi, errorMessage } from '../lib/api'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { jumpTo, replace, useQuery } from '../lib/router'
import { useAccount } from '../lib/accountContext'
import { A, Async, Empty, PageHeader, Section } from '../components/ui'
import { DIRECT_SECTIONS, type DirectSection } from '../lib/searchSections'

function confidenceLabel(value: IntelligenceResult['synthesis']['confidence']) {
  if (value === 'medium') return 'Evidence-supported'
  if (value === 'low') return 'Limited evidence'
  return 'Insufficient evidence'
}

function SectionResults({ group, data }: { group: DirectSection; data: SearchResponse }) {
  const matches = group.matches(data)
  if (!matches.length) return null
  return (
    <Section label={group.label}>
      <div className="cardGrid">
        {matches.map(({ key, title, href, line, Icon }) => (
          <A key={key} href={href} className="card cardTight searchResult">
            <div className="searchResultCopy">
              <p className="searchResultTitle">{title}</p>
              <p className="metaMuted">{line}</p>
            </div>
            <Icon
              className="cardCornerIcon searchResultIcon"
              size={18}
              strokeWidth={1.75}
              aria-hidden
            />
          </A>
        ))}
      </div>
    </Section>
  )
}

function DirectMatches({ query, data }: DirectMatchesProps) {
  const total = DIRECT_SECTIONS.reduce((count, group) => count + group.matches(data).length, 0)
  if (!total)
    return (
      <Empty
        icon={SearchIcon}
        title="No direct matches"
        body={`Nothing indexed matches “${query}”.`}
      />
    )
  return (
    <div className="searchResults">
      {DIRECT_SECTIONS.map((group) => (
        <SectionResults key={group.key} group={group} data={data} />
      ))}
    </div>
  )
}

export function Search() {
  const { account } = useAccount()
  const initialQuery = useQuery().get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  // Debounced: each /search call scans six collections — do not fire per
  // keystroke.
  const debouncedQuery = useDebouncedValue(query.trim())
  const direct = useApi<SearchResponse>(
    debouncedQuery ? `/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    {
      keepPrevious: true,
    },
  )
  const [result, setResult] = useState<IntelligenceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState<{ status: string; message: string }>({
    status: 'idle',
    message: '',
  })
  const [review, setReview] = useState<{
    items: WritebackView[]
    metrics: IntelligenceMetrics | null
    error: string
  }>({ items: [], metrics: null, error: '' })
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const citations = useMemo(() => result?.citations ?? [], [result])

  const isOperator = (account?.access?.capabilities || []).includes('intelligence.operations.read')
  const refreshReview = useCallback(async () => {
    if (!isOperator) return
    try {
      const [queue, metrics] = await Promise.all([
        apiGet('/intelligence/writebacks') as Promise<{ items: WritebackView[] }>,
        apiGet('/intelligence/metrics') as Promise<IntelligenceMetrics>,
      ])
      setReview({ items: queue.items ?? [], metrics, error: '' })
    } catch (requestError) {
      setReview((current) => ({ ...current, error: errorMessage(requestError) }))
    }
  }, [isOperator])

  useEffect(() => {
    refreshReview()
  }, [refreshReview])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const clean = query.trim()
    if (clean.length < 3) return
    setLoading(true)
    setError('')
    setProposal({ status: 'idle', message: '' })
    replace(`/search?q=${encodeURIComponent(clean)}`, { scroll: false })
    try {
      setResult(
        (await apiPost('/intelligence/query', { query: clean, limit: 10 })) as IntelligenceResult,
      )
    } catch (requestError) {
      setError(errorMessage(requestError))
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
        message: 'Proposed for independent admin review. No source record was changed.',
      })
    } catch (requestError) {
      setProposal({ status: 'error', message: errorMessage(requestError) })
    }
  }

  const reviewWriteback = async (item: WritebackView, action: 'approve' | 'apply') => {
    try {
      if (action === 'approve')
        await apiPost(`/intelligence/writebacks/${item.id}/approve`, {
          reason: reasons[item.id] || '',
        })
      else await apiPost(`/intelligence/writebacks/${item.id}/apply`, {})
      await refreshReview()
    } catch (requestError) {
      setReview((current) => ({
        ...current,
        error: errorMessage(requestError),
      }))
    }
  }

  return (
    <div className="intelligencePage">
      <PageHeader
        title="Search"
        description="Find a record directly or ask a question across the Hub. Answers use only evidence your account is allowed to access."
        action={
          <div className="intelligenceTrust">
            <span>
              <strong>
                <ShieldCheck size={18} aria-hidden />
                Citation-first
              </strong>
              <small>Private questions are audited</small>
            </span>
          </div>
        }
      />

      <form className="intelligenceAsk" onSubmit={submit}>
        <label htmlFor="hub-search">Search or ask a question</label>
        <div className="intelligenceAskRow">
          <input
            id="hub-search"
            className="input"
            type="search"
            maxLength={500}
            autoFocus
            placeholder="What deadlines should the Finance WG know about?"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setResult(null)
            }}
          />
          <button className="btn btn-primary" disabled={loading || query.trim().length < 3}>
            <SearchIcon size={17} aria-hidden />
            {loading ? 'Searching…' : 'Search Hub'}
          </button>
        </div>
        <p className="metaMuted">
          Direct matches update as you type. Submit to get a cited, role-scoped answer.
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
                <p className="metaMuted">Answer · {result.audience} scope</p>
                <h2>{result.synthesis.answer}</h2>
              </div>
              <span className={`evidenceConfidence confidence-${result.synthesis.confidence}`}>
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
                        onClick={(e) => {
                          e.preventDefault()
                          jumpTo(`evidence-${citation}`)
                        }}
                      >
                        [{citation}]
                      </a>
                    ))}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="meta">
                Try a more specific title, working group, deadline, location or decision.
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
                  {proposal.status === 'saving' ? 'Proposing…' : 'Propose research note'}
                </button>
                <span
                  className={`meta ${proposal.status === 'error' ? 'intelligenceErrorText' : ''}`}
                >
                  {proposal.status === 'saved' && <CheckCircle2 size={14} aria-hidden />}{' '}
                  {proposal.message}
                </span>
              </div>
            )}
          </section>

          <Section label={`Evidence (${result.evidence.length})`}>
            <div className="cardGrid">
              {result.evidence.map((item, index) => (
                <article
                  className="card intelligenceEvidence"
                  id={`evidence-${index + 1}`}
                  key={item.evidenceId}
                >
                  <div className="intelligenceEvidenceMeta">
                    <span>
                      [{index + 1}] {item.sourceType}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="meta">{item.snippet}</p>
                  <div className="intelligenceEvidenceFoot">
                    {item.score != null && (
                      <span className="metaMuted">Score {item.score.toFixed(4)}</span>
                    )}
                    <a className="btn btn-ghost btn-sm" href={item.url}>
                      Open <ExternalLink size={13} aria-hidden />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        </div>
      )}

      {debouncedQuery ? (
        <Section label="Direct matches">
          {/* Async gates on loading, so `data` always belongs to the current
              debounced query — keepPreviousData can only surface while the
              key is null, which this branch already excludes. */}
          <Async query={direct} skeletons={3}>
            {(data) => data && <DirectMatches query={debouncedQuery} data={data} />}
          </Async>
        </Section>
      ) : (
        <Empty
          icon={SearchIcon}
          title="Start typing"
          body="Find records as you type, or submit a question for a cited answer."
        />
      )}

      {isOperator && (
        <Section
          label="Research-note review"
          action={review.metrics && <span>{review.metrics.notesTotal} research notes</span>}
        >
          <p className="meta">
            A different administrator must approve a cited note before it can be applied.
          </p>
          {review.error && <p className="intelligenceErrorText meta">{review.error}</p>}
          <div className="stackSm searchReviewQueue">
            {review.items.length === 0 && <p className="metaMuted">No research-note proposals.</p>}
            {review.items.map((item) => {
              // writebackView: account is { id, name }, approvedBy an id
              const own = String(item.account?.id) === String(account?.id)
              const reviewable = item.status === 'pending_review' || item.status === 'draft'
              return (
                <div className="intelligenceQueueItem" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <p className="metaMuted">
                      {item.status.replaceAll('_', ' ')} · proposed by{' '}
                      {own ? 'you' : item.account?.name || 'another member'}
                    </p>
                  </div>
                  {reviewable && !own && (
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
                    {reviewable && (
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={own || (reasons[item.id] || '').trim().length < 8}
                        onClick={() => reviewWriteback(item, 'approve')}
                      >
                        Approve
                      </button>
                    )}
                    {item.status === 'approved' && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={String(item.approvedBy) === String(account?.id)}
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
        </Section>
      )}
    </div>
  )
}
