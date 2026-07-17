import { useState } from 'react'
import { apiPost } from '../lib/api.js'
import { UserPlus, Check } from 'lucide-react'

const EMPTY = { name: '', email: '', country: '', organization: '', website: '' }

export function GysSignup() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState('idle') // idle | submitting | done
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setStatus('submitting'); setError(null); setFields({})
    try {
      await apiPost('/gys/signup', form)
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      setFields(err.fields || {})
      if (!err.fields) setError(err.message)
    }
  }

  if (status === 'done') {
    return (
      <div className="card gysSignupCard">
        <div className="rowGap" style={{ alignItems: 'flex-start' }}>
          <span className="iconTile" style={{ width: 36, height: 36 }}><Check size={18} strokeWidth={1.75} aria-hidden /></span>
          <div>
            <h3>You’re on the list</h3>
            <p className="meta" style={{ marginTop: 4 }}>We’ll be in touch about the GYS 2026 process — consultations, hackathons, and drafting. Thanks for stepping up.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card gysSignupCard">
      <h3>Help shape GYS 2026</h3>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        The next Global Youth Statement is being built now. Add your name to join the process — regional consultations, thematic hackathons, and drafting.
      </p>

      {!open ? (
        <div className="detailActions">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <UserPlus size={18} strokeWidth={1.75} aria-hidden />Sign up to participate
          </button>
        </div>
      ) : (
        <form className="gysForm" onSubmit={submit} noValidate>
          <div className="formRow">
            <label className="field">
              <span>Name</span>
              <input className="input" value={form.name} onChange={set('name')} autoComplete="name" />
              {fields.name && <span className="fieldError">{fields.name}</span>}
            </label>
            <label className="field">
              <span>Email</span>
              <input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" />
              {fields.email && <span className="fieldError">{fields.email}</span>}
            </label>
          </div>
          <div className="formRow">
            <label className="field">
              <span>Country</span>
              <input className="input" value={form.country} onChange={set('country')} autoComplete="country-name" />
              {fields.country && <span className="fieldError">{fields.country}</span>}
            </label>
            <label className="field">
              <span>Organization <span className="metaMuted">(optional)</span></span>
              <input className="input" value={form.organization} onChange={set('organization')} autoComplete="organization" />
            </label>
          </div>

          {/* Honeypot — hidden from users, tempting to bots. */}
          <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} />

          {error && <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>}

          <div className="detailActions">
            <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Sending…' : 'Submit'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => { setOpen(false); setFields({}); setError(null) }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
