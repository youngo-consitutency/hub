interface SignInFormProps {
  login?: AnyValue
  fields?: AnyValue
  error?: string
  status?: AnyValue
  setLog?: AnyValue
  onSubmit?: AnyValue
  onForgot?: AnyValue
  className?: string
}

import type { AnyValue } from '../../lib/types'
import { Button } from '../ui'
import { FieldError } from '../FormControls'
import { fieldClass } from './helpers'
import { FormAlert } from './shared'

export function SignInForm({
  login,
  fields,
  error,
  status,
  setLog,
  onSubmit,
  onForgot,
  className = 'authForm card',
}: SignInFormProps) {
  return (
    <form className={className} onSubmit={onSubmit} noValidate>
      <FormAlert>{error}</FormAlert>
      <label className={fieldClass(fields.email)}>
        <span>Email *</span>
        <input
          className="input"
          type="email"
          autoComplete="email"
          value={login.email}
          onChange={setLog('email')}
          aria-invalid={!!fields.email}
        />
        <FieldError msg={fields.email} />
      </label>
      <label className={fieldClass(fields.password)}>
        <span>Password *</span>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          value={login.password}
          onChange={setLog('password')}
          aria-invalid={!!fields.password}
        />
        <FieldError msg={fields.password} />
      </label>
      <input
        className="hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={login.website}
        onChange={setLog('website')}
      />
      <Button type="submit" variant="primary" glow disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Signing in…' : 'Sign in & open hub'}
      </Button>
      <button
        type="button"
        className="meta"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--accent)',
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
        onClick={onForgot}
      >
        Forgot password?
      </button>
    </form>
  )
}
