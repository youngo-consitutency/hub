interface ProjectDetailProps {
  id: string
}

interface SubmissionWorkspaceProps {
  slug?: string
}

import type { AnyValue, Doc } from '../lib/types'
import { useEffect, useRef, useState } from 'react'
import { apiPost, useApi } from '../lib/api'
import { A, Async, BackLink, Empty, PageHeader, Section, StatusChip } from '../components/ui'
import { TbFileDescription as FileDescription, TbHistory as History } from 'react-icons/tb'

const formatDate = (value: AnyValue) =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Unknown date'

function ProjectList() {
  const query = useApi('/negotiations/projects')
  return (
    <div>
      <BackLink href="/submissions">Submissions</BackLink>
      <PageHeader
        title="My submission proposals"
        description="Private working drafts you can access. These are proposals, not endorsed positions or transmitted submissions."
      >
        <A href="/submissions/new" className="btn btn-primary btn-sm">
          New proposal
        </A>
      </PageHeader>
      <Async
        query={query}
        empty={(data: Doc) =>
          data.items.length === 0 ? (
            <Empty
              icon={FileDescription}
              title="No private proposals yet"
              body="Start a cited proposal for a call, or clearly label it as an initiative."
              cta={
                <A href="/submissions/new" className="btn btn-primary btn-sm">
                  Propose a submission
                </A>
              }
            />
          ) : null
        }
      >
        {(data: Doc) => (
          <div className="cardGrid">
            {data.items.map((project: Doc) => (
              <A
                className="card entityCard"
                href={`/submissions/workspace/${project.id}`}
                key={project.id}
              >
                <div className="cardBody">
                  <div className="detailHeaderMeta">
                    <StatusChip status={project.lifecycleStatus} />
                    <span className="muted">Version {project.currentVersion}</span>
                  </div>
                  <h2>{project.title}</h2>
                  <p>{project.purpose}</p>
                  <p className="muted">
                    {project.isInitiative ? 'Member initiative' : 'Call-linked proposal'} ·{' '}
                    {project.track.topic}
                  </p>
                  <p className="muted">Updated {formatDate(project.updatedAt)}</p>
                </div>
              </A>
            ))}
          </div>
        )}
      </Async>
    </div>
  )
}

function ProjectDetail({ id }: ProjectDetailProps) {
  const query = useApi(`/negotiations/projects/${encodeURIComponent(id)}`)
  const [content, setContent] = useState('')
  const [sourceVersionId, setSourceVersionId] = useState('')
  const [location, setLocation] = useState('')
  const [quote, setQuote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<AnyValue>(null)

  const project = query.data?.project
  const latest = project?.versions?.[0]
  const hydratedId = useRef<unknown>(null)
  useEffect(() => {
    if (!latest || hydratedId.current === latest.id) return
    hydratedId.current = latest.id
    setContent(latest.contentText)
    setSourceVersionId(latest.citations?.[0]?.sourceVersionId || '')
    setLocation(latest.citations?.[0]?.location?.paragraph || '')
    setQuote(latest.citations?.[0]?.quote || '')
  }, [latest])

  const saveRevision = async (event: AnyValue) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await apiPost(`/negotiations/projects/${project.id}/versions`, {
        idempotencyKey: crypto.randomUUID(),
        expectedVersion: project.currentVersion,
        contentText: content,
        citations: [
          {
            sourceVersionId,
            location: { paragraph: location },
            quote: quote || null,
          },
        ],
      })
      setMessage({
        tone: 'success',
        text: 'A new immutable draft version was saved.',
      })
      query.retry()
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          (error as AnyValue).code === 'version_conflict'
            ? 'Someone saved a newer version. Reloaded the project so you can review it before trying again.'
            : (error as AnyValue).message,
      })
      if ((error as AnyValue).code === 'version_conflict') query.retry()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="detailPage">
      <BackLink href="/submissions/workspace">My proposals</BackLink>
      <Async query={query}>
        {({ project: item }: AnyValue) => (
          <>
            <PageHeader title={item.title} description={item.purpose}>
              <div className="detailHeaderMeta">
                <StatusChip status={item.lifecycleStatus} />
                <span className="muted">Current version {item.currentVersion}</span>
              </div>
            </PageHeader>
            <div className="notice notice-info">
              {item.isInitiative
                ? 'This is a member initiative with no verified external call.'
                : `Linked to: ${item.call?.title || 'verified call'}.`}{' '}
              It is not an endorsed position and cannot be transmitted from this workspace.
            </div>

            <Section label="Create the next immutable draft">
              <form className="card detailPanel" onSubmit={saveRevision}>
                <label className="field">
                  <span>Draft text</span>
                  <textarea
                    className="input"
                    required
                    rows={14}
                    maxLength={500000}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                </label>
                <div className="formGrid">
                  <label className="field">
                    <span>Immutable source version</span>
                    <input
                      className="input"
                      required
                      value={sourceVersionId}
                      onChange={(event) => setSourceVersionId(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Paragraph or anchor</span>
                    <input
                      className="input"
                      required
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </label>
                  <label className="field fieldSpan">
                    <span>Supporting quote (optional)</span>
                    <textarea
                      className="input"
                      rows={3}
                      maxLength={2000}
                      value={quote}
                      onChange={(event) => setQuote(event.target.value)}
                    />
                  </label>
                </div>
                {message && (
                  <p className={message.tone === 'error' ? 'formError' : 'muted'} role="status">
                    {message.text}
                  </p>
                )}
                <div className="detailActions">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : `Save version ${item.currentVersion + 1}`}
                  </button>
                </div>
              </form>
            </Section>

            <Section label="Version history">
              <div className="stackList">
                {item.versions.map((version: Doc) => (
                  <article className="card detailPanel" key={version.id}>
                    <div className="detailHeaderMeta">
                      <h3>Version {version.version}</h3>
                      <span className="muted">{formatDate(version.createdAt)}</span>
                    </div>
                    <p className="preWrap">{version.contentText}</p>
                    <p className="muted">Snapshot hash: {version.contentHash}</p>
                    {version.citations.map((citation: Doc, index: number) => (
                      <p className="muted" key={`${citation.sourceVersionId}-${index}`}>
                        Evidence: {citation.sourceVersionId}
                        {citation.location?.paragraph ? ` · ${citation.location.paragraph}` : ''}
                        {citation.quote ? ` · “${citation.quote}”` : ''}
                      </p>
                    ))}
                  </article>
                ))}
              </div>
            </Section>

            <Section label="Paragraph amendment proposals">
              {item.amendments.length ? (
                <div className="stackList">
                  {item.amendments.map((amendment: AnyValue) => (
                    <article className="card detailPanel" key={amendment.id}>
                      <div className="detailHeaderMeta">
                        <StatusChip status={amendment.decisionStatus} />
                        <span className="muted">Version {amendment.currentVersion}</span>
                      </div>
                      <h3>{amendment.operation} proposal</h3>
                      <p>{amendment.proposedText || 'Delete the anchored text.'}</p>
                      <p className="muted">{amendment.rationale}</p>
                      <p className="muted">Reconciliation: {amendment.reconciliationStatus}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty icon={History} title="No paragraph amendments in this project" />
              )}
            </Section>
          </>
        )}
      </Async>
    </div>
  )
}

export function SubmissionWorkspace({ slug }: SubmissionWorkspaceProps) {
  return slug ? <ProjectDetail id={slug} /> : <ProjectList />
}
