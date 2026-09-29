import type { Endpoint } from 'payload'
import { endpoint, fail, json } from '../lib/respond'
import { validateRegistration } from '../lib/registration'
import {
  accountView,
  requireAccount,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from '../lib/accounts'
import { verifyLegacyPassword } from '../lib/password'
import { rateLimit } from '../lib/rateLimit'
import { sendEmail, emailConfigured } from '../lib/email'
import { randomBytes } from 'node:crypto'
import { appBaseUrl } from '../lib/env'
import { sha256Hex } from '../lib/crypto'

const registerLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  scope: 'register',
})
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, scope: 'login' })
const loginAccountLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  scope: 'login-account',
  key: (req) => `email:${String((req as any)._bodyEmail || '')}`,
})
const resetRequestLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  scope: 'reset-request',
})
const resetConsumeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  scope: 'reset-consume',
})
const changePasswordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  scope: 'change-password',
})

const GENERIC_FORGOT =
  'If an account exists for that email, a password reset link has been issued. Check your inbox — or ask an admin if email delivery is not configured yet.'

const noStore = (res: Response) => {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

async function loginResponse(req: any, email: string, password: string) {
  const { payload } = req

  // Find the account first so legacy scrypt credentials can be verified and
  // upgraded before the Payload login runs.
  const found = await payload.find({
    collection: 'accounts',
    where: { email: { equals: email } },
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const doc = found.docs[0] as any

  let logged: any
  try {
    logged = await payload.login({
      collection: 'accounts',
      data: { email, password },
      req,
    })
  } catch (err) {
    logged = null
  }

  if (!logged?.user && doc?.legacyPasswordHash && doc?.legacyPasswordSalt) {
    const ok = await verifyLegacyPassword(password, doc.legacyPasswordSalt, doc.legacyPasswordHash)
    if (ok) {
      await payload.update({
        collection: 'accounts',
        id: doc.id,
        data: {
          password,
          legacyPasswordHash: null,
          legacyPasswordSalt: null,
        } as any,
        overrideAccess: true,
        req,
      })
      logged = await payload.login({
        collection: 'accounts',
        data: { email, password },
        req,
      })
    }
  }

  return logged?.user ? logged : null
}

export const authEndpoints: Endpoint[] = [
  {
    path: '/auth/me',
    method: 'get',
    handler: endpoint(async (req) => {
      const user = req.user
      if (!user || user.collection !== 'accounts') {
        throw fail.unauthorized()
      }
      return noStore(json({ account: accountView(user) }))
    }),
  },
  {
    path: '/auth/register',
    method: 'post',
    handler: endpoint(async (req) => {
      await registerLimit(req)
      const b = ((await req.json?.()) || {}) as Record<string, any>
      const result = await validateRegistration(req, b)
      if (result.honeypot) {
        req.payload.logger.info({ event: 'hub_register_rejected_as_automated' })
        return noStore(json({ ok: true }, { status: 201 }))
      }
      if (result.fields) {
        throw fail.validation(result.fields)
      }
      const data = result.data!

      const existing = await req.payload.find({
        collection: 'accounts',
        where: { email: { equals: data.email } },
        limit: 1,
        overrideAccess: true,
      })
      if (existing.docs.length) {
        throw fail.conflict(
          'email_taken',
          'An account with this email already exists. Sign in instead.',
          {
            email: 'An account with this email already exists. Sign in instead.',
          },
        )
      }

      const created = await req.payload.create({
        collection: 'accounts',
        data: {
          email: data.email,
          password: data.password,
          name: data.name,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          gender: data.gender,
          genderOther: data.genderOther,
          ageBand: data.ageBand,
          dateOfBirth: data.dateOfBirth,
          minorityGroups: data.minorityGroups,
          minorityOther: data.minorityOther,
          region: data.region,
          nationality: data.nationality,
          country: data.country,
          motivation: data.motivation,
          entityType: data.entityType,
          membershipTrack: data.membershipTrack,
          organizationName: data.organizationName,
          organizationType: data.organizationType,
          isUnfcccAdmitted: data.isUnfcccAdmitted,
          orgOperateIn: data.orgOperateIn,
          orgWebsite: data.orgWebsite,
          orgSocial: data.orgSocial,
          orgMission: data.orgMission,
          dcpName: data.dcpName,
          dcpEmail: data.dcpEmail,
          dcpPhone: data.dcpPhone,
          ycpName: data.ycpName,
          ycpEmail: data.ycpEmail,
          ycpPhone: data.ycpPhone,
          under18: data.under18,
          guardianName: data.guardianName,
          guardianEmail: data.guardianEmail,
          guardianConsent: data.guardianConsent,
          memberOfAccreditedNgo: data.memberOfAccreditedNgo,
          coiDeclared: data.coiDeclared,
          policiesAccepted: data.policiesAccepted,
          membershipPolicyVersion: data.membershipPolicyVersion,
          privacyConsent: data.privacyConsent,
          privacyConsentAt: data.privacyConsentAt,
          privacyNoticeVersion: data.privacyNoticeVersion,
          memberStatus: data.memberStatus,
          hubAccessStatus: 'pending_course',
          membershipStatus: 'registered',
          constituencyWorkStatus: data.constituencyWorkStatus,
          role: 'member',
          wgInterests: data.wgInterests,
          mustChangePassword: false,
        } as any,
        overrideAccess: true,
        req,
      })

      const logged = await loginResponse(req, data.email, data.password)
      if (!logged) throw fail.unauthorized()
      const expiresAt = new Date((logged as any).exp * 1000)
      req.payload.logger.info({
        event: 'hub_register',
        track: (created as any).membershipTrack,
      })
      return noStore(
        json(
          {
            ok: true,
            token: logged.token,
            account: accountView(logged.user),
            expiresAt: expiresAt.toISOString(),
          },
          {
            status: 201,
            headers: {
              'Set-Cookie': sessionCookieHeader(logged.token, expiresAt),
            },
          },
        ),
      )
    }),
  },
  {
    path: '/auth/login',
    method: 'post',
    handler: endpoint(async (req) => {
      const b = ((await req.json?.()) || {}) as Record<string, any>
      if (b.website) return noStore(json({ ok: true }))
      const email = String(b.email || '').trim()
      const password = String(b.password || '')
      ;(req as any)._bodyEmail = email
      await loginLimit(req)
      await loginAccountLimit(req)

      const fields: Record<string, string> = {}
      if (!email) fields.email = 'Please enter your email.'
      if (!password) fields.password = 'Please enter your password.'
      if (Object.keys(fields).length) throw fail.validation(fields)

      let logged: any = null
      try {
        logged = await loginResponse(req, email, password)
      } catch {
        logged = null
      }
      if (!logged?.user) {
        return noStore(
          json(
            {
              error: {
                code: 'invalid_credentials',
                message: 'Email or password is incorrect.',
              },
            },
            { status: 401 },
          ),
        )
      }
      const expiresAt = new Date(logged.exp * 1000)
      await req.payload
        .update({
          collection: 'accounts',
          id: logged.user.id,
          data: { lastLoginAt: new Date().toISOString() } as any,
          overrideAccess: true,
          req,
        })
        .catch(() => {})
      req.payload.logger.info({
        event: 'hub_login',
        track: logged.user.membershipTrack,
      })
      return noStore(
        json(
          {
            ok: true,
            token: logged.token,
            account: accountView(logged.user),
            expiresAt: expiresAt.toISOString(),
          },
          {
            headers: {
              'Set-Cookie': sessionCookieHeader(logged.token, expiresAt),
            },
          },
        ),
      )
    }),
  },
  {
    path: '/auth/logout',
    method: 'post',
    handler: endpoint(async (req) => {
      try {
        await (req.payload as any).logout?.({ collection: 'accounts', req })
      } catch {
        // Cookie clear below is the effective logout.
      }
      return noStore(json({ ok: true }, { headers: { 'Set-Cookie': clearSessionCookieHeader() } }))
    }),
  },
  {
    path: '/auth/change-password',
    method: 'post',
    handler: endpoint(async (req) => {
      await changePasswordLimit(req)
      const account = requireAccount(req)
      const b = ((await req.json?.()) || {}) as Record<string, any>
      const currentPassword = String(b.currentPassword || '')
      const password = String(b.password || '')
      const passwordConfirm = String(b.passwordConfirm || '')
      const fields: Record<string, string> = {}
      if (!currentPassword) fields.currentPassword = 'Enter your current password.'
      if (password.length < 10) fields.password = 'Password must be at least 10 characters.'
      if (password !== passwordConfirm) fields.passwordConfirm = 'Passwords do not match.'
      if (Object.keys(fields).length) throw fail.validation(fields)

      const verified = await req.payload
        .login({
          collection: 'accounts',
          data: { email: account.email, password: currentPassword },
          req,
        })
        .then((r) => Boolean(r?.user))
        .catch(() => false)
      if (!verified) {
        throw fail.validation(
          { currentPassword: 'Current password is incorrect.' },
          'Please check the form.',
        )
      }
      await req.payload.update({
        collection: 'accounts',
        id: account.id,
        data: { password, mustChangePassword: false } as any,
        overrideAccess: true,
        req,
      })
      const fresh = await req.payload.findByID({
        collection: 'accounts',
        id: account.id,
        overrideAccess: true,
      })
      return noStore(json({ ok: true, account: accountView(fresh) }))
    }),
  },
  {
    path: '/auth/forgot-password',
    method: 'post',
    handler: endpoint(async (req) => {
      await resetRequestLimit(req)
      const b = ((await req.json?.()) || {}) as Record<string, any>
      if (b.website) return noStore(json({ ok: true, message: GENERIC_FORGOT }))
      const email = String(b.email || '')
        .trim()
        .toLowerCase()
      if (!email) {
        throw fail.validation({ email: 'Email is required.' })
      }

      const { docs } = await req.payload.find({
        collection: 'accounts',
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })
      const account = docs[0] as any
      if (account) {
        const rawToken = randomBytes(32).toString('hex')
        const tokenHash = sha256Hex(rawToken)
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
        await req.payload.create({
          collection: 'password-resets' as never,
          data: {
            account: account.id,
            email,
            tokenHash,
            expiresAt: expiresAt.toISOString(),
          } as never,
          overrideAccess: true,
        })
        if (emailConfigured()) {
          const origin = appBaseUrl()
          try {
            await sendEmail({
              to: email,
              subject: 'Reset your YOUNGO Hub password',
              text: `Reset your password: ${origin}/reset-password?token=${rawToken}\n\nThis link expires in 1 hour.`,
            })
            req.payload.logger.info({ event: 'password_reset_email_accepted' })
          } catch (error) {
            req.payload.logger.warn({ event: 'password_reset_email_failed' })
          }
        } else {
          req.payload.logger.info({
            event: 'password_reset_requested',
            deliveryConfigured: false,
          })
        }
      }
      return noStore(json({ ok: true, message: GENERIC_FORGOT }))
    }),
  },
  {
    path: '/auth/reset-password',
    method: 'post',
    handler: endpoint(async (req) => {
      await resetConsumeLimit(req)
      const b = ((await req.json?.()) || {}) as Record<string, any>
      if (b.website) return noStore(json({ ok: true }))
      const token = String(b.token || '').trim()
      const password = String(b.password || '')
      const passwordConfirm = String(b.passwordConfirm || '')
      const fields: Record<string, string> = {}
      if (!token)
        fields.token = 'Reset token is missing. Open the full link from your email or admin.'
      if (password.length < 10) fields.password = 'Password must be at least 10 characters.'
      if (password !== passwordConfirm) fields.passwordConfirm = 'Passwords do not match.'
      if (Object.keys(fields).length) throw fail.validation(fields)

      const tokenHash = sha256Hex(token)
      const { docs } = await req.payload.find({
        collection: 'password-resets' as never,
        where: {
          tokenHash: { equals: tokenHash },
          usedAt: { exists: false },
          expiresAt: { greater_than: new Date().toISOString() },
        },
        limit: 1,
        overrideAccess: true,
      })
      const reset = docs[0] as any
      if (!reset) {
        return json(
          {
            error: {
              code: 'invalid_token',
              message: 'That reset link is invalid or has expired.',
            },
          },
          { status: 400 },
        )
      }
      await req.payload.update({
        collection: 'accounts',
        id: typeof reset.account === 'object' ? reset.account.id : reset.account,
        data: { password, mustChangePassword: false } as any,
        overrideAccess: true,
        req,
      })
      await req.payload.update({
        collection: 'password-resets' as never,
        id: reset.id,
        data: { usedAt: new Date().toISOString() } as never,
        overrideAccess: true,
      })
      return noStore(
        json({
          ok: true,
          message: 'Password updated. You can sign in with your new password.',
        }),
      )
    }),
  },
]
