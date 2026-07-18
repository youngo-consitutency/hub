import { Router } from 'express'
import {
  validateRegistration,
  createAccount,
  authenticate,
  createSession,
  getSessionAccount,
  destroySession,
  publicAccount,
} from '../lib/accounts.js'
import { ensureAdminRole, ensureOwnerSeat } from '../lib/lifecycle.js'
import { getPool } from '../lib/db.js'
import {
  createPasswordResetToken,
  consumePasswordResetToken,
  resetLink,
} from '../lib/passwordReset.js'
import { cookieValue, SESSION_COOKIE, setSessionCookie, clearSessionCookie, rateLimit } from '../lib/security.js'

export const authRouter = Router()

function bearerToken(req) {
  const h = req.headers.authorization || ''
  if (h.startsWith('Bearer ')) return h.slice(7).trim()
  return String(req.headers['x-session-token'] || '').trim() || cookieValue(req, SESSION_COOKIE) || null
}

const loginLimit = rateLimit({ name: 'login', max: 10, windowMs: 15 * 60_000 })
const registerLimit = rateLimit({ name: 'register', max: 8, windowMs: 60 * 60_000 })
const resetLimit = rateLimit({ name: 'password-reset', max: 6, windowMs: 15 * 60_000 })

// No caching for auth endpoints
authRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

authRouter.get('/me', async (req, res) => {
  try {
    let account = await getSessionAccount(bearerToken(req))
    if (!account) {
      return res.status(401).json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } })
    }
    account = await ensureAdminRole(account)
    res.json({ account })
  } catch (err) {
    console.error('auth/me failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not load your session.' } })
  }
})

authRouter.post('/register', registerLimit, async (req, res) => {
  try {
    const result = validateRegistration(req.body)
    if (result.honeypot) return res.status(201).json({ ok: true }) // feign success for bots
    if (result.fields) {
      return res.status(400).json({
        error: { code: 'validation', message: 'Please check the form.', fields: result.fields },
      })
    }

    const pool = getPool()
    let account
    let session
    if (pool) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        account = await createAccount(result.data, client)
        if (account.entityType === 'organization') await ensureOwnerSeat(account, client)
        session = await createSession(account.id, client)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } else {
      account = await createAccount(result.data)
      if (account.entityType === 'organization') await ensureOwnerSeat(account)
      session = await createSession(account.id)
    }
    account = await ensureAdminRole(account)
    console.log(JSON.stringify({
      event: 'hub_register',
      track: account.membershipTrack,
      entity: account.entityType,
      country: account.country,
      at: new Date().toISOString(),
    }))
    setSessionCookie(res, session.token, session.expiresAt)
    res.status(201).json({ ok: true, token: session.token, account, expiresAt: session.expiresAt })
  } catch (err) {
    if (err.code === 'email_taken') {
      return res.status(409).json({
        error: {
          code: 'email_taken',
          message: err.message,
          fields: { email: 'An account with this email already exists. Sign in instead.' },
        },
      })
    }
    console.error('auth/register failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not create your account — please try again.' } })
  }
})

authRouter.post('/login', loginLimit, async (req, res) => {
  try {
    const b = req.body || {}
    if (b.website) return res.status(200).json({ ok: true }) // honeypot

    const email = String(b.email || '').trim()
    const password = String(b.password || '')
    const fields = {}
    if (!email) fields.email = 'Please enter your email.'
    if (!password) fields.password = 'Please enter your password.'
    if (Object.keys(fields).length) {
      return res.status(400).json({ error: { code: 'validation', message: 'Please check the form.', fields } })
    }

    const row = await authenticate(email, password)
    if (!row) {
      return res.status(401).json({
        error: { code: 'invalid_credentials', message: 'Email or password is incorrect.' },
      })
    }

    let account = publicAccount(row)
    const session = await createSession(account.id)
    account = await ensureAdminRole(account)
    console.log(JSON.stringify({
      event: 'hub_login',
      track: account.membershipTrack,
      at: new Date().toISOString(),
    }))
    setSessionCookie(res, session.token, session.expiresAt)
    res.json({ ok: true, token: session.token, account, expiresAt: session.expiresAt })
  } catch (err) {
    console.error('auth/login failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not sign you in — please try again.' } })
  }
})

authRouter.post('/logout', async (req, res) => {
  try {
    await destroySession(bearerToken(req))
    clearSessionCookie(res)
    res.json({ ok: true })
  } catch (err) {
    console.error('auth/logout failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not sign you out.' } })
  }
})

const GENERIC_FORGOT =
  'If an account exists for that email, a password reset link has been issued. Check your inbox — or ask an admin if email delivery is not configured yet.'

authRouter.post('/forgot-password', resetLimit, async (req, res) => {
  try {
    const b = req.body || {}
    if (b.website) return res.json({ ok: true, message: GENERIC_FORGOT })
    const email = String(b.email || '').trim().toLowerCase()
    if (!email) {
      return res.status(400).json({
        error: { code: 'validation', message: 'Please enter your email.', fields: { email: 'Email is required.' } },
      })
    }

    const created = await createPasswordResetToken(email)
    if (created) {
      const origin = process.env.APP_ORIGIN || `${req.protocol}://${req.get('host')}`
      const url = resetLink(origin, created.rawToken)
      // No SMTP wired yet: log for operators / Railway logs. Never put the token in the API response.
      console.log(JSON.stringify({
        event: 'password_reset_issued',
        email: created.email,
        expiresAt: created.expiresAt,
        resetUrl: url,
      }))
    }

    res.json({ ok: true, message: GENERIC_FORGOT })
  } catch (err) {
    console.error('forgot-password failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not process reset request.' } })
  }
})

authRouter.post('/reset-password', resetLimit, async (req, res) => {
  try {
    const b = req.body || {}
    if (b.website) return res.json({ ok: true })
    const token = String(b.token || '').trim()
    const password = String(b.password || '')
    const passwordConfirm = String(b.passwordConfirm || '')
    const fields = {}
    if (!token) fields.token = 'Reset token is missing. Open the full link from your email or admin.'
    if (password.length < 10) fields.password = 'Password must be at least 10 characters.'
    if (password !== passwordConfirm) fields.passwordConfirm = 'Passwords do not match.'
    if (Object.keys(fields).length) {
      return res.status(400).json({ error: { code: 'validation', message: 'Please check the form.', fields } })
    }

    await consumePasswordResetToken(token, password)
    res.json({
      ok: true,
      message: 'Password updated. You can sign in with your new password.',
    })
  } catch (err) {
    if (err.code === 'invalid_token' || err.code === 'validation') {
      return res.status(400).json({ error: { code: err.code, message: err.message } })
    }
    console.error('reset-password failed:', err.message)
    res.status(500).json({ error: { code: 'server_error', message: 'Could not reset password.' } })
  }
})
