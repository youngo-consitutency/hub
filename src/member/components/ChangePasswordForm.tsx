interface ChangePasswordFormProps {
  onChanged?: (account?: Account) => void
  submitLabel?: string
  intro?: ReactNode
}

import type { FormEvent, ReactNode } from 'react'
import type { Account } from '../lib/types'
import { useState } from 'react'
import { apiPost, errorMessage, fieldErrors } from '../lib/api'
import { Button } from './ui'
import { FormAlert } from './auth/shared'
import { fieldClass } from './auth/helpers'
import { FieldError } from './FormControls'

export function ChangePasswordForm({
  onChanged,
  submitLabel = 'Save new password',
  intro,
}: ChangePasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage('')
    setFields({})
    try {
      const data = await apiPost<{ account?: Account }>('/auth/change-password', {
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
      setFields(fieldErrors(err))
      setError(errorMessage(err))
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
