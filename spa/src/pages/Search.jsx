import { useEffect, useMemo, useState } from 'react'
import {
  TbAddressBook as AddressBook,
  TbCalendar as CalendarDays,
  TbCircleCheck as CheckCircle2,
  TbExternalLink as ExternalLink,
  TbFilePlus as FilePlus2,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbGlobe as Globe,
  TbSearch as SearchIcon,
  TbShieldCheck as ShieldCheck,
} from 'react-icons/tb'
import { apiGet, apiPost, useApi } from '../lib/api.js'
import { useAccount } from '../lib/accountContext.jsx'
import { A, Async, Empty, PageHeader, Section } from '../components/ui.jsx'
import { fmtDual, fmtDateRange } from '../lib/time.js'
import { workingGroupIcon } from '../lib/workingGroupIcons.js'

const GROUPS = [
  {
    key: 'events',
    label: 'Events',
    to: (event) => `/calendar/${event.slug}`,
    line: (event) => fmtDual(event.startsAt),
    icon: (event) => (event.wg?.slug ? workingGroupIcon(event.wg.slug) : CalendarDays),
  },
  {
    key: 'submissions',
    label: 'Submissions',
    to: (submission) => `/submissions/${submission.slug}`,
    line: (submission) => submission.wg?.name || submission.status,
    icon: (submission) => (submission.wg?.slug ? workingGroupIcon(submission.wg.slug) : FileText),
  },
  {
    key: 'decisions',
    label: 'Council',
    to: (decision) => `/council/${decision.slug}`,
    line: (decision) => decision.proposer,
    icon: () => Gavel,
  },
  {
    key: 'coys',
    label: 'COYs',
    to: (coy) => `/coys/${coy.slug}`,
    line: (coy) => fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc),
    icon: () => Globe,
  },
  {
    key: 'groups',
    label: 'Working groups',
    to: (group) => `/groups/${group.slug}`,
    line: (group) => group.focusLine,
    icon: (group) => workingGroupIcon(group.slug),
  },
  {
    key: 'contacts',
    label: 'Directory',
    to: () => '/directory',
    line: (contact) => contact.description,
    icon: () => AddressBook,
  },
]

function confidenceLabel(value) {
  if (value === 'medium') return 'Evidence-supported'
  if (value === 'low') return 'Limited evidence'
  return 'Insufficient evidence'
}

function DirectMatches({ query, data }) {
  const total = GROUPS.reduce((count, group) => count + (data[group.key]?.length || 0), 0)
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
      {GROUPS.filter((group) => data[group.key]?.length).map((group) => (
        <Section key={group.key} label={group.label}>
          <div className="cardGrid">
            {data[group.key].map((item, index) => {
              const ResultIcon = group.icon(item)
              return (
                <A
                  key={item.slug || item.id || index}
                  href={group.to(item)}
                  className="card cardTight searchResult"
                >
                  <div className="searchResultCopy">
                    <p className="searchResultTitle">{item.title || item.name || item.roleTitle}</p>
                    <p className="metaMuted">{group.line(item)}</p>
                  </div>
                  <ResultIcon
                    className="cardCornerIcon searchResultIcon"
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </A>
              )
            })}
          </div>
        </Section>
      ))}
    </div>
  )
}

export function Search() {
  const { account } = useAccount()
  const initialQuery = new URLSearchParams(window.location.search).get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const direct = useApi(`/search?q=${encodeURIComponent(query)}`, [query])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [proposal, setProposal] = useState({ status: 'idle', message: '' })
  const [review, setReview] = useState({ items: [], metrics: null, error: '' })
  const [reasons, setReasons] = useState({})
  const citations = useMemo(() => result?.synthesis?.citations || [], [result])

  const isOperator = (account?.access?.capabilities || []).includes('intelligence.operations.read')
  const refreshReview = async () => {
    if (!isOperator) return
    try {
      const [queue, metrics] = await Promise.all([
        apiGet('/intelligence/writebacks'),
        apiGet('/intelligence/metrics'),
      ])
      setReview({ items: queue.items || [], metrics, error: '' })
    } catch (requestError) {
      setReview((current) => ({ ...current, error: requestError.message }))
    }
  }

  useEffect(() => {
    refreshReview()
  }, [isOperator])

  const submit = async (event) => {
    event.preventDefault()
    const clean = query.trim()
    if (clean.length < 3) return
    setLoading(true)
    setError('')
    setProposal({ status: 'idle', message: '' })
    window.history.replaceState({}, '', `/search?q=${encodeURIComponent(clean)}`)
    try {
      setResult(await apiPost('/intelligence/query', { query: clean, limit: 10 }))
    } catch (requestError) {
      setError(requestError.message)
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
      setProposal({ status: 'error', message: requestError.message })
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
    } catch (requestError) {
      setReview((current) => ({
        ...current,
        error: requestError.message,
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
            maxLength="500"
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
                      <a key={citation} className="citationChip" href={`#evidence-${citation}`}>
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

          <Section
            label={`Evidence (${result.evidence.length})`}
            action={<span>{result.policy.indexedSources.join(' · ')}</span>}
          >
            <div className="cardGrid">
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
                    <span className="metaMuted">Score {item.score.toFixed(4)}</span>
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

      {query.trim() ? (
        <Section label="Direct matches">
          <Async query={direct} skeletons={3}>
            {(data) => <DirectMatches query={query} data={data} />}
          </Async>
        </Section>
      ) : (
        <Empty
          icon={SearchIcon}
          title="Search the Hub"
          body="Start typing to find records. Submit a question for a cited answer."
        />
      )}

      {isOperator && (
        <Section
          label="Research-note review"
          action={
            review.metrics && (
              <span>
                {review.metrics.queries.total} questions · {review.metrics.queries.last_24h} today
              </span>
            )
          }
        >
          <p className="meta">
            A different administrator must approve a cited note before it can be applied.
          </p>
          {review.error && <p className="intelligenceErrorText meta">{review.error}</p>}
          <div className="stackSm searchReviewQueue">
            {review.items.length === 0 && <p className="metaMuted">No research-note proposals.</p>}
            {review.items.map((item) => {
              const proposedBy = item.proposed_by || item.proposedBy
              const payload = item.payload || {}
              return (
                <div className="intelligenceQueueItem" key={item.id}>
                  <div>
                    <strong>{payload.title || item.action}</strong>
                    <p className="metaMuted">
                      {item.status} · proposed by {proposedBy === account.id ? 'you' : proposedBy}
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
                          proposedBy === account.id || (reasons[item.id] || '').trim().length < 8
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
        </Section>
      )}
    </div>
  )
}
