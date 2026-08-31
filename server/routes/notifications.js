import { timingSafeEqual } from 'node:crypto'
import express, { Router } from 'express'
import { findAccountByEmail } from '../lib/accounts.js'
import { recordAudit } from '../lib/audit.js'
import { consumeEmailVerificationToken } from '../lib/emailVerification.js'
import {
  setEmailPreference,
  suppressAccountEmail,
} from '../lib/notificationStore.js'
import { verifyUnsubscribeToken } from '../lib/unsubscribe.js'

export const notificationRouter = Router()

notificationRouter.use(express.urlencoded({ extended: false, limit: '2kb' }))
notificationRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

function resultPage(title, message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1rem;color:#14251d"><h1>${title}</h1><p>${message}</p><p><a href="/profile">Return to YOUNGO Hub</a></p></body></html>`
}

async function unsubscribe(req, res, next) {
  try {
    const verified = verifyUnsubscribeToken(req.query.token)
    if (!verified) {
      return res
        .status(400)
        .send(
          resultPage(
            'Link not valid',
            'This unsubscribe link is invalid. You can still change email settings from your Profile.',
          ),
        )
    }
    await setEmailPreference(verified.accountId, verified.category, false)
    await recordAudit({
      actorId: verified.accountId,
      action: 'notification.preference_disabled',
      targetType: 'notification_preference',
      targetId: `${verified.accountId}:email:${verified.category}`,
      after: { channel: 'email', category: verified.category, enabled: false },
      requestId: req.requestId,
    })
    res.send(
      resultPage(
        'Email preference updated',
        `You will no longer receive ${verified.category} email. Other categories were not changed.`,
      ),
    )
  } catch (error) {
    next(error)
  }
}

notificationRouter.get('/unsubscribe', unsubscribe)
notificationRouter.post('/unsubscribe', unsubscribe)

notificationRouter.get('/verify-email', async (req, res, next) => {
  try {
    const result = await consumeEmailVerificationToken(req.query.token)
    if (!result) {
      return res
        .status(400)
        .send(
          resultPage(
            'Verification link not valid',
            'This verification link is invalid or expired. Request another from your Profile.',
          ),
        )
    }
    await recordAudit({
      actorId: result.accountId,
      action: 'account.email_verified',
      targetType: 'account',
      targetId: result.accountId,
      after: { emailVerified: true },
      requestId: req.requestId,
    })
    res.redirect(303, '/profile?emailVerified=1')
  } catch (error) {
    next(error)
  }
})

function webhookAuthorized(req) {
  const expected = String(process.env.EMAIL_WEBHOOK_SECRET || '')
  const supplied = String(req.get('x-email-webhook-secret') || '')
  if (!expected || !supplied) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}

notificationRouter.post('/provider-events', async (req, res, next) => {
  try {
    if (!webhookAuthorized(req)) {
      return res
        .status(401)
        .json({ error: { code: 'unauthorized', message: 'Invalid webhook.' } })
    }
    const event = String(req.body?.event || '')
    if (!['hard_bounce', 'complaint'].includes(event)) {
      return res.status(202).json({ ok: true, ignored: true })
    }
    const account = await findAccountByEmail(req.body?.email)
    if (account) {
      await suppressAccountEmail({
        accountId: account.id,
        email: account.email,
        reason: event,
        providerEventId: String(req.body?.providerEventId || '').slice(0, 255),
      })
      await recordAudit({
        actorId: null,
        action: 'email.address_suppressed',
        targetType: 'account',
        targetId: account.id,
        after: { reason: event },
        requestId: req.requestId,
      })
    }
    res.status(202).json({ ok: true })
  } catch (error) {
    next(error)
  }
})
