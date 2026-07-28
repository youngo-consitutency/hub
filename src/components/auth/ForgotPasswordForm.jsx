import { Button } from '../ui.jsx'
import { FieldError } from '../FormControls.jsx'
import { fieldClass } from './helpers.js'
import { FormAlert } from './shared.jsx'

export function ForgotPasswordForm({
  login,
  fields,
  error,
  forgotMsg,
  status,
  setLog,
  onSubmit,
  onBack,
}) {
  return (
    <form className="authForm card" onSubmit={onSubmit} noValidate>
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
      <input
        className="hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={login.website}
        onChange={setLog('website')}
      />
      {forgotMsg && (
        <p className="meta" style={{ color: 'var(--accent)' }} role="status">
          {forgotMsg}
        </p>
      )}
      <p className="metaMuted">
        Until email delivery is connected, reset links appear in Railway
        deploy/runtime logs for operators. Admins can also issue links from
        Admin.
      </p>
      <div className="detailActions">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back to sign in
        </Button>
        <Button
          type="submit"
          variant="primary"
          glow
          disabled={status === 'submitting'}
        >
          {status === 'submitting' ? 'Sending…' : 'Send reset link'}
        </Button>
      </div>
    </form>
  )
}
