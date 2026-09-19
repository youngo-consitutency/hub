import { SidePanel } from '../../components/SidePanel.tsx'
import { TbGavel as DecisionIcon } from 'react-icons/tb'
import { Feedback } from './Feedback.tsx'
import { useState, type FormEvent } from 'react'
import {
  BackLink,
  Empty,
  ErrorCard,
  PageHeader,
  Skeletons,
} from '../../components/ui.jsx'
import type { DecisionDetail, DecisionState } from '../../../shared/platform.ts'
import { usePlatform, post, patch, values, formatDate } from './api.ts'
import { Field, Text, Select } from './fields.tsx'

const NEXT: Partial<Record<DecisionState, DecisionState[]>> = {
  draft: ['consultation', 'withdrawn'],
  consultation: ['revision', 'withdrawn'],
  revision: ['decision', 'withdrawn'],
  decision: ['adopted', 'voting', 'withdrawn'],
  voting: ['adopted', 'not_adopted', 'withdrawn'],
}
export function DecisionPage({ slug }: { slug: string }) {
  const [panel, setPanel] = useState<string | null>(null)
  const { data, error, loading, reload } = usePlatform<DecisionDetail>(
    `/decisions/${slug}`,
  )
  const [failure, setFailure] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState('comment')
  function submit(
    action: (input: Record<string, unknown>) => Promise<unknown>,
  ) {
    return async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      setFailure('')
      setMessage('')
      setBusy(true)
      try {
        await action(values(form))
        setPanel(null)
        setMessage('Saved.')
        form.reset()
        reload()
      } catch (error) {
        setFailure(error instanceof Error ? error.message : 'Could not save.')
      } finally {
        setBusy(false)
      }
    }
  }
  const d = data?.decision
  return (
    <div className="platform stack">
      <BackLink href="/council">decisions</BackLink>
      {loading && !data && <Skeletons n={3} />}
      {error && <ErrorCard message={error} onRetry={reload} />}
      <Feedback error={panel ? '' : failure} message={message} />
      {data && d && (
        <>
          <PageHeader
            icon={DecisionIcon}
            title={d.title}
            description={`${d.bodyName} · ${d.process === 'snap' ? 'Snap' : 'Standard'} process · Version ${d.version}`}
          >
            <div className="rowGap">
              <span className="chip chip-neutral">
                {d.stage.replaceAll('_', ' ')}
              </span>
              {d.deadlineAt && (
                <span className="meta">
                  Current period ends {formatDate(d.deadlineAt)}
                </span>
              )}
            </div>
            <p className="meta">{d.policyVersion}</p>
          </PageHeader>
          <section className="card stackSm">
            <h2>Proposal</h2>
            <p className="platformProse">{d.proposal}</p>
            {d.outcome && (
              <>
                <h3>Recorded outcome</h3>
                <p className="platformProse">{d.outcome}</p>
                {d.outcomeEvidence && (
                  <p className="platformProse">
                    <strong>Outcome evidence:</strong> {d.outcomeEvidence}
                  </p>
                )}
                {d.electorateSize !== null && (
                  <p>
                    External vote: {d.votesFor} for, {d.votesAgainst} against,{' '}
                    {d.electorateSize} eligible seats.
                  </p>
                )}
                <a href="/work">Assign follow-up work</a>
              </>
            )}
          </section>
          {['draft', 'revision'].includes(d.stage) &&
            (data.canManage || d.authorId === data.viewerId) && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFailure('')
                    setPanel('revise')
                  }}
                >
                  Revise proposal
                </button>
                {panel === 'revise' && (
                  <SidePanel
                    title="Revise proposal"
                    onClose={() => setPanel(null)}
                  >
                    <Feedback error={failure} message="" />
                    <form
                      className="platformForm"
                      key={d.version}
                      onSubmit={submit((input) =>
                        patch(`/decisions/${d.id}`, { ...d, ...input }),
                      )}
                    >
                      <Field
                        label="Title"
                        name="title"
                        defaultValue={d.title}
                        required
                      />
                      <Text
                        label="Proposal"
                        name="proposal"
                        defaultValue={d.proposal}
                        required
                        maxLength={20000}
                      />
                      <button className="btn btn-primary" disabled={busy}>
                        Save new version
                      </button>
                    </form>
                  </SidePanel>
                )}
              </>
            )}
          <section className="stack">
            <h2>Comments and formal flags</h2>
            {data.contributions.length === 0 && (
              <Empty body="No contributions yet." />
            )}
            {data.contributions.map((c) => (
              <article className="card stackSm" key={c.id}>
                <h3>
                  {c.kind === 'comment' ? 'Comment' : `${c.kind} flag`} ·{' '}
                  {c.authorName}
                </h3>
                <p className="platformProse">{c.text}</p>
                {c.grounds && (
                  <p>
                    <strong>Grounds:</strong> {c.grounds}
                  </p>
                )}
                {c.alternative && (
                  <p>
                    <strong>Alternative:</strong> {c.alternative}
                  </p>
                )}
                {c.resolution ? (
                  <p>
                    <strong>Resolved:</strong> {c.resolution}
                  </p>
                ) : (
                  c.kind !== 'comment' &&
                  c.authorId === data.viewerId &&
                  NEXT[d.stage] && (
                    <form
                      className="platformForm"
                      onSubmit={submit((input) =>
                        post(`/contributions/${c.id}/resolve`, input),
                      )}
                    >
                      <Text
                        label="Why your concern is now resolved or withdrawn"
                        name="resolution"
                        required
                        maxLength={3000}
                      />
                      <button disabled={busy} className="btn">
                        Confirm resolution
                      </button>
                    </form>
                  )
                )}
              </article>
            ))}
          </section>
          {['consultation', 'decision'].includes(d.stage) && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFailure('')
                  setPanel('comment')
                }}
              >
                Add a comment or flag
              </button>
              {panel === 'comment' && (
                <SidePanel
                  title="Add a comment or flag"
                  onClose={() => setPanel(null)}
                >
                  <Feedback error={failure} message="" />
                  <form
                    className="platformForm"
                    onSubmit={submit((input) =>
                      post(`/decisions/${d.id}/contributions`, input),
                    )}
                  >
                    <Select
                      label="Contribution"
                      name="kind"
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="comment">Comment / response</option>
                      <option value="grey">
                        Grey flag: concern or clarification
                      </option>
                      <option value="red">Red flag: formal objection</option>
                    </Select>
                    <Text label="Comment or concern" name="text" required />
                    {kind !== 'comment' && (
                      <Text
                        label="Grounds for your flag"
                        name="grounds"
                        required
                        maxLength={3000}
                      />
                    )}
                    {kind === 'red' && (
                      <Text
                        label="Alternative proposal"
                        name="alternative"
                        required
                      />
                    )}
                    <button disabled={busy} className="btn btn-primary">
                      Submit contribution
                    </button>
                  </form>
                </SidePanel>
              )}
            </>
          )}
          {data.canManage && NEXT[d.stage] && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFailure('')
                  setPanel('transition')
                }}
              >
                Confirm the next process step
              </button>
              {panel === 'transition' && (
                <SidePanel
                  title="Confirm the next process step"
                  onClose={() => setPanel(null)}
                >
                  <Feedback error={failure} message="" />
                  <p className="meta">
                    Review the current proposal, relevant body, flags and policy
                    before confirming. Periods cannot be shortened. Voting
                    outcomes refer to an externally conducted vote and its
                    eligible seats.
                  </p>
                  <form
                    className="platformForm"
                    onSubmit={submit((input) =>
                      post(`/decisions/${d.id}/transition`, {
                        ...input,
                        version: d.version,
                      }),
                    )}
                  >
                    <Select label="Next step" name="stage">
                      {NEXT[d.stage]?.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                    <Text
                      label="Reason / outcome and process checks"
                      name="reason"
                      required
                      maxLength={3000}
                    />
                    <Text
                      label="Outcome evidence / minutes / ballot record (required for an outcome)"
                      name="evidence"
                      maxLength={3000}
                    />
                    <Text
                      label="Reservations considered (required if grey flags remain)"
                      name="reservations"
                      maxLength={3000}
                    />
                    {d.stage === 'voting' && (
                      <>
                        <Select label="Outcome basis" name="outcomeBasis">
                          <option value="process">
                            Recorded process / vote
                          </option>
                          <option value="formal_veto">
                            Formal veto: withdraw the proposal
                          </option>
                        </Select>
                        <Field
                          label="Organisations requesting a veto"
                          name="vetoOrganisations"
                          type="number"
                          defaultValue="0"
                        />
                        <Field
                          label="Of those, Global South organisations"
                          name="vetoGlobalSouth"
                          type="number"
                          defaultValue="0"
                        />
                        <Field
                          label="Working groups / operational teams requesting a veto"
                          name="vetoBodies"
                          type="number"
                          defaultValue="0"
                        />
                        <Field
                          label="Eligible seats in the external vote"
                          name="electorateSize"
                          type="number"
                        />
                        <Field
                          label="Votes for"
                          name="votesFor"
                          type="number"
                        />
                        <Field
                          label="Votes against"
                          name="votesAgainst"
                          type="number"
                        />
                      </>
                    )}
                    <button disabled={busy} className="btn btn-primary">
                      Confirm transition
                    </button>
                  </form>
                </SidePanel>
              )}
            </>
          )}
          <details className="card">
            <summary>Proposal versions ({data.revisions.length})</summary>
            {data.revisions.map((r) => (
              <article key={r.version}>
                <h3>
                  Version {r.version} · {formatDate(r.createdAt)}
                </h3>
                <h4>{r.title}</h4>
                <p className="platformProse">{r.proposal}</p>
              </article>
            ))}
          </details>
          <section className="card stackSm">
            <h2>Process history</h2>
            <ol>
              {data.history.map((h, i) => (
                <li key={i}>
                  <strong>
                    {h.action.replace('decision.', '').replaceAll('_', ' ')}
                  </strong>{' '}
                  · {formatDate(h.createdAt)}
                  <p>{h.reason}</p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  )
}
