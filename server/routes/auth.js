import { Router } from 'express'
import {
  validateRegistration,
  createAccount,
  authenticate,
  createSession,
  getSessionAccount,
  destroySession,
  changePassword,
} from '../lib/accounts.js'
import { getPool } from '../lib/db.js'
import {
  createPasswordResetToken,
  consumePasswordResetToken,
  invalidatePasswordResetToken,
  resetLink,
} from '../lib/passwordReset.js'
import { appOrigin } from '../lib/config.js'
import {
  deliveryFailure,
  emailConfigured,
  sendTemplatedEmail,
} from '../lib/notifications/transport.js'
import { createRateLimiter } from '../lib/rateLimit.js'
import {
  bearerToken,
  setSessionCookie,
  clearSessionCookie,
} from '../lib/security.js'

export const authRouter = Router()
const registerLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 8 })
const loginLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 })
// Per-IP limiting alone does not slow a credential-stuffing run spread across
// many addresses, so one account may also be targeted only so often. The
// threshold stays well above human retry rates: this throttles guessing, it is
// not a lockout, and it clears on its own.
const loginAccountLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) =>
    `email:${String(req.body?.email || '')
      .trim()
      .toLowerCase()}`,
})
const resetRequestLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 8,
})
const resetRecipientLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 4,
  key: (req) =>
    `reset:${String(req.body?.email || '')
      .trim()
      .toLowerCase()}`,
})
const resetConsumeLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
})

// No caching for auth endpoints
authRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

authRouter.get('/me', async (req, res) => {
  try {
    const account = await getSessionAccount(bearerToken(req))
    if (!account) {
      return res.status(401).json({
        error: { code: 'unauthorized', message: 'Sign in to continue.' },
      })
    }
    res.json({ account })
  } catch (err) {
    console.error('auth/me failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not load your session.',
      },
    })
  }
})

authRouter.post('/register', registerLimit, async (req, res) => {
  try {
    const result = validateRegistration(req.body)
    if (result.honeypot) {
      // Feign success so bots do not learn they were caught. Log it, though:
      // a false positive here silently costs a real member their account, and
      // without this line there is no way to tell that it happened.
      console.log(
        JSON.stringify({
          event: 'hub_register_rejected_as_automated',
          requestId: req.requestId,
          at: new Date().toISOString(),
        }),
      )
      return res.status(201).json({ ok: true })
    }
    if (result.fields) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'Please check the form.',
          fields: result.fields,
        },
      })
    }

    const pool = getPool()
    let session
    if (pool) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const createdAccount = await createAccount(result.data, client)
        session = await createSession(createdAccount.id, client)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } else {
      const createdAccount = await createAccount(result.data)
      session = await createSession(createdAccount.id)
    }
    const account = session && (await getSessionAccount(session.token))
    if (!account) {
      if (session) await destroySession(session.token)
      return res.status(401).json({
        error: {
          code: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      })
    }
    console.log(
      JSON.stringify({
        event: 'hub_register',
        track: account.membershipTrack,
        entity: account.entityType,
        country: account.country,
        at: new Date().toISOString(),
      }),
    )
    setSessionCookie(res, session.token, session.expiresAt)
    res.status(201).json({
      ok: true,
      token: session.token,
      account,
      expiresAt: session.expiresAt,
    })
  } catch (err) {
    if (err.code === 'email_taken') {
      return res.status(409).json({
        error: {
          code: 'email_taken',
          message: err.message,
          fields: {
            email:
              'An account with this email already exists. Sign in instead.',
          },
        },
      })
    }
    console.error('auth/register failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'We could not create your account. Please try again.',
      },
    })
  }
})

authRouter.post('/login', loginLimit, loginAccountLimit, async (req, res) => {
  try {
    const b = req.body || {}
    if (b.website) return res.status(200).json({ ok: true }) // honeypot

    const email = String(b.email || '').trim()
    const password = String(b.password || '')
    const fields = {}
    if (!email) fields.email = 'Please enter your email.'
    if (!password) fields.password = 'Please enter your password.'
    if (Object.keys(fields).length) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'Please check the form.',
          fields,
        },
      })
    }

    const row = await authenticate(email, password)
    if (!row) {
      return res.status(401).json({
        error: {
          code: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      })
    }

    if (row.email_verified_at || row.emailVerifiedAt) {
      try {
        const { applyMandateFromRoster } =
          await import('../lib/applyMandate.js')
        await applyMandateFromRoster(row.id, { requestId: req.requestId })
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: 'mandate_self_verify_failed',
            accountId: row.id,
            message: error.message,
          }),
        )
      }
    }

    const session = await createSession(row.id)
    const account = session && (await getSessionAccount(session.token))
    if (!account) {
      if (session) await destroySession(session.token)
      return res.status(401).json({
        error: {
          code: 'invalid_credentials',
          message: 'Email or password is incorrect.',
        },
      })
    }
    console.log(
      JSON.stringify({
        event: 'hub_login',
        track: account.membershipTrack,
        at: new Date().toISOString(),
      }),
    )
    setSessionCookie(res, session.token, session.expiresAt)
    res.json({
      ok: true,
      token: session.token,
      account,
      expiresAt: session.expiresAt,
    })
  } catch (err) {
    console.error('auth/login failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'We could not sign you in. Please try again.',
      },
    })
  }
})

const changePasswordLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
})

authRouter.post('/change-password', changePasswordLimit, async (req, res) => {
  try {
    const token = bearerToken(req)
    const account = await getSessionAccount(token)
    if (!account) {
      return res.status(401).json({
        error: { code: 'unauthorized', message: 'Sign in to continue.' },
      })
    }
    const b = req.body || {}
    await changePassword({
      accountId: account.id,
      currentPassword: String(b.currentPassword || ''),
      password: String(b.password || ''),
      passwordConfirm: String(b.passwordConfirm || ''),
      keepSessionToken: token,
    })
    const next = await getSessionAccount(token)
    res.json({
      ok: true,
      account: next,
    })
  } catch (err) {
    if (err.code === 'validation') {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: err.message,
          fields: err.fields || {},
        },
      })
    }
    if (err.code === 'unauthorized') {
      return res.status(401).json({
        error: { code: 'unauthorized', message: err.message },
      })
    }
    console.error('change-password failed:', err.message)
    res.status(500).json({
      error: {
        code: 'server_error',
        message: 'Could not update the password.',
      },
    })
  }
})

authRouter.post('/logout', async (req, res) => {
  try {
    await destroySession(bearerToken(req))
    clearSessionCookie(res)
    res.json({ ok: true })
  } catch (err) {
    console.error('auth/logout failed:', err.message)
    res.status(500).json({
      error: { code: 'server_error', message: 'Could not sign you out.' },
    })
  }
})

const GENERIC_FORGOT =
  'If an account exists for that email, a password reset link has been issued. Check your inbox — or ask an admin if email delivery is not configured yet.'

authRouter.post(
  '/forgot-password',
  resetRequestLimit,
  resetRecipientLimit,
  async (req, res) => {
    try {
      const b = req.body || {}
      if (b.website) return res.json({ ok: true, message: GENERIC_FORGOT })
      const email = String(b.email || '')
        .trim()
        .toLowerCase()
      if (!email) {
        return res.status(400).json({
          error: {
            code: 'validation',
            message: 'Please enter your email.',
            fields: { email: 'Email is required.' },
          },
        })
      }

      const created = await createPasswordResetToken(email)
      if (created) {
        if (emailConfigured()) {
          try {
            await sendTemplatedEmail({
              to: created.email,
              templateKey: 'password-reset',
              data: {
                actionUrl: resetLink(appOrigin(), created.rawToken),
                actionLabel: 'Reset password',
              },
            })
            console.log(
              JSON.stringify({
                event: 'password_reset_email_accepted',
                accountId: created.accountId,
                expiresAt: created.expiresAt,
              }),
            )
          } catch (error) {
            await invalidatePasswordResetToken(created.rawToken)
            const failure = deliveryFailure(error)
            console.warn(
              JSON.stringify({
                event: 'password_reset_email_failed',
                accountId: created.accountId,
                code: failure.code,
              }),
            )
          }
        } else {
          await invalidatePasswordResetToken(created.rawToken)
          console.log(
            JSON.stringify({
              event: 'password_reset_requested',
              accountId: created.accountId,
              deliveryConfigured: false,
            }),
          )
        }
      }

      res.json({ ok: true, message: GENERIC_FORGOT })
    } catch (err) {
      console.error('forgot-password failed:', err.message)
      res.status(500).json({
        error: {
          code: 'server_error',
          message: 'Could not process reset request.',
        },
      })
    }
  },
)

authRouter.post('/reset-password', resetConsumeLimit, async (req, res) => {
  try {
    const b = req.body || {}
    if (b.website) return res.json({ ok: true })
    const token = String(b.token || '').trim()
    const password = String(b.password || '')
    const passwordConfirm = String(b.passwordConfirm || '')
    const fields = {}
    if (!token)
      fields.token =
        'Reset token is missing. Open the full link from your email or admin.'
    if (password.length < 10)
      fields.password = 'Password must be at least 10 characters.'
    if (password !== passwordConfirm)
      fields.passwordConfirm = 'Passwords do not match.'
    if (Object.keys(fields).length) {
      return res.status(400).json({
        error: {
          code: 'validation',
          message: 'Please check the form.',
          fields,
        },
      })
    }

    await consumePasswordResetToken(token, password)
    res.json({
      ok: true,
      message: 'Password updated. You can sign in with your new password.',
    })
  } catch (err) {
    if (err.code === 'invalid_token' || err.code === 'validation') {
      return res
        .status(400)
        .json({ error: { code: err.code, message: err.message } })
    }
    console.error('reset-password failed:', err.message)
    res.status(500).json({
      error: { code: 'server_error', message: 'Could not reset password.' },
    })
  }
})
