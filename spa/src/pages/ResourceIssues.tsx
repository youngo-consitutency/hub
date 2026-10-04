interface ResourceQueueProps {
  account?: any
}

interface LinkReviewProps {
  item?: any
  issues?: any
  previous?: any
  onClose?: any
  onSaved?: any
  onCorrect?: any
}

interface SubmissionReviewProps {
  item?: any
  account?: any
  onClose?: any
  onSaved?: any
}

import { SidePanel } from '../components/SidePanel.tsx'
import { TbShieldCheck as ReviewIcon } from 'react-icons/tb'
import { regionLabel } from '../lib/regions'
import { useState } from 'react'
import { optionLabel as resourceLabel, useContentOptions } from '../lib/documents'
import { ResourceCard, ResourceSubmissionPanel } from '../components/ResourceHub'
import { A, Async, Button, Empty, ErrorCard, PageHeader } from '../components/ui'
import { useAccount } from '../lib/accountContext'
import { apiPost, useApi } from '../lib/api'

export function ResourceIssues() {
  const { account } = useAccount()
  if (!account?.access?.capabilities?.includes('content.review'))
    return (
      <Empty
        title="Content Publisher access required"
        body="Content Publishers verify resource links and resolve reports. Members can report issues from the catalogue."
      />
    )
  return <ResourceQueue account={account} />
}

function ResourceQueue({ account }: ResourceQueueProps) {
  const query = useApi('/member/resources/issues')
  const [filter, setFilter] = useState('needs_verification')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [correction, setCorrection] = useState<any>(null)
  const [limit, setLimit] = useState(12)
  const [message, setMessage] = useState('')
  const data = query.data
  const items =
    (filter === 'submissions' ? data?.submissions : data?.items)?.filter((item: any) => {
      const title = item.title || item.payload.title
      return (
        title.toLowerCase().includes(search.toLowerCase()) &&
        (filter === 'submissions' || filter === 'reported'
          ? filter === 'submissions' || item.verification.openIssues > 0
          : item.verification.status === filter)
      )
    }) || []
  function saved(text: any) {
    setSelected(null)
    setMessage(text)
    query.retry()
  }
  return (
    <div>
      <PageHeader
        icon={ReviewIcon}
        title="Resource issues & verification"
        description="Content Publishers own this queue. Ask Science Working Group contributors for subject expertise when needed. Check the link, relevance, and tags before verifying."
        action={
          <A className="btn btn-secondary" href="/resources">
            Back to resources
          </A>
        }
      />
      {message && (
        <p className="noticeBanner" role="status">
          {message}
        </p>
      )}
      <div className="resourceQueueFilters">
        <label>
          Queue
          <select
            className="input"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value)
              setLimit(12)
              setSelected(null)
            }}
          >
            <option value="needs_verification">
              Needs verification (
              {data?.items.filter((i: any) => i.verification.status === 'needs_verification')
                .length || 0}
              )
            </option>
            <option value="reported">Reported issues ({data?.issues.length || 0})</option>
            <option value="submissions">
              New submissions & edits ({data?.submissions.length || 0})
            </option>
            <option value="needs_changes">Needs attention</option>
            <option value="verified">Verified</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <label>
          Search titles
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setLimit(12)
            }}
            placeholder="Find a resource"
          />
        </label>
      </div>
      {selected && filter === 'submissions' && (
        <SidePanel title="Review resource submission" onClose={() => setSelected(null)}>
          <SubmissionReview
            key={selected.id}
            item={selected}
            account={account}
            onClose={() => setSelected(null)}
            onSaved={saved}
          />
        </SidePanel>
      )}
      {selected && filter !== 'submissions' && (
        <SidePanel title="Verify resource" onClose={() => setSelected(null)}>
          <LinkReview
            key={selected.slug + selected.fingerprint}
            item={selected}
            issues={(data?.issues || []).filter((i: any) => i.resourceSlug === selected.slug)}
            previous={data?.reviews.find((i: any) => i.resourceSlug === selected.slug)}
            onClose={() => setSelected(null)}
            onSaved={saved}
            onCorrect={() => {
              setCorrection(selected)
              setSelected(null)
            }}
          />
        </SidePanel>
      )}
      {correction && (
        <ResourceSubmissionPanel
          key={correction.slug}
          initialResource={correction}
          onCancel={() => {
            setCorrection(null)
            query.retry()
          }}
        />
      )}
      <Async query={query}>
        {() =>
          items.length ? (
            <>
              <p className="metaMuted" role="status">
                {items.length} resources in this queue
              </p>
              <div className="cardGrid resourceHubGrid">
                {items.slice(0, limit).map((item: any) => (
                  <ResourceCard
                    key={item.slug || item.id}
                    resource={item.payload || item}
                    onReview={() => {
                      setSelected(item)
                      setMessage('')
                    }}
                  />
                ))}
              </div>
              {items.length > limit && (
                <div className="resourceLoadMore">
                  <Button variant="secondary" onClick={() => setLimit((value) => value + 12)}>
                    Show more
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Empty title="Queue clear" body="There are no matching resources in this queue." />
          )
        }
      </Async>
    </div>
  )
}

function LinkReview({ item, issues, previous, onClose, onSaved, onCorrect }: LinkReviewProps) {
  const {
    resourcePathways: RESOURCE_PATHWAYS,
    resourceTypes: RESOURCE_TYPES,
    resourceIssueKinds: RESOURCE_ISSUE_KINDS,
  } = useContentOptions()
  const [checks, setChecks] = useState<Record<string, any>>({
    link: false,
    description: false,
    tags: false,
  })
  const [status, setStatus] = useState('verified')
  const [note, setNote] = useState('')
  const [resolved, setResolved] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: any) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiPost(`/member/resources/${item.slug}/verify`, {
        fingerprint: item.fingerprint,
        status,
        note,
        checks,
        resolvedIssueIds: resolved,
      })
      onSaved(
        status === 'retired'
          ? 'Resource retired from the public catalogue.'
          : 'Review saved. The catalogue now shows the updated verification state.',
      )
    } catch (error) {
      setError((error as any).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="card resourceSubmissionForm resourceReview" onSubmit={submit}>
      <h2>{item.title}</h2>
      <a
        className="inlineLink resourceDestination"
        href={item.url}
        target="_blank"
        rel="noreferrer"
      >
        {item.url} ↗
      </a>
      <p>{item.summary}</p>
      <p className="meta">
        {resourceLabel(RESOURCE_PATHWAYS, item.pathway)} ·{' '}
        {resourceLabel(RESOURCE_TYPES, item.type)} · {item.topics.join(', ')} ·{' '}
        {regionLabel(item.region)} · {item.language}
      </p>
      {item.source && (
        <p className="metaMuted">
          Imported from{' '}
          <a
            className="inlineLink"
            target="_blank"
            rel="noreferrer"
            href={`${item.source.repository}/blob/${item.source.commit}/${item.source.path}`}
          >
            Resources
          </a>
          . Original group: {item.source.category} / {item.source.subcategory}. The source listing
          date is not a verification date.
        </p>
      )}
      {previous && (
        <p className="contentReviewNote">
          Previous review by {previous.reviewerName || 'a Content Publisher'} (
          {new Date(previous.reviewedAt).toLocaleDateString()}): {previous.note}
        </p>
      )}
      {issues.length > 0 && (
        <fieldset className="resourceTopicPicker">
          <legend>Open reports</legend>
          {issues.map((issue: any) => (
            <label key={issue.id} className="resourceCheck resourceIssue">
              <input
                type="checkbox"
                checked={resolved.includes(issue.id)}
                onChange={(event) =>
                  setResolved(
                    event.target.checked
                      ? [...resolved, issue.id]
                      : resolved.filter((id) => id !== issue.id),
                  )
                }
              />
              <span>
                <strong>
                  {RESOURCE_ISSUE_KINDS.find((k: any) => k.value === issue.kind)?.label}
                </strong>{' '}
                — {issue.detail}
                <small className="metaMuted">
                  {' '}
                  Select only if your review resolves this report.
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="resourceTopicPicker">
        <legend>Human verification</legend>
        {[
          ['link', 'I opened the destination and it is accessible and appropriate.'],
          [
            'description',
            'The title and description accurately explain a useful climate resource.',
          ],
          ['tags', 'The pathway, topic tags, type, region, and language are appropriate.'],
        ].map(([key, label]) => (
          <label className="resourceCheck" key={key}>
            <input
              type="checkbox"
              checked={(checks as any)[key]}
              onChange={(event) =>
                setChecks((current) => ({
                  ...current,
                  [key]: event.target.checked,
                }))
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Result
        <select
          className="input"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="verified">Verified</option>
          <option value="needs_changes">Needs attention — keep visible with warning</option>
          <option value="retired">Retire — hide from public catalogue</option>
        </select>
      </label>
      <label>
        Review note
        <textarea
          className="input textarea"
          required
          minLength={8}
          maxLength={2000}
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What you checked, what changed, or why it needs attention"
        />
      </label>
      <p className="metaMuted">
        Edits need independent publication. Saving “needs attention” keeps reports open.
      </p>
      {error && <ErrorCard message={error} />}
      <div className="resourceCardActions">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save review'}
        </Button>
        <Button variant="secondary" onClick={onCorrect}>
          Suggest correction
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function SubmissionReview({ item, account, onClose, onSaved }: SubmissionReviewProps) {
  const { resourcePathways: RESOURCE_PATHWAYS, resourceTypes: RESOURCE_TYPES } = useContentOptions()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)
  async function act(decision: any) {
    setBusy(true)
    setError('')
    try {
      const endpoint = decision === 'publish' ? 'publish' : 'review'
      await apiPost(`/member/content/drafts/${item.id}/${endpoint}`, {
        decision,
        note,
      })
      onSaved(
        decision === 'publish'
          ? 'Resource published. Complete its link verification in the verification queue.'
          : 'Submission review saved.',
      )
    } catch (error) {
      setError((error as any).message)
    } finally {
      setBusy(false)
    }
  }
  const own = item.createdBy === account.id
  return (
    <section className="card resourceSubmissionForm resourceReview">
      <h2>{item.payload.title}</h2>
      <a
        className="inlineLink resourceDestination"
        href={item.payload.url}
        target="_blank"
        rel="noreferrer"
      >
        {item.payload.url} ↗
      </a>
      <p>{item.payload.summary}</p>
      <p className="meta">
        {resourceLabel(RESOURCE_PATHWAYS, item.payload.pathway)} ·{' '}
        {resourceLabel(RESOURCE_TYPES, item.payload.type)} ·{' '}
        {(item.payload.topics || [item.payload.topic]).join(', ')} ·{' '}
        {regionLabel(item.payload.region)} · {item.payload.language}
      </p>
      <p className="metaMuted">
        Submitted by {item.creatorName || 'a member'} ·{' '}
        {item.status === 'approved' ? 'Approved, awaiting publication' : 'Awaiting review'}
      </p>
      {item.reviewNote && <p className="contentReviewNote">{item.reviewNote}</p>}
      {own ? (
        <p className="noticeBanner">
          Another Content Publisher must review and publish your submission.
        </p>
      ) : (
        <>
          <label className="resourceCheck">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            I checked the destination, description, and tags.
          </label>
          <label>
            Feedback
            <textarea
              className="input textarea"
              maxLength={2000}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <div className="resourceCardActions">
            {item.status === 'approved' ? (
              <Button variant="primary" disabled={busy || !checked} onClick={() => act('publish')}>
                Publish resource
              </Button>
            ) : (
              <>
                <Button
                  variant="primary"
                  disabled={busy || !checked}
                  onClick={() => act('approve')}
                >
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || note.trim().length < 3}
                  onClick={() => act('request_changes')}
                >
                  Request changes
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || note.trim().length < 3}
                  onClick={() => act('reject')}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </>
      )}
      {error && <ErrorCard message={error} />}
      <Button variant="ghost" onClick={onClose}>
        Close review
      </Button>
    </section>
  )
}
