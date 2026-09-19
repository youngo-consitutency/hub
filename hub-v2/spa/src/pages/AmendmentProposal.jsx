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
  targetDocumentVersionId: '',
  page: '',
  paragraph: '',
  anchorQuote: '',
  operation: 'replace',
  originalText: '',
  proposedText: '',
  rationale: '',
  citationQuote: '',
}

export function AmendmentProposal() {
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
        setForm((current) => ({
          ...current,
          targetDocumentVersionId: detail.documents[0]?.latestVersion.id || '',
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
      const result = await apiPost('/negotiations/amendments', {
        idempotencyKey: idempotency,
        targetType: 'official_document',
        targetDocumentVersionId: form.targetDocumentVersionId,
        stableAnchor: {
          ...(form.page ? { page: form.page } : {}),
          ...(form.paragraph ? { paragraph: form.paragraph } : {}),
          quote: form.anchorQuote,
        },
        operation: form.operation,
        originalText: form.originalText,
        proposedText: form.operation === 'delete' ? null : form.proposedText,
        rationale: form.rationale,
        citations: [
          {
            sourceVersionId: form.targetDocumentVersionId,
            location: {
              ...(form.page ? { page: form.page } : {}),
              ...(form.paragraph ? { paragraph: form.paragraph } : {}),
            },
            quote: form.citationQuote || form.anchorQuote,
          },
        ],
      })
      setCreated(result.amendment)
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
          title="Text proposal saved"
          body="The proposal is anchored to the selected source version. It does not change the official document or establish a constituency position."
        />
      </div>
    )

  return (
    <div className="detailPage">
      <BackLink href="/submissions">Submissions</BackLink>
      <PageHeader
        title="Propose a text change"
        description="Anchor an insert, replacement or deletion to one exact source version. Competing alternatives remain separate proposals."
      />
      <Async query={tracks}>
        {(data) => (
          <form onSubmit={submit}>
            <Section label="Exact target">
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
                  <span>Immutable document version</span>
                  <select
                    className="input"
                    required
                    disabled={!trackDetail}
                    value={form.targetDocumentVersionId}
                    onChange={set('targetDocumentVersionId')}
                  >
                    <option value="">Select a source version</option>
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
                    required
                    value={form.page}
                    onChange={set('page')}
                  />
                </label>
                <label className="field">
                  <span>Paragraph or anchor label</span>
                  <input
                    className="input"
                    required
                    value={form.paragraph}
                    onChange={set('paragraph')}
                  />
                </label>
                <label className="field fieldSpan">
                  <span>Exact anchor quote</span>
                  <textarea
                    className="input"
                    required
                    rows={3}
                    value={form.anchorQuote}
                    onChange={set('anchorQuote')}
                  />
                </label>
              </div>
            </Section>

            <Section label="Proposed operation">
              <div className="card detailPanel formGrid">
                <label className="field">
                  <span>Operation</span>
                  <select
                    className="input"
                    value={form.operation}
                    onChange={set('operation')}
                  >
                    <option value="insert">Insert</option>
                    <option value="replace">Replace</option>
                    <option value="delete">Delete</option>
                  </select>
                </label>
                <div />
                <label className="field fieldSpan">
                  <span>Original wording</span>
                  <textarea
                    className="input"
                    required
                    rows={5}
                    value={form.originalText}
                    onChange={set('originalText')}
                  />
                </label>
                {form.operation !== 'delete' && (
                  <label className="field fieldSpan">
                    <span>Proposed wording</span>
                    <textarea
                      className="input"
                      required
                      rows={5}
                      value={form.proposedText}
                      onChange={set('proposedText')}
                    />
                  </label>
                )}
                <label className="field fieldSpan">
                  <span>Rationale</span>
                  <textarea
                    className="input"
                    required
                    rows={4}
                    value={form.rationale}
                    onChange={set('rationale')}
                  />
                </label>
                <label className="field fieldSpan">
                  <span>Supporting source quote</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={form.citationQuote}
                    onChange={set('citationQuote')}
                  />
                </label>
              </div>
            </Section>
            <p className="meta">
              This is a member proposal. It never modifies the cited official
              source and does not represent YOUNGO endorsement.
            </p>
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
                {saving ? 'Saving…' : 'Save text proposal'}
              </button>
            </div>
          </form>
        )}
      </Async>
    </div>
  )
}
