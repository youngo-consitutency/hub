import type { AnyValue, Doc } from '../lib/types'
import { sourceLocation, useProposalForm } from '../lib/useProposalForm'
import { ProposalFooter } from '../components/ProposalFooter'
import { Async, BackLink, Empty, PageHeader, Section } from '../components/ui'
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

type Form = typeof initialForm

const toBody = (form: Form, idempotencyKey: string) => {
  const location = sourceLocation(form.page, form.paragraph)
  return {
    idempotencyKey,
    targetType: 'official_document',
    targetDocumentVersionId: form.targetDocumentVersionId,
    stableAnchor: { ...location, quote: form.anchorQuote },
    operation: form.operation,
    originalText: form.originalText,
    proposedText: form.operation === 'delete' ? null : form.proposedText,
    rationale: form.rationale,
    citations: [
      {
        sourceVersionId: form.targetDocumentVersionId,
        location,
        quote: form.citationQuote || form.anchorQuote,
      },
    ],
  }
}

// a new track always resets the target to its latest document version
const onTrackLoaded = (form: Form, detail: AnyValue): Form => ({
  ...form,
  targetDocumentVersionId: detail.documents[0]?.latestVersion.id || '',
})

export function AmendmentProposal() {
  const { tracks, form, set, trackDetail, error, saving, created, submit } = useProposalForm({
    initial: initialForm,
    endpoint: '/negotiations/amendments',
    resultKey: 'amendment',
    toBody,
    onTrackLoaded,
  })

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
        {(data: Doc) => (
          <form onSubmit={submit}>
            <Section label="Exact target">
              <div className="card detailPanel formGrid">
                <label className="field">
                  <span>Negotiation track</span>
                  <select className="input" required value={form.trackId} onChange={set('trackId')}>
                    <option value="">Select a track</option>
                    {data.items.map((track: AnyValue) => (
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
                    {(trackDetail?.documents || []).map((document: AnyValue) => (
                      <option value={document.latestVersion.id} key={document.latestVersion.id}>
                        {document.title} · {document.latestVersion.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Page</span>
                  <input className="input" required value={form.page} onChange={set('page')} />
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
                  <select className="input" value={form.operation} onChange={set('operation')}>
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
              This is a member proposal. It never modifies the cited official source and does not
              represent YOUNGO endorsement.
            </p>
            <ProposalFooter error={error} saving={saving} label="Save text proposal" />
          </form>
        )}
      </Async>
    </div>
  )
}
