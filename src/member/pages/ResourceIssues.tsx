interface ResourceQueueProps {
  account: Account
}

interface LinkReviewProps {
  item: ResourceSummary
  issues: ResourceIssue[]
  previous?: ResourceReview
  onClose: () => void
  onSaved: (message: string) => void
  onCorrect: () => void
}

interface SubmissionReviewProps {
  item: ContentDraftView
  account: Account
  onClose: () => void
  onSaved: (message: string) => void
}

import type {
  ContentDraftView,
  ResourceIssue,
  ResourceIssuesResponse,
  ResourceReview,
  ResourceSummary,
} from '../../shared/contracts'
import type { ResourceCardData } from '../components/ResourceHub'
import type { Account } from '../lib/types'
import { SidePanel } from '../components/SidePanel.tsx'
import { TbShieldCheck as ReviewIcon } from 'react-icons/tb'
import { regionLabel } from '../lib/regions'
import { useState, type FormEvent } from 'react'
import { optionLabel as resourceLabel, useContentOptions } from '../lib/documents'
import { ResourceCard, ResourceSubmissionPanel } from '../components/ResourceHub'
import { A, Async, Button, Empty, ErrorCard, PageHeader } from '../components/ui'
import { Locked } from '../components/Locked'
import { ACCESS_FAILED, CHECKING_ACCESS } from '../lib/routes'
import { useAccount } from '../lib/accountContext'
import { apiPost, useApi, errorMessage } from '../lib/api'
import { fmtDate } from '../lib/time'

export function ResourceIssues() {
  const { account } = useAccount()
  // access still loading: don't flash the denial
  if (account && !account.access)
    return <Locked {...(account.accessFailed ? ACCESS_FAILED : CHECKING_ACCESS)} />
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
  const query = useApi<ResourceIssuesResponse>('/member/resources/issues')
  const [filter, setFilter] = useState('needs_verification')
  const [search, setSearch] = useState('')
  const [selectedResource, setSelectedResource] = useState<ResourceSummary | null>(null)
  const [selectedDraft, setSelectedDraft] = useState<ContentDraftView | null>(null)
  const clearSelection = () => {
    setSelectedResource(null)
    setSelectedDraft(null)
  }
  const [correction, setCorrection] = useState<ResourceSummary | null>(null)
  const [limit, setLimit] = useState(12)
  const [message, setMessage] = useState('')
  const data = query.data
  const needle = search.toLowerCase()
  // the verification queue lists resources; the submissions queue lists member drafts
  const resources = (data?.items ?? [])
    .filter((item) => {
      if (!item.title.toLowerCase().includes(needle)) return false
      return filter === 'reported'
        ? item.verification.openIssues > 0
        : item.verification.status === filter
    })
    // flagged first, then never checked, then the stalest check
    .sort((a, b) => {
      const rank = (v: ResourceSummary['verification']) => [
        v.openIssues > 0 ? 0 : 1,
        v.checkedAt ? 1 : 0,
      ]
      const [fa, ca] = rank(a.verification)
      const [fb, cb] = rank(b.verification)
      return (
        fa - fb ||
        ca - cb ||
        String(a.verification.checkedAt).localeCompare(String(b.verification.checkedAt))
      )
    })
  const submissions = (data?.submissions ?? []).filter((draft) =>
    String(draft.payload.title ?? '')
      .toLowerCase()
      .includes(needle),
  )
  const queueLength = filter === 'submissions' ? submissions.length : resources.length
  function saved(text: string) {
    clearSelection()
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
              clearSelection()
            }}
          >
            <option value="needs_verification">
              Needs verification (
              {data?.items.filter((i) => i.verification.status === 'needs_verification').length ??
                0}
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
      {selectedDraft && filter === 'submissions' && (
        <SidePanel title="Review resource submission" onClose={clearSelection}>
          <SubmissionReview
            key={selectedDraft.id}
            item={selectedDraft}
            account={account}
            onClose={clearSelection}
            onSaved={saved}
          />
        </SidePanel>
      )}
      {selectedResource && filter !== 'submissions' && (
        <SidePanel title="Verify resource" onClose={clearSelection}>
          <LinkReview
            key={selectedResource.slug + selectedResource.fingerprint}
            item={selectedResource}
            issues={(data?.issues ?? []).filter((i) => i.resourceSlug === selectedResource.slug)}
            previous={data?.reviews.find((i) => i.resourceSlug === selectedResource.slug)}
            onClose={clearSelection}
            onSaved={saved}
            onCorrect={() => {
              setCorrection(selectedResource)
              clearSelection()
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
          queueLength ? (
            <>
              <p className="metaMuted" role="status">
                {queueLength} resources in this queue
              </p>
              <div className="cardGrid resourceHubGrid">
                {filter === 'submissions'
                  ? submissions.slice(0, limit).map((draft) => (
                      <ResourceCard
                        key={draft.id}
                        // a draft's payload is a resource that has not been published or verified yet
                        resource={draft.payload as ResourceCardData}
                        onReview={() => {
                          setSelectedDraft(draft)
                          setMessage('')
                        }}
                      />
                    ))
                  : resources.slice(0, limit).map((item) => (
                      <ResourceCard
                        key={item.slug}
                        resource={item}
                        onReview={() => {
                          setSelectedResource(item)
                          setMessage('')
                        }}
                      />
                    ))}
              </div>
              {queueLength > limit && (
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

const VERIFICATION_CHECKS: ['link' | 'description' | 'tags', string][] = [
  ['link', 'I opened the destination and it is accessible and appropriate.'],
  ['description', 'The title and description accurately explain a useful climate resource.'],
  ['tags', 'The pathway, topic tags, type, region, and language are appropriate.'],
]

function LinkReview({ item, issues, previous, onClose, onSaved, onCorrect }: LinkReviewProps) {
  const {
    resourcePathways: RESOURCE_PATHWAYS,
    resourceTypes: RESOURCE_TYPES,
    resourceIssueKinds: RESOURCE_ISSUE_KINDS,
  } = useContentOptions()
  const [checks, setChecks] = useState<Record<'link' | 'description' | 'tags', boolean>>({
    link: false,
    description: false,
    tags: false,
  })
  const [status, setStatus] = useState('verified')
  const [note, setNote] = useState('')
  const [resolved, setResolved] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
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
      setError(errorMessage(error))
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
          {fmtDate(previous.reviewedAt)}): {previous.note}
        </p>
      )}
      {issues.length > 0 && (
        <fieldset className="resourceTopicPicker">
          <legend>Open reports</legend>
          {issues.map((issue) => (
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
                <strong>{RESOURCE_ISSUE_KINDS.find((k) => k.value === issue.kind)?.label}</strong> —{' '}
                {issue.detail}
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
        {VERIFICATION_CHECKS.map(([key, label]) => (
          <label className="resourceCheck" key={key}>
            <input
              type="checkbox"
              checked={checks[key]}
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
  async function act(decision: 'publish' | 'approve' | 'request_changes' | 'reject') {
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
      setError(errorMessage(error))
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
