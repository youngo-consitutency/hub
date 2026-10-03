interface GysSignupProps {
  embedded?: any
}

import { useState } from 'react'
import { apiPost } from '../lib/api'
import { TbUserPlus as UserPlus } from 'react-icons/tb'

const EMPTY = {
  name: '',
  email: '',
  country: '',
  organization: '',
  website: '',
}

export function GysSignup({ embedded = false }: GysSignupProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState('idle') // idle | submitting | done
  const [fields, setFields] = useState<Record<string, any>>({})
  const [error, setError] = useState<any>(null)

  const set = (k: any) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: any) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})
    try {
      await apiPost('/gys/signup', form)
      setStatus('done')
    } catch (err) {
      setStatus('idle')
      setFields((err as any).fields || {})
      if (!(err as any).fields) setError((err as any).message)
    }
  }

  if (status === 'done') {
    return (
      <div className={`gysSignupCard ${embedded ? '' : 'card'}`.trim()}>
        <div className="gysSignupIntro">
          <h3>You’re on the participation list</h3>
          <p className="meta gysSignupLead">
            The GYS team will contact you when consultations or drafting sessions open.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`gysSignupCard ${embedded ? '' : 'card'} ${open ? 'isOpen' : ''}`.trim()}>
      <div className="gysSignupIntro">
        <h3>Join the next consultation cycle</h3>
        <p className="meta gysSignupLead">
          Get notified when regional consultations and drafting sessions open.
        </p>
      </div>

      {!open ? (
        <div className="detailActions">
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <UserPlus size={18} strokeWidth={1.75} aria-hidden />
            Sign up to participate
          </button>
        </div>
      ) : (
        <form className="gysForm" onSubmit={submit} noValidate>
          <div className="formRow">
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
              />
              {fields.name && <span className="fieldError">{fields.name}</span>}
            </label>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
              />
              {fields.email && <span className="fieldError">{fields.email}</span>}
            </label>
          </div>
          <div className="formRow">
            <label className="field">
              <span>Country</span>
              <input
                className="input"
                value={form.country}
                onChange={set('country')}
                autoComplete="country-name"
              />
              {fields.country && <span className="fieldError">{fields.country}</span>}
            </label>
            <label className="field">
              <span>
                Organisation <span className="metaMuted">(optional)</span>
              </span>
              <input
                className="input"
                value={form.organization}
                onChange={set('organization')}
                autoComplete="organization"
              />
            </label>
          </div>

          {/* Honeypot — hidden from users, tempting to bots. */}
          <input
            className="hp"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.website}
            onChange={set('website')}
          />

          {error && <p className="meta formError">{error}</p>}

          <div className="detailActions">
            <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Sending…' : 'Submit'}
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setOpen(false)
                setFields({})
                setError(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
