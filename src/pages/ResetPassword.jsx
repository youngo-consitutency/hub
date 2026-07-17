import { useMemo, useState } from 'react'
import { apiPost } from '../lib/api.js'
import { Button } from '../components/ui.jsx'
import { navigate } from '../lib/router.js'
import { KeyRound, Check } from 'lucide-react'

function tokenFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('token') || ''
  } catch {
    return ''
  }
}

export function ResetPassword() {
  const token = useMemo(() => tokenFromUrl(), [])
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFields({})
    try {
      await apiPost('/auth/reset-password', { token, password, passwordConfirm })
      setDone(true)
    } catch (err) {
      setFields(err.fields || {})
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="mandateGate">
        <div className="mandateShell" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
          <div className="card">
            <h1>Invalid reset link</h1>
            <p className="meta" style={{ marginTop: 8 }}>
              This page needs a full reset link. Use “Forgot password” on the sign-in screen, or ask an admin for a new link.
            </p>
            <div className="detailActions">
              <Button variant="primary" onClick={() => navigate('/')}>Back to hub</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="mandateGate">
        <div className="mandateShell" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
          <div className="card">
            <div className="rowGap" style={{ marginBottom: 12 }}>
              <span className="iconTile"><Check size={22} strokeWidth={1.75} aria-hidden /></span>
              <h1>Password updated</h1>
            </div>
            <p className="meta">Sign in with your email and new password.</p>
            <div className="detailActions">
              <Button variant="primary" glow onClick={() => navigate('/')}>Go to sign in</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mandateGate">
      <div className="mandateShell" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <form className="card authForm" onSubmit={submit} noValidate>
          <div className="rowGap" style={{ marginBottom: 8 }}>
            <span className="iconTile"><KeyRound size={22} strokeWidth={1.75} aria-hidden /></span>
            <div>
              <h1>Set a new password</h1>
              <p className="meta" style={{ marginTop: 4 }}>Choose a password with at least 10 characters.</p>
            </div>
          </div>
          <label className="field">
            <span>New password *</span>
            <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {fields.password && <span className="fieldError">{fields.password}</span>}
          </label>
          <label className="field">
            <span>Confirm password *</span>
            <input className="input" type="password" autoComplete="new-password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
            {fields.passwordConfirm && <span className="fieldError">{fields.passwordConfirm}</span>}
          </label>
          {error && <p className="meta" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
          <Button type="submit" variant="primary" glow disabled={submitting}>
            {submitting ? 'Saving…' : 'Update password'}
          </Button>
        </form>
      </div>
    </div>
  )
}
