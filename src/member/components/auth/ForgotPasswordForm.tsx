interface ForgotPasswordFormProps {
  login: { email: string; website: string }
  fields: Record<string, string>
  error?: string | null
  forgotMsg?: string | null
  status: string
  setLog: (key: 'email' | 'website') => ChangeEventHandler<HTMLInputElement>
  onSubmit: FormEventHandler<HTMLFormElement>
  onBack: () => void
  className?: string
  hideOperatorNote?: boolean
}

import type { ChangeEventHandler, FormEventHandler } from 'react'
import { TbArrowLeft as ArrowLeft } from '../dirIcons'
import { Button } from '../ui'
import { FormAlert, Honeypot, LoginEmailField } from './shared'

export function ForgotPasswordForm({
  login,
  fields,
  error,
  forgotMsg,
  status,
  setLog,
  onSubmit,
  onBack,
  className = 'authForm card',
  hideOperatorNote = false,
}: ForgotPasswordFormProps) {
  return (
    <form className={className} onSubmit={onSubmit} noValidate>
      <FormAlert>{error}</FormAlert>
      <LoginEmailField login={login} fields={fields} setLog={setLog} />
      <Honeypot value={login.website} onChange={setLog('website')} />
      {forgotMsg && (
        <p className="meta" style={{ color: 'var(--accent)' }} role="status">
          {forgotMsg}
        </p>
      )}
      {hideOperatorNote ? null : (
        <p className="metaMuted">
          Until email delivery is connected, reset links appear in the server runtime logs for
          operators. Admins can also issue links from Admin.
        </p>
      )}
      <div className="detailActions">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft size={18} strokeWidth={2} aria-hidden />
          Back to sign in
        </Button>
        <Button type="submit" variant="primary" glow disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Sending…' : 'Send reset link'}
        </Button>
      </div>
    </form>
  )
}
