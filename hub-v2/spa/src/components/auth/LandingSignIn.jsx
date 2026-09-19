import { useState } from 'react'
import { apiPost } from '../../lib/api.js'
import { setSession } from '../../lib/session.js'
import { A } from '../ui.jsx'
import { scrollToFirstError } from './helpers.js'
import { ForgotPasswordForm } from './ForgotPasswordForm.jsx'
import { SignInForm } from './SignInForm.jsx'

/**
 * Compact sign-in desk for the signed-out landing page. Join still goes
 * through /join so new members meet the membership policy first.
 */
export function LandingSignIn({ onAuthenticated }) {
  const [mode, setMode] = useState('signin')
  const [login, setLogin] = useState({ email: '', password: '', website: '' })
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle')
  const [forgotMsg, setForgotMsg] = useState(null)

  const setLog = (key) => (event) => {
    setLogin((current) => ({ ...current, [key]: event.target.value }))
    setFields((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
    if (error) setError(null)
  }

  const applyErrors = (err) => {
    setStatus('idle')
    setFields(err.fields || {})
    setError(err.message || 'Please fix the highlighted fields.')
    scrollToFirstError()
  }

  const finishAuth = (data) => {
    if (!data?.account) {
      setStatus('idle')
      setError(
        'We could not complete that submission. Please reload the page and try again, or contact support if it keeps happening.',
      )
      return
    }
    setSession({ account: data.account })
    onAuthenticated?.(data.account)
  }

  const submitLogin = async (event) => {
    event.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})
    let signedIn = false
    try {
      const data = await apiPost('/auth/login', login)
      finishAuth(data)
      signedIn = Boolean(data?.account)
    } catch (err) {
      applyErrors(err)
    } finally {
      if (!signedIn) setStatus('idle')
    }
  }

  const submitForgot = async (event) => {
    event.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})
    setForgotMsg(null)
    try {
      const data = await apiPost('/auth/forgot-password', {
        email: login.email,
        website: login.website,
      })
      setStatus('idle')
      setForgotMsg(
        data.message || 'If an account exists, a reset link was issued.',
      )
    } catch (err) {
      applyErrors(err)
    }
  }

  const signingIn = mode === 'signin'

  return (
    <section
      className="platformAuth"
      id="signin"
      aria-labelledby="landing-auth-title"
    >
      <h2 id="landing-auth-title" className="platformAuthTitle">
        {signingIn ? 'Sign in' : 'Reset password'}
      </h2>

      {signingIn ? (
        <>
          <p className="platformAuthLead">Use the email you registered with.</p>
          <SignInForm
            className="authForm"
            login={login}
            fields={fields}
            error={error}
            status={status}
            setLog={setLog}
            onSubmit={submitLogin}
            onForgot={() => {
              setMode('forgot')
              setError(null)
              setFields({})
            }}
          />
          <p className="platformAuthJoin">
            New to the Hub? <A href="/join">Create a free account</A>
          </p>
        </>
      ) : (
        <>
          <p className="platformAuthLead">
            Enter your account email. We’ll issue a one-time reset link.
          </p>
          <ForgotPasswordForm
            className="authForm"
            login={login}
            fields={fields}
            error={error}
            forgotMsg={forgotMsg}
            status={status}
            setLog={setLog}
            hideOperatorNote
            onSubmit={submitForgot}
            onBack={() => {
              setMode('signin')
              setForgotMsg(null)
              setError(null)
            }}
          />
        </>
      )}
    </section>
  )
}
