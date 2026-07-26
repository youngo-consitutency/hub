import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import {
  A,
  Button,
  Empty,
  ErrorCard,
  PageHeader,
  Section,
  Skeletons,
} from '../components/ui.jsx'
import { SearchableSelect } from '../components/FormControls.jsx'
import { BadgeCheck, Plus, Sparkles } from 'lucide-react'

const EMPTY_FORM = {
  orgAccountId: '',
  reasonCode: 'unfccc_submission',
  points: '',
  title: '',
  note: '',
  requestId: '',
}

export function StaffPoints() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('idle')
  const [busyId, setBusyId] = useState(null)
  const [flash, setFlash] = useState(null)

  const load = () => {
    setError(null)
    apiGet('/member/staff/points')
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  const reasonMeta = useMemo(() => {
    if (!data?.reasons) return null
    return data.reasons.find((r) => r.code === form.reasonCode) || null
  }, [data, form.reasonCode])

  useEffect(() => {
    if (!reasonMeta || form.points !== '') return
    if (reasonMeta.defaultPoints) {
      setForm((f) => ({ ...f, points: String(reasonMeta.defaultPoints) }))
    }
  }, [reasonMeta?.code])

  const award = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setFlash(null)
    setError(null)
    try {
      const result = await apiPost('/member/staff/points/award', {
        orgAccountId: form.orgAccountId,
        reasonCode: form.reasonCode,
        points: form.points === '' ? undefined : Number(form.points),
        title: form.title,
        note: form.note || null,
        requestId: form.requestId || undefined,
        relatedType: form.requestId ? 'ngo_request' : undefined,
        relatedId: form.requestId || undefined,
      })
      setFlash(
        `Awarded ${result.entry.points} pts · new balance ${result.balance}` +
          (result.recognition.current
            ? ` · ${result.recognition.current.label}`
            : ''),
      )
      setForm((f) => ({
        ...EMPTY_FORM,
        orgAccountId: f.orgAccountId,
        reasonCode: f.reasonCode,
      }))
      load()
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  const awardSuggestion = async (s) => {
    setBusyId(s.requestId)
    setFlash(null)
    setError(null)
    try {
      const result = await apiPost('/member/staff/points/award-suggestion', {
        requestId: s.requestId,
        orgAccountId: s.orgAccountId,
        kind: s.kind,
        reasonCode: s.suggestedReasonCode,
        points: s.suggestedPoints,
        title: s.title,
      })
      setFlash(
        `Awarded ${result.entry.points} pts to ${s.orgName} · balance ${result.balance}`,
      )
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const prefillFromSuggestion = (s) => {
    setForm({
      orgAccountId: s.orgAccountId,
      reasonCode: s.suggestedReasonCode,
      points: String(s.suggestedPoints),
      title: s.title,
      note: `From completed request ${s.requestId}`,
      requestId: s.requestId,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (error && !data) return <ErrorCard message={error} onRetry={load} />
  if (!data) return <Skeletons n={4} />

  return (
    <div>
      <PageHeader
        eyebrow="Staff · recognition"
        title="NGO contribution points"
        description="Award points when an NGO supports pool badges, contributes to UNFCCC submissions, or helps other constituency work. Staff verify every award."
      />

      {flash && (
        <div
          className="card cardTight"
          style={{ marginTop: 12, borderColor: 'var(--accent)' }}
        >
          <p
            className="meta"
            style={{ color: 'var(--accent)', fontWeight: 500 }}
          >
            {flash}
          </p>
        </div>
      )}
      {error && <ErrorCard message={error} onRetry={load} />}

      <p className="metaMuted" style={{ marginBottom: 12 }}>
        Public board:{' '}
        <A href="/recognition" className="inlineLink">
          /recognition
        </A>
      </p>

      <Section
        label={`Suggested awards (${data.suggestions?.length || 0})`}
        action={
          data.suggestions?.length ? (
            <span className="metaMuted">From completed NGO requests</span>
          ) : null
        }
      >
        {!data.suggestions?.length ? (
          <Empty
            icon={Sparkles}
            title="No pending suggestions"
            body="When an NGO marks a badge or UNFCCC request as done, it appears here for one-click award."
          />
        ) : (
          <div className="stackSm">
            {data.suggestions.map((s) => (
              <div key={s.requestId} className="card cardTight">
                <div
                  className="rowBetween"
                  style={{ gap: 12, flexWrap: 'wrap' }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{s.orgName || 'Organisation'}</strong>
                    <p className="meta" style={{ marginTop: 4 }}>
                      {s.title}
                    </p>
                    <p className="metaMuted">
                      {s.suggestedReasonLabel} · default {s.suggestedPoints} pts
                      {s.createdAt
                        ? ` · done ${new Date(s.createdAt).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  <div className="rowGap" style={{ flexWrap: 'wrap' }}>
                    <Button
                      sm
                      variant="ghost"
                      onClick={() => prefillFromSuggestion(s)}
                    >
                      Edit
                    </Button>
                    <Button
                      sm
                      variant="primary"
                      disabled={busyId === s.requestId}
                      onClick={() => awardSuggestion(s)}
                    >
                      {busyId === s.requestId
                        ? 'Awarding…'
                        : `Award +${s.suggestedPoints}`}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label="Award points">
        <form className="card stack" onSubmit={award}>
          {form.requestId && (
            <p className="meta" style={{ color: 'var(--accent)' }}>
              Linked to request{' '}
              <code className="mono">{form.requestId.slice(0, 8)}…</code>
            </p>
          )}
          <SearchableSelect
            label="Organisation *"
            options={(data.orgs || []).map((org) => ({
              value: org.orgAccountId,
              label: `${org.name || 'Organisation'} · ${org.balance} pts`,
            }))}
            value={form.orgAccountId}
            onChange={(orgAccountId) =>
              setForm((current) => ({ ...current, orgAccountId }))
            }
            placeholder="Select NGO…"
            searchPlaceholder="Search organisations…"
          />
          <SearchableSelect
            label="Contribution type *"
            options={(data.reasons || []).map((reason) => ({
              value: reason.code,
              label:
                reason.label +
                (reason.defaultPoints
                  ? ` (default ${reason.defaultPoints})`
                  : ''),
            }))}
            value={form.reasonCode}
            onChange={(reasonCode) =>
              setForm((current) => ({
                ...current,
                reasonCode,
                points: '',
              }))
            }
            searchPlaceholder="Search contribution types…"
          >
            {reasonMeta && (
              <p className="metaMuted" style={{ marginTop: 4 }}>
                {reasonMeta.description}
              </p>
            )}
          </SearchableSelect>
          <div className="formRow">
            <label className="field">
              <span>Points *</span>
              <input
                className="input"
                type="number"
                required
                value={form.points}
                onChange={(e) =>
                  setForm((f) => ({ ...f, points: e.target.value }))
                }
                placeholder={
                  reasonMeta?.defaultPoints
                    ? String(reasonMeta.defaultPoints)
                    : '10'
                }
              />
            </label>
            <label className="field">
              <span>Title *</span>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="e.g. Supported GGA indicators youth submission"
              />
            </label>
          </div>
          <label className="field">
            <span>Internal note</span>
            <textarea
              className="input textarea"
              rows={2}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Optional context for audit trail"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={status === 'submitting'}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            {status === 'submitting' ? 'Saving…' : 'Award points'}
          </Button>
        </form>
      </Section>

      <Section label="Organisation balances">
        {!data.orgs?.length ? (
          <Empty
            title="No organisations yet"
            body="Register an NGO account first."
          />
        ) : (
          <div className="stackSm">
            {data.orgs.map((o) => (
              <div key={o.orgAccountId} className="card cardTight rowBetween">
                <div>
                  <strong>{o.name || 'Organisation'}</strong>
                  <p className="meta">
                    {o.email} · {o.memberStatus || '—'}
                  </p>
                  {o.recognition?.current && (
                    <p className="metaMuted" style={{ marginTop: 4 }}>
                      <BadgeCheck
                        size={14}
                        strokeWidth={1.75}
                        aria-hidden
                        style={{ verticalAlign: -2 }}
                      />{' '}
                      {o.recognition.current.label}
                      {o.recognition.next
                        ? ` · ${o.recognition.pointsToNext} pts to ${o.recognition.next.label}`
                        : ''}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="mono" style={{ fontSize: 18, fontWeight: 600 }}>
                    {o.balance}
                  </p>
                  <p className="metaMuted">points</p>
                  <Button
                    sm
                    variant="ghost"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        orgAccountId: o.orgAccountId,
                        title: f.title || '',
                      }))
                    }
                  >
                    Award
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section label="Recent awards">
        {!data.recent?.length ? (
          <Empty
            title="No awards yet"
            body="Award points for the first verified contribution."
          />
        ) : (
          <div className="stackSm">
            {data.recent.map((e) => (
              <div key={e.id} className="card cardTight">
                <div className="rowBetween">
                  <strong>
                    {e.organizationName || e.orgName || e.orgAccountId}
                  </strong>
                  <span
                    className="mono"
                    style={{
                      color: e.points > 0 ? 'var(--accent)' : 'var(--danger)',
                    }}
                  >
                    {e.points > 0 ? `+${e.points}` : e.points}
                  </span>
                </div>
                <p className="meta" style={{ marginTop: 4 }}>
                  {e.title}
                </p>
                <p className="metaMuted">
                  {e.reasonLabel} ·{' '}
                  {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}
                  {e.awardedByName ? ` · by ${e.awardedByName}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
