import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  Empty,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { TbCircleCheck as CheckCircle } from 'react-icons/tb'

const initialForm = {
  trackId: '',
  callId: '',
  title: '',
  purpose: '',
  workingGroupSlug: '',
  intendedSubmittingEntity: '',
  externalDraftUrl: '',
  contentText: '',
  sourceVersionId: '',
  citationPage: '',
  citationParagraph: '',
  citationQuote: '',
}

export function SubmissionProposal() {
  const tracks = useApi('/negotiations')
  const [form, setForm] = useState(initialForm)
  const [trackDetail, setTrackDetail] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)
  const [idempotency] = useState(() => crypto.randomUUID())

  const selectedTrack = useMemo(
    () => tracks.data?.items.find((track) => track.id === form.trackId),
    [tracks.data, form.trackId],
  )

  useEffect(() => {
    let active = true
    setTrackDetail(null)
    if (!selectedTrack) return undefined
    apiGet(`/negotiations/${selectedTrack.slug}`)
      .then((detail) => {
        if (!active) return
        setTrackDetail(detail)
        const firstDocument = detail.documents[0]
        setForm((current) => ({
          ...current,
          sourceVersionId:
            current.sourceVersionId || firstDocument?.latestVersion.id || '',
        }))
      })
      .catch((requestError) => active && setError(requestError.message))
    return () => {
      active = false
    }
  }, [selectedTrack])

  const set = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await apiPost('/negotiations/projects', {
        idempotencyKey: idempotency,
        trackId: form.trackId,
        callId: form.callId || null,
        title: form.title,
        purpose: form.purpose,
        workingGroupSlug: form.workingGroupSlug || null,
        intendedSubmittingEntity: form.intendedSubmittingEntity || null,
        externalDraftUrl: form.externalDraftUrl || null,
        contentText: form.contentText,
        citations: [
          {
            sourceVersionId: form.sourceVersionId,
            location: {
              ...(form.citationPage ? { page: form.citationPage } : {}),
              ...(form.citationParagraph
                ? { paragraph: form.citationParagraph }
                : {}),
            },
            quote: form.citationQuote || null,
          },
        ],
      })
      setCreated(result.project)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  if (created)
    return (
      <div className="detailPage">
        <BackLink href="/submissions">Submissions</BackLink>
        <Empty
          icon={CheckCircle}
          title="Proposal saved for triage"
          body={
            created.is_initiative
              ? 'This is labelled as an initiative because no verified external call was selected. It is not endorsed or ready for transmission.'
              : 'The first immutable draft is saved. This does not represent constituency endorsement or external transmission.'
          }
          cta={
            <a
              className="btn btn-primary btn-sm"
              href={`/submissions/workspace/${created.id}`}
            >
              Open private proposal
            </a>
          }
        />
      </div>
    )

  return (
    <div className="detailPage">
      <BackLink href="/submissions">Submissions</BackLink>
      <PageHeader
        title="Propose a submission"
        description="Create an internal member proposal with an immutable first draft and source evidence. Saving does not claim YOUNGO endorsement or an external submission route."
      />
      <Async query={tracks}>
        {(data) => (
          <form onSubmit={submit}>
            <Section label="Scope and purpose">
              <div className="card detailPanel formGrid">
                <label className="field">
                  <span>Negotiation track</span>
                  <select
                    className="input"
                    required
                    value={form.trackId}
                    onChange={set('trackId')}
                  >
                    <option value="">Select a track</option>
                    {data.items.map((track) => (
                      <option value={track.id} key={track.id}>
                        {track.topic}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Verified call (optional)</span>
                  <select
                    className="input"
                    value={form.callId}
                    onChange={set('callId')}
                    disabled={!trackDetail}
                  >
                    <option value="">No call — save as an initiative</option>
                    {(trackDetail?.calls || [])
                      .filter((call) => call.status === 'open')
                      .map((call) => (
                        <option value={call.id} key={call.id}>
                          {call.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span>Proposal title</span>
                  <input
                    className="input"
                    required
                    maxLength={180}
                    value={form.title}
                    onChange={set('title')}
                  />
                </label>
                <label className="field">
                  <span>Working group slug (optional)</span>
                  <input
                    className="input"
                    maxLength={120}
                    value={form.workingGroupSlug}
                    onChange={set('workingGroupSlug')}
                  />
                </label>
                <label className="field fieldSpan">
                  <span>Purpose</span>
                  <textarea
                    className="input"
                    required
                    rows={4}
                    maxLength={4000}
                    value={form.purpose}
                    onChange={set('purpose')}
                  />
                </label>
                <label className="field">
                  <span>
                    Intended submitting entity (unverified until reviewed)
                  </span>
                  <input
                    className="input"
                    maxLength={240}
                    value={form.intendedSubmittingEntity}
                    onChange={set('intendedSubmittingEntity')}
                  />
                </label>
                <label className="field">
                  <span>External drafting document (optional)</span>
                  <input
                    className="input"
                    type="url"
                    value={form.externalDraftUrl}
                    onChange={set('externalDraftUrl')}
                  />
                </label>
              </div>
            </Section>

            <Section label="Immutable first draft">
              <div className="card detailPanel">
                <label className="field">
                  <span>Draft snapshot</span>
                  <textarea
                    className="input"
                    required
                    rows={12}
                    maxLength={500000}
                    value={form.contentText}
                    onChange={set('contentText')}
                  />
                </label>
              </div>
            </Section>

            <Section label="Supporting evidence">
              <div className="card detailPanel formGrid">
                <label className="field fieldSpan">
                  <span>Immutable source version</span>
                  <select
                    className="input"
                    required
                    value={form.sourceVersionId}
                    onChange={set('sourceVersionId')}
                    disabled={!trackDetail}
                  >
                    <option value="">Select evidence</option>
                    {(trackDetail?.documents || []).map((document) => (
                      <option
                        value={document.latestVersion.id}
                        key={document.latestVersion.id}
                      >
                        {document.title} · {document.latestVersion.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Page</span>
                  <input
                    className="input"
                    value={form.citationPage}
                    onChange={set('citationPage')}
                  />
                </label>
                <label className="field">
                  <span>Paragraph or anchor</span>
                  <input
                    className="input"
                    value={form.citationParagraph}
                    onChange={set('citationParagraph')}
                  />
                </label>
                <label className="field fieldSpan">
                  <span>Supporting quote (optional)</span>
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={2000}
                    value={form.citationQuote}
                    onChange={set('citationQuote')}
                  />
                </label>
              </div>
            </Section>
            {error && (
              <p className="formError" role="alert">
                {error}
              </p>
            )}
            <div className="detailActions detailPageActions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save proposal'}
              </button>
            </div>
          </form>
        )}
      </Async>
    </div>
  )
}
