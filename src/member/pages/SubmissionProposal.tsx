import type { AnyValue, Doc } from '../lib/types'
import { sourceLocation, useProposalForm } from '../lib/useProposalForm'
import { ProposalFooter } from '../components/ProposalFooter'
import { Async, BackLink, Empty, PageHeader, Section } from '../components/ui'
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

type Form = typeof initialForm

const toBody = (form: Form, idempotencyKey: string) => ({
  idempotencyKey,
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
      location: sourceLocation(form.citationPage, form.citationParagraph),
      quote: form.citationQuote || null,
    },
  ],
})

// keep a source the member already chose
const onTrackLoaded = (form: Form, detail: AnyValue): Form => ({
  ...form,
  sourceVersionId: form.sourceVersionId || detail.documents[0]?.latestVersion.id || '',
})

export function SubmissionProposal() {
  const { tracks, form, set, trackDetail, error, saving, created, submit } = useProposalForm({
    initial: initialForm,
    endpoint: '/negotiations/projects',
    resultKey: 'project',
    toBody,
    onTrackLoaded,
  })

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
            <a className="btn btn-primary btn-sm" href={`/submissions/workspace/${created.id}`}>
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
        {(data: Doc) => (
          <form onSubmit={submit}>
            <Section label="Scope and purpose">
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
                  <span>Verified call (optional)</span>
                  <select
                    className="input"
                    value={form.callId}
                    onChange={set('callId')}
                    disabled={!trackDetail}
                  >
                    <option value="">No call — save as an initiative</option>
                    {(trackDetail?.calls || [])
                      .filter((call: AnyValue) => call.status === 'open')
                      .map((call: AnyValue) => (
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
                  <span>Intended submitting entity (unverified until reviewed)</span>
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
                    {(trackDetail?.documents || []).map((document: AnyValue) => (
                      <option value={document.latestVersion.id} key={document.latestVersion.id}>
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
            <ProposalFooter error={error} saving={saving} label="Save proposal" />
          </form>
        )}
      </Async>
    </div>
  )
}
