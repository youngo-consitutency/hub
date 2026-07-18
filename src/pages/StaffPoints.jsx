import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { Button, Empty, ErrorCard, Section, Skeletons } from '../components/ui.jsx'
import { Award, BadgeCheck, Plus } from 'lucide-react'

const EMPTY_FORM = {
  orgAccountId: '',
  reasonCode: 'unfccc_submission',
  points: '',
  title: '',
  note: '',
}

export function StaffPoints() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('idle')
  const [flash, setFlash] = useState(null)

  const load = () => {
    setError(null)
    apiGet('/member/staff/points')
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

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
      })
      setFlash(
        `Awarded ${result.entry.points} pts · new balance ${result.balance}`
        + (result.recognition.current ? ` · ${result.recognition.current.label}` : ''),
      )
      setForm((f) => ({ ...EMPTY_FORM, orgAccountId: f.orgAccountId, reasonCode: f.reasonCode }))
      load()
      setStatus('idle')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  if (error && !data) return <ErrorCard message={error} onRetry={load} />
  if (!data) return <Skeletons n={4} />

  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>Staff · recognition</p>
      <h1 className="rowGap"><Award size={24} strokeWidth={1.75} aria-hidden /> NGO contribution points</h1>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        Award points when an NGO supports pool badges, endorses or contributes to UNFCCC submissions,
        or otherwise helps constituency work. Points are staff-verified — not self-claimed.
      </p>

      {flash && (
        <div className="card cardTight" style={{ marginTop: 12, borderColor: 'var(--accent)' }}>
          <p className="meta" style={{ color: 'var(--accent)', fontWeight: 500 }}>{flash}</p>
        </div>
      )}
      {error && <ErrorCard message={error} onRetry={load} />}

      <Section label="Award points">
        <form className="card stack" onSubmit={award}>
          <label className="field">
            <span>Organisation *</span>
            <select
              className="input"
              required
              value={form.orgAccountId}
              onChange={(e) => setForm((f) => ({ ...f, orgAccountId: e.target.value }))}
            >
              <option value="">Select NGO…</option>
              {(data.orgs || []).map((o) => (
                <option key={o.orgAccountId} value={o.orgAccountId}>
                  {(o.name || 'Organisation')} · {o.balance} pts
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Contribution type *</span>
            <select
              className="input"
              value={form.reasonCode}
              onChange={(e) => setForm((f) => ({ ...f, reasonCode: e.target.value, points: '' }))}
            >
              {(data.reasons || []).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}{r.defaultPoints ? ` (default ${r.defaultPoints})` : ''}
                </option>
              ))}
            </select>
            {reasonMeta && <p className="metaMuted" style={{ marginTop: 4 }}>{reasonMeta.description}</p>}
          </label>
          <div className="formRow">
            <label className="field">
              <span>Points *</span>
              <input
                className="input"
                type="number"
                required
                value={form.points}
                onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                placeholder={reasonMeta?.defaultPoints ? String(reasonMeta.defaultPoints) : '10'}
              />
            </label>
            <label className="field">
              <span>Title *</span>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
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
          <Button type="submit" variant="primary" disabled={status === 'submitting'}>
            <Plus size={16} strokeWidth={1.75} aria-hidden />
            {status === 'submitting' ? 'Saving…' : 'Award points'}
          </Button>
        </form>
      </Section>

      <Section label="Organisation balances">
        {!data.orgs?.length
          ? <Empty title="No organisations yet" body="Register an NGO account first." />
          : (
            <div className="stackSm">
              {data.orgs.map((o) => (
                <div key={o.orgAccountId} className="card cardTight rowBetween">
                  <div>
                    <strong>{o.name || 'Organisation'}</strong>
                    <p className="meta">{o.email} · {o.memberStatus || '—'}</p>
                    {o.recognition?.current && (
                      <p className="metaMuted" style={{ marginTop: 4 }}>
                        <BadgeCheck size={14} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -2 }} />
                        {' '}{o.recognition.current.label}
                        {o.recognition.next
                          ? ` · ${o.recognition.pointsToNext} pts to ${o.recognition.next.label}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{o.balance}</p>
                    <p className="metaMuted">points</p>
                    <Button
                      sm
                      variant="ghost"
                      onClick={() => setForm((f) => ({
                        ...f,
                        orgAccountId: o.orgAccountId,
                        title: f.title || '',
                      }))}
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
        {!data.recent?.length
          ? <Empty title="No awards yet" body="Award points for the first verified contribution." />
          : (
            <div className="stackSm">
              {data.recent.map((e) => (
                <div key={e.id} className="card cardTight">
                  <div className="rowBetween">
                    <strong>{e.organizationName || e.orgName || e.orgAccountId}</strong>
                    <span className="mono" style={{ color: e.points > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                      {e.points > 0 ? `+${e.points}` : e.points}
                    </span>
                  </div>
                  <p className="meta" style={{ marginTop: 4 }}>{e.title}</p>
                  <p className="metaMuted">
                    {e.reasonLabel} · {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}
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
