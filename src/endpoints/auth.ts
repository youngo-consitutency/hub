import { logoutOperation, type Endpoint, type PayloadRequest } from 'payload'
import { after } from 'next/server'
import { endpoint, fail, json, readBody } from '../lib/respond'
import { validateRegistration } from '../lib/registration'
import { validateGuardianEnquiry } from '../shared/guardianEnquiry'
import { createGuardianEnquiry } from '../lib/guardianEnquiries'
import {
  accountView,
  requireAccount,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from '../lib/accounts'
import { burnPasswordHash, verifyLegacyPassword } from '../lib/password'
import { confirmPage, htmlResponse, resultPage } from '../lib/htmlPage'
import { hubUrl } from '../lib/hubUrl'
import {
  isPendingRegistration,
  savePendingRegistration,
  takePendingRegistration,
} from '../lib/pendingRegistration'
import { rateLimit } from '../lib/rateLimit'
import { isUniqueViolation, requirePgPool } from '../lib/pg'
import { sendEmail, emailConfigured } from '../lib/email'
import { randomBytes } from 'node:crypto'
import { appBaseUrl } from '../lib/env'
import { sha256Hex } from '../lib/crypto'
import type { Doc } from '../lib/domain'
import type { Account } from '../payload-types'

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
  key: (req) =>
    `email:${String((req as Doc)._bodyEmail || '')
      .trim()
      .toLowerCase()}`,
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
const confirmRegistrationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  scope: 'confirm-registration',
})
const changePasswordLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  scope: 'change-password',
})

const GENERIC_FORGOT =
  'If an account exists for that email, a password reset link has been issued. Check your inbox — or ask a platform officer if email delivery is not configured yet.'

const noStore = (res: Response) => {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

type PayloadSession = { user?: Account; token?: string; exp?: number }
type Login = { user: Account; token: string; exp: number }

async function loginResponse(
  req: PayloadRequest,
  email: string,
  password: string,
): Promise<Login | null> {
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
  const doc = found.docs[0] as Doc

  // an unknown address must cost the same time as a known one, or timing reveals who has an account
  if (!doc) {
    await burnPasswordHash(payload, password)
    return null
  }

  let logged: PayloadSession | null
  try {
    logged = await payload.login({
      collection: 'accounts',
      data: { email, password },
      req,
    })
  } catch {
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
        },
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

  // a session without a token or expiry cannot be issued, so it fails closed
  if (!logged?.user || !logged.token || logged.exp === undefined) return null
  return { user: logged.user, token: logged.token, exp: logged.exp }
}

type RegistrationData = NonNullable<Awaited<ReturnType<typeof validateRegistration>>['data']>

const pendingReply = () => noStore(json({ ok: true, pendingVerification: true }, { status: 202 }))

const invalidSignupPage = resultPage(
  'Link not valid',
  'This sign-up link is invalid or has expired. Please fill in the sign-up form again.',
)

// a failed send must not reveal anything to the person who submitted the form
async function sendQuietly(req: PayloadRequest, message: Parameters<typeof sendEmail>[0]) {
  try {
    await sendEmail(message)
  } catch {
    req.payload.logger.warn({ event: 'signup_email_failed' })
  }
}

// the person confirmed their address, so it is marked verified from the start
async function createRegisteredAccount(req: PayloadRequest, data: RegistrationData) {
  return req.payload.create({
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
      entityType: data.entityType as Account['entityType'],
      membershipTrack: data.membershipTrack as Account['membershipTrack'],
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
      memberStatus: data.memberStatus as Account['memberStatus'],
      hubAccessStatus: 'pending_course',
      membershipStatus: 'registered',
      constituencyWorkStatus: data.constituencyWorkStatus as Account['constituencyWorkStatus'],
      role: 'member',
      wgInterests: data.wgInterests,
      emailVerifiedAt: new Date().toISOString(),
      mustChangePassword: false,
    },
    overrideAccess: true,
    req,
  })
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
    // Under-18 applicants cannot register; a parent or legal guardian asks the
    // Membership Team to make contact instead. Logs carry no personal data.
    path: '/auth/guardian-enquiry',
    method: 'post',
    handler: endpoint(async (req) => {
      await registerLimit(req)
      const result = validateGuardianEnquiry(await readBody(req))
      if (result.honeypot) {
        req.payload.logger.info({ event: 'hub_guardian_enquiry_rejected_as_automated' })
        return noStore(json({ ok: true }, { status: 201 }))
      }
      if (result.fields) throw fail.validation(result.fields)
      // a request that is neither a honeypot nor invalid always carries data
      if (!result.data) throw fail.validation({ request: 'The request could not be read.' })
      await createGuardianEnquiry(req, result.data)
      req.payload.logger.info({ event: 'hub_guardian_enquiry_received' })
      return noStore(
        json(
          { ok: true, message: 'Request received. The Membership Team will contact the guardian.' },
          { status: 201 },
        ),
      )
    }),
  },
  {
    path: '/auth/register',
    method: 'post',
    handler: endpoint(async (req) => {
      await registerLimit(req)
      const b = await readBody(req)
      const result = await validateRegistration(req, b)
      if (result.honeypot) {
        req.payload.logger.info({ event: 'hub_register_rejected_as_automated' })
        return pendingReply()
      }
      if (result.fields) {
        throw fail.validation(result.fields)
      }
      const data = result.data!

      // Production must be able to send the confirmation, or nobody could finish signing up.
      if (process.env.VERCEL_ENV === 'production' && !emailConfigured())
        throw fail.unavailable('Sign-up is temporarily unavailable.')

      const existing = await req.payload.find({
        collection: 'accounts',
        where: { email: { equals: data.email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      // The reply never depends on whether the address is registered: only its owner learns that,
      // by email. Sending happens after the response so the two cases take the same time.
      const origin = appBaseUrl()
      if (existing.docs.length) {
        after(() =>
          sendQuietly(req, {
            to: data.email,
            subject: 'Your YOUNGO Hub account',
            text: `Someone used this address to join YOUNGO Hub, but you already have an account.\n\nSign in: ${origin}/signin\nForgot your password: ${origin}/reset-password\n\nIf this was not you, you can ignore this message; nothing has changed.`,
          }),
        )
      } else {
        const token = await savePendingRegistration(data.email, data)
        after(() =>
          sendQuietly(req, {
            to: data.email,
            subject: 'Confirm your email to join YOUNGO Hub',
            text: `Confirm your email address to finish creating your YOUNGO Hub account:\n\n${origin}/api/auth/confirm-registration?token=${token}\n\nThis link works for 24 hours. If you did not ask to join, ignore this message and nothing will be created.`,
          }),
        )
      }
      return pendingReply()
    }),
  },
  {
    // The link in the sign-up email. Opening it changes nothing (mail scanners open links); the
    // account is created by the button on this page.
    path: '/auth/confirm-registration',
    method: 'get',
    handler: async (req) => {
      const token = String((req as Doc).query?.token || '')
      if (!token || !(await isPendingRegistration(token)))
        return htmlResponse(invalidSignupPage, 400)
      return htmlResponse(
        confirmPage(
          'Confirm your email address',
          'One more step: confirm that this is your email address to create your YOUNGO Hub account.',
          `/api/auth/confirm-registration?token=${encodeURIComponent(token)}`,
          'Create my account',
        ),
      )
    },
  },
  {
    path: '/auth/confirm-registration',
    method: 'post',
    handler: async (req) => {
      await confirmRegistrationLimit(req)
      const token = String((req as Doc).query?.token || '')
      const data = token ? await takePendingRegistration<RegistrationData>(token) : null
      if (!data) return htmlResponse(invalidSignupPage, 400)
      try {
        await createRegisteredAccount(req, data)
      } catch (error) {
        // someone registered the address in the meantime
        if (isUniqueViolation(error, 'accounts', 'accounts'))
          return htmlResponse(
            resultPage(
              'You already have an account',
              'This address is already registered. You can sign in, or reset your password if you forgot it.',
            ),
            409,
          )
        throw error
      }
      const logged = await loginResponse(req, data.email, data.password)
      if (!logged) return htmlResponse(invalidSignupPage, 400)
      const expiresAt = new Date(logged.exp * 1000)
      req.payload.logger.info({ event: 'hub_register_confirmed', track: data.membershipTrack })
      return new Response(null, {
        status: 303,
        headers: {
          Location: `${appBaseUrl()}${hubUrl('/')}`,
          'Set-Cookie': sessionCookieHeader(logged.token, expiresAt),
          'Cache-Control': 'no-store',
        },
      })
    },
  },
  {
    path: '/auth/login',
    method: 'post',
    handler: endpoint(async (req) => {
      const b = await readBody(req)
      if (b.website) return noStore(json({ ok: true }))
      const email = String(b.email || '').trim()
      const password = String(b.password || '')
      ;(req as Doc)._bodyEmail = email
      await loginLimit(req)
      await loginAccountLimit(req)

      const fields: Record<string, string> = {}
      if (!email) fields.email = 'Please enter your email.'
      if (!password) fields.password = 'Please enter your password.'
      if (Object.keys(fields).length) throw fail.validation(fields)

      let logged: Login | null = null
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
          data: { lastLoginAt: new Date().toISOString() },
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
      // revoke the session server-side, not just the cookie: a copied token must stop working too
      if (req.user) {
        try {
          await logoutOperation({ collection: req.payload.collections.accounts, req })
        } catch {
          // the cookie below must be cleared even if the server-side revocation failed
          req.payload.logger.warn({ event: 'logout_revocation_failed' })
        }
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
      const b = await readBody(req)
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
        data: { password, mustChangePassword: false },
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
      const b = await readBody(req)
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
      const account = docs[0] as Doc
      // the token write and the email happen after the reply, so an unknown address takes as long
      if (account)
        after(async () => {
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
            } catch {
              req.payload.logger.warn({ event: 'password_reset_email_failed' })
            }
          } else {
            req.payload.logger.info({
              event: 'password_reset_requested',
              deliveryConfigured: false,
            })
          }
        })
      return noStore(json({ ok: true, message: GENERIC_FORGOT }))
    }),
  },
  {
    path: '/auth/reset-password',
    method: 'post',
    handler: endpoint(async (req) => {
      await resetConsumeLimit(req)
      const b = await readBody(req)
      if (b.website) return noStore(json({ ok: true }))
      const token = String(b.token || '').trim()
      const password = String(b.password || '')
      const passwordConfirm = String(b.passwordConfirm || '')
      const fields: Record<string, string> = {}
      if (!token)
        fields.token =
          'Reset token is missing. Open the full link from your email or a platform officer.'
      if (password.length < 10) fields.password = 'Password must be at least 10 characters.'
      if (password !== passwordConfirm) fields.passwordConfirm = 'Passwords do not match.'
      if (Object.keys(fields).length) throw fail.validation(fields)

      // Claim the token with one conditional UPDATE, so two concurrent requests cannot both use it.
      const { rows } = await requirePgPool().query<{ account_id: number }>(
        `UPDATE password_resets SET used_at = now()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
         RETURNING account_id`,
        [sha256Hex(token)],
      )
      const claimed = rows[0]
      if (!claimed) {
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
      try {
        await req.payload.update({
          collection: 'accounts',
          id: claimed.account_id,
          data: { password, mustChangePassword: false },
          overrideAccess: true,
          req,
        })
      } catch (error) {
        // the password did not change, so the link must stay usable for a retry
        await requirePgPool().query(
          'UPDATE password_resets SET used_at = NULL WHERE token_hash = $1',
          [sha256Hex(token)],
        )
        throw error
      }
      return noStore(
        json({
          ok: true,
          message: 'Password updated. You can sign in with your new password.',
        }),
      )
    }),
  },
]
