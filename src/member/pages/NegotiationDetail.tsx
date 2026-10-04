interface NegotiationDetailProps {
  slug?: string
}

import type { AnyValue, Doc } from '../lib/types'
import { useState } from 'react'
import { useAccount } from '../lib/accountContext'
import { apiDelete, apiPut, useApi } from '../lib/api'
import { Async, BackLink, PageHeader, Section } from '../components/ui'
import { TbBell as Bell, TbExternalLink as ExternalLink } from 'react-icons/tb'

function deadlineText(deadline: AnyValue) {
  if (!deadline?.date) return 'Deadline not specified'
  const date = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${deadline.date}T00:00:00Z`))
  if (deadline.precision !== 'time') return `${date} · closing time not specified`
  return `${date}, ${deadline.time} ${deadline.timezone}`
}

export function NegotiationDetail({ slug }: NegotiationDetailProps) {
  const query = useApi(`/negotiations/${slug}`)
  const { account } = useAccount()
  const [following, setFollowing] = useState(false)
  const [followError, setFollowError] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleFollow = async () => {
    setSaving(true)
    setFollowError('')
    try {
      if (following) await apiDelete(`/negotiations/${slug}/follow`)
      else
        await apiPut(`/negotiations/${slug}/follow`, {
          deadlineAlerts: true,
          substantiveChangeAlerts: true,
          digestFrequency: 'weekly',
        })
      setFollowing((value) => !value)
    } catch (error) {
      setFollowError((error as AnyValue).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="detailPage">
      <BackLink href="/negotiations">Negotiations</BackLink>
      <Async query={query}>
        {(track: AnyValue) => (
          <>
            <PageHeader title={track.topic} description={track.summary}>
              {account?.isVerified && (
                <button
                  className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`}
                  type="button"
                  disabled={saving}
                  aria-pressed={following}
                  onClick={toggleFollow}
                >
                  <Bell size={18} aria-hidden />
                  {saving ? 'Saving…' : following ? 'Following' : 'Follow track'}
                </button>
              )}
            </PageHeader>
            {followError && (
              <p className="formError" role="alert">
                {followError}
              </p>
            )}

            <Section label="Agenda lineage">
              <div className="cardGrid">
                {track.agendaItems.map((item: Doc) => (
                  <article className="card" key={item.id}>
                    <div className="cardBody">
                      <div className="eyebrow">
                        {item.body} · {item.session}
                      </div>
                      <h3>
                        Item {item.item}
                        {item.subItem ? `.${item.subItem}` : ''}
                      </h3>
                      <p>{item.title}</p>
                      {item.lineageFrom?.length > 0 && (
                        <p className="meta">
                          Continues an earlier agenda item; the earlier record remains preserved.
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </Section>

            <Section label="Calls for input">
              {track.calls.length ? (
                <div className="cardGrid">
                  {track.calls.map((call: AnyValue) => (
                    <article className="card" key={call.id}>
                      <div className="cardBody">
                        <div className="eyebrow">{call.status}</div>
                        <h3>{call.title}</h3>
                        <p>{call.eligibility}</p>
                        <p className="meta">{deadlineText(call.externalDeadline)}</p>
                        {!call.submittingChannel && (
                          <p className="meta">No verified submitting channel recorded.</p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="meta">No published contribution call is linked to this track.</p>
              )}
            </Section>

            <Section label="Documents and source health">
              <div className="cardGrid">
                {track.documents.map((document: AnyValue) => {
                  const uncertain = Number(document.latestVersion.extraction.confidence) < 0.9
                  return (
                    <article className="card" key={document.id}>
                      <div className="cardBody">
                        <div className="eyebrow">
                          {document.documentStatus} · {document.latestVersion.language}
                        </div>
                        <h3>{document.title}</h3>
                        <p className="meta">
                          {document.versionCount} immutable{' '}
                          {document.versionCount === 1 ? 'version' : 'versions'} · retrieved{' '}
                          {new Date(document.latestVersion.retrievedAt).toLocaleString()}
                        </p>
                        {document.health.coverageState !== 'current' && (
                          <p className="formError" role="status">
                            Coverage {document.health.coverageState}. Last successful check:{' '}
                            {document.health.lastSuccessfulCheckAt
                              ? new Date(document.health.lastSuccessfulCheckAt).toLocaleString()
                              : 'none recorded'}
                            .
                          </p>
                        )}
                        {uncertain && (
                          <p className="meta">
                            Extraction is uncertain (
                            {Math.round(document.latestVersion.extraction.confidence * 100)}%
                            confidence). Verify against the original.
                          </p>
                        )}
                        <a
                          className="btn btn-secondary btn-sm"
                          href={document.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={17} aria-hidden />
                          Original evidence
                        </a>
                        <a
                          className="btn btn-ghost btn-sm"
                          href={`/api/negotiations/documents/${document.id}/versions/${document.latestVersion.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Version metadata
                        </a>
                      </div>
                    </article>
                  )
                })}
              </div>
            </Section>
          </>
        )}
      </Async>
    </div>
  )
}
