import { SidePanel } from '../components/SidePanel.tsx'
import { TbFileText as StatementIcon } from 'react-icons/tb'
import { useState } from 'react'
import { apiPatch, apiPost, useApi } from '../lib/api.js'
import {
  A,
  Async,
  Button,
  Empty,
  ErrorCard,
  PageHeader,
  Section,
  StatusChip,
} from '../components/ui.jsx'
import { SearchableSelect } from '../components/FormControls.jsx'
import {
  TbTools as PenTool,
  TbInbox as Inbox,
  TbStack3 as Layers3,
  TbMessages as MessagesSquare,
  TbCircleCheck as CheckCircle2,
  TbArrowRight as ArrowRight,
  TbUpload as Upload,
  TbSparkles as Sparkles,
} from 'react-icons/tb'
import { DestinationIcon } from '../components/DestinationLink.jsx'

const NEXT = {
  submitted: ['triaged', 'rejected'],
  triaged: ['drafting', 'rejected'],
  drafting: ['needs_review'],
  needs_review: ['drafting', 'approved', 'rejected'],
  approved: ['published', 'drafting'],
  rejected: ['triaged'],
  published: [],
}

function CountList({ title, items }) {
  if (!items?.length) return null
  return (
    <div className="gysCountBlock">
      <strong>{title}</strong>
      <ul>
        {items.slice(0, 8).map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <span className="mono">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GysPolicyTeam() {
  const [panel, setPanel] = useState(null)
  const query = useApi('/member/team/gys/overview')
  const [draft, setDraft] = useState({ title: '', body: '', theme: '' })
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [importMessage, setImportMessage] = useState(null)

  const create = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      setActionError(null)
      await apiPost('/member/team/gys/contributions', draft)
      setDraft({ title: '', body: '', theme: '' })
      setPanel(null)
      query.retry()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const move = async (id, status) => {
    setBusy(true)
    try {
      setActionError(null)
      await apiPatch(`/member/team/gys/contributions/${id}`, { status })
      query.retry()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const promoteBullet = async (bullet) => {
    setBusy(true)
    try {
      setActionError(null)
      await apiPost('/member/team/gys/contributions', {
        title: bullet.theme ? `${bullet.theme} — synthesis demand` : 'Synthesis demand',
        theme: bullet.theme || '',
        body: `${bullet.text}\n\nCited inputs: ${bullet.citations.map((c) => c.title).join('; ')}`,
      })
      query.retry()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const runPreview = async () => {
    setBusy(true)
    setImportMessage(null)
    try {
      setActionError(null)
      const result = await apiPost('/member/team/gys/inputs/preview', {
        csvText,
      })
      setPreview(result)
    } catch (error) {
      setPreview(null)
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const runImport = async () => {
    setBusy(true)
    setImportMessage(null)
    try {
      setActionError(null)
      const result = await apiPost('/member/team/gys/inputs/import', {
        csvText,
        columnMap: preview?.columnMap,
      })
      setImportMessage(
        `Imported ${result.imported}, skipped ${result.skipped}${
          result.errors?.length ? `, ${result.errors.length} row errors` : ''
        }.`,
      )
      setCsvText('')
      setPreview(null)
      query.retry()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={StatementIcon}
        title="Global Youth Statement"
        action={
          query.data && (
            <div className="rowGap">
              <Button
                onClick={() => {
                  setActionError(null)
                  setPanel('contribution')
                }}
              >
                <PenTool size={17} aria-hidden />
                Add contribution
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setActionError(null)
                  setPanel('import')
                }}
              >
                <Upload size={17} aria-hidden />
                Import responses
              </Button>
            </div>
          )
        }
        description="Turn youth inputs into a reviewed statement with a visible handover."
      />
      <Async query={query} skeletons={5}>
        {(data) => (
          <>
            <div className="cycleBanner card">
              <div>
                <span className="taskState taskState-review">Active cycle</span>
                <h2 style={{ marginTop: 8 }}>{data.current?.title || 'Global Youth Statement'}</h2>
                <p className="meta" style={{ marginTop: 4 }}>
                  {data.current?.tagline || data.current?.status}
                </p>
              </div>
              <div className="rowGap">
                {data.formUrl && (
                  <a
                    href={data.formUrl}
                    className="btn btn-secondary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <DestinationIcon url={data.formUrl} size={17} />
                    Official inputs form
                  </a>
                )}
                <A href="/gys" className="btn btn-secondary">
                  View public statement <ArrowRight size={16} aria-hidden />
                </A>
              </div>
            </div>
            <div className="metricGrid">
              <div className="metricCard">
                <Inbox size={18} aria-hidden />
                <strong>{data.contributions?.length || 0}</strong>
                <span>tracked contributions</span>
              </div>
              <div className="metricCard">
                <MessagesSquare size={18} aria-hidden />
                <strong>{data.decisions.length}</strong>
                <span>active consultations</span>
              </div>
              <div className="metricCard">
                <Layers3 size={18} aria-hidden />
                <strong>{data.process.length}</strong>
                <span>production stages</span>
              </div>
            </div>

            {panel === 'import' && (
              <SidePanel title="Import Google Form responses" onClose={() => setPanel(null)}>
                {actionError && <ErrorCard message={actionError} />}
                {importMessage && <p className="meta">{importMessage}</p>}
                <div className="stack">
                  <p className="meta">
                    Export responses from the official GYS 2026 form as CSV, paste them below,
                    preview the column mapping, then import into the contribution queue.
                  </p>
                  <label className="field">
                    CSV export
                    <textarea
                      className="input textarea"
                      rows="6"
                      value={csvText}
                      onChange={(event) => {
                        setCsvText(event.target.value)
                        setPreview(null)
                      }}
                      placeholder="Timestamp,Email Address,Country,Theme,Policy recommendation…"
                    />
                  </label>
                  <div className="rowGap">
                    <Button
                      sm
                      variant="secondary"
                      disabled={busy || !csvText.trim()}
                      onClick={runPreview}
                    >
                      <Upload size={16} aria-hidden />
                      Preview mapping
                    </Button>
                    <Button
                      sm
                      variant="primary"
                      disabled={busy || !preview?.rowCount}
                      onClick={runImport}
                    >
                      Import {preview?.rowCount || 0} rows
                    </Button>
                  </div>
                  {preview && (
                    <div className="gysImportPreview">
                      <p className="meta">
                        Detected {preview.rowCount} rows. Body column:{' '}
                        <strong>{preview.columnMap?.body || '—'}</strong>
                      </p>
                      <div className="stackSm">
                        {preview.preview.map((row) => (
                          <div key={row.externalId} className="card cardTight">
                            <strong>{row.title}</strong>
                            <p className="meta">
                              {[row.theme, row.country, row.submitterType]
                                .filter(Boolean)
                                .join(' · ') || 'No metadata'}
                            </p>
                            <p className="meta">{row.bodyPreview}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </SidePanel>
            )}

            <Section label="Intelligent synthesis">
              {!data.synthesis ? (
                <Empty icon={Sparkles} title="No synthesis yet" />
              ) : (
                <div className="card cardTight stackSm gysSynthesisPanel">
                  <div className="rowGap">
                    <Sparkles size={18} color="var(--accent)" aria-hidden />
                    <strong>{data.synthesis.answer}</strong>
                  </div>
                  <div className="gysCountGrid">
                    <CountList title="By theme" items={data.synthesis.counts?.byTheme} />
                    <CountList title="By region" items={data.synthesis.counts?.byRegion} />
                    <CountList title="By country" items={data.synthesis.counts?.byCountry} />
                    <CountList
                      title="By submitter type"
                      items={data.synthesis.counts?.bySubmitterType}
                    />
                  </div>
                  {data.synthesis.bullets?.length > 0 && (
                    <ul className="gysSynthesisBullets">
                      {data.synthesis.bullets.map((bullet, index) => (
                        <li key={`${bullet.citations[0]?.contributionId}-${index}`}>
                          <div>
                            <p>{bullet.text}</p>
                            <p className="meta">
                              Cited: {bullet.citations.map((c) => c.title).join(', ')}
                            </p>
                          </div>
                          <Button
                            sm
                            variant="secondary"
                            disabled={busy}
                            onClick={() => promoteBullet(bullet)}
                          >
                            Track demand
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="meta intelligenceCaveat">{data.synthesis.caveat}</p>
                </div>
              )}
            </Section>

            <Section label="Production cycle">
              <ol className="workflowSteps">
                {data.process.map((step, index) => (
                  <li key={step.step} className={index === 0 ? 'active' : ''}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.step}</strong>
                      <p className="meta">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
            <Section label="Contribution workflow">
              {actionError && !panel && <ErrorCard message={actionError} />}
              {panel === 'contribution' && (
                <SidePanel title="Add contribution" onClose={() => setPanel(null)}>
                  {actionError && <ErrorCard message={actionError} />}
                  <form className="stack" onSubmit={create}>
                    <div className="formGrid">
                      <label className="field">
                        Title
                        <input
                          className="input"
                          required
                          value={draft.title}
                          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        Theme
                        <input
                          className="input"
                          value={draft.theme}
                          onChange={(event) => setDraft({ ...draft, theme: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="field">
                      Contribution
                      <textarea
                        className="input textarea"
                        required
                        rows="3"
                        value={draft.body}
                        onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                      />
                    </label>
                    <div>
                      <Button type="submit" sm variant="primary" disabled={busy}>
                        Add contribution
                      </Button>
                    </div>
                  </form>
                </SidePanel>
              )}
              {!data.contributions?.length ? (
                <Empty icon={PenTool} title="No tracked contributions yet" />
              ) : (
                <div className="stackSm" style={{ marginTop: 12 }}>
                  {data.contributions.map((item) => (
                    <div key={item.id} className="card cardTight queueRow">
                      <div>
                        <strong>{item.title}</strong>
                        <p className="meta">
                          {[item.theme || 'No theme', item.source, item.country]
                            .filter(Boolean)
                            .join(' · ')}{' '}
                          · version {item.version}
                        </p>
                      </div>
                      <div className="rowGap">
                        <StatusChip status={item.status} />
                        <SearchableSelect
                          label={`Change status for ${item.title}`}
                          hideLabel
                          className="queueSelect"
                          disabled={busy || !NEXT[item.status]?.length}
                          value={item.status}
                          onChange={(status) => move(item.id, status)}
                          options={[
                            {
                              value: item.status,
                              label: item.status.replaceAll('_', ' '),
                            },
                            ...(NEXT[item.status] || []).map((status) => ({
                              value: status,
                              label: status.replaceAll('_', ' '),
                            })),
                          ]}
                          searchPlaceholder="Search statuses…"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <Section label="Open public inputs">
              {!data.submissions.length ? (
                <Empty icon={PenTool} title="No open inputs" />
              ) : (
                <div className="stackSm">
                  {data.submissions.map((item) => (
                    <A
                      key={item.slug}
                      href={`/submissions/${item.slug}`}
                      className="card cardTight queueRow"
                    >
                      <div>
                        <strong>{item.title}</strong>
                        <p className="meta">{item.wg?.name || 'Cross-constituency input'}</p>
                      </div>
                      <StatusChip status={item.status} />
                    </A>
                  ))}
                </div>
              )}
            </Section>
            <Section label="Handover readiness">
              <div className="card cardTight rowGap">
                <CheckCircle2 size={20} color="var(--accent)" aria-hidden />
                <div>
                  <strong>Authorship and review are traceable</strong>
                  <p className="meta">
                    Each contribution records author, reviewer, version, status changes, and
                    approval decisions. Imported form rows keep source metadata for the policy team
                    only.
                  </p>
                </div>
              </div>
            </Section>
          </>
        )}
      </Async>
    </div>
  )
}
