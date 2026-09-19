import { useState } from 'react'
import { apiPost } from '../lib/api.js'
import { Button } from './ui.jsx'
import { FormAlert } from './auth/shared.jsx'
import { fieldClass } from './auth/helpers.js'
import { FieldError } from './FormControls.jsx'

export function ChangePasswordForm({
  onChanged,
  submitLabel = 'Save new password',
  intro,
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage('')
    setFields({})
    try {
      const data = await apiPost('/auth/change-password', {
        currentPassword,
        password,
        passwordConfirm,
      })
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirm('')
      setMessage('Password updated.')
      onChanged?.(data.account)
    } catch (err) {
      setFields(err.fields || {})
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="authForm" onSubmit={submit} noValidate>
      {intro}
      <FormAlert>{error}</FormAlert>
      {message && !error ? <p className="meta">{message}</p> : null}
      <label className={fieldClass(fields.currentPassword)}>
        <span>Current password *</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          aria-invalid={!!fields.currentPassword}
        />
        <FieldError msg={fields.currentPassword} />
      </label>
      <label className={fieldClass(fields.password)}>
        <span>New password *</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={!!fields.password}
        />
        <FieldError msg={fields.password} />
      </label>
      <label className={fieldClass(fields.passwordConfirm)}>
        <span>Confirm new password *</span>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          aria-invalid={!!fields.passwordConfirm}
        />
        <FieldError msg={fields.passwordConfirm} />
      </label>
      <Button type="submit" variant="primary" glow disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
