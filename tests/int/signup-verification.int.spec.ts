import { readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { api, BASE, login } from './helpers'
import { provisionAccount, testPayload } from './provision'

// Needs the server started with HUB_CAPTURE_EMAIL_DIR set to the same folder: sign-up emails are
// written there instead of being sent, and the confirmation link is read back from them.
const DIR = process.env.HUB_CAPTURE_EMAIL_DIR

interface Captured {
  to: string
  subject: string
  text: string
}

async function emailsTo(address: string, expected = 1, timeoutMs = 8000): Promise<Captured[]> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const names = await readdir(DIR!).catch(() => [] as string[])
    const mails = await Promise.all(
      names.map(async (name) => JSON.parse(await readFile(join(DIR!, name), 'utf8')) as Captured),
    )
    const mine = mails.filter((mail) => mail.to === address)
    if (mine.length >= expected || Date.now() > deadline) return mine
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
}

const tokenFrom = (mail: Captured) =>
  mail.text.match(/confirm-registration\?token=([a-f0-9]+)/)?.[1]

describe.skipIf(!DIR)('sign-up needs a confirmed email address', () => {
  let payload: Payload
  let form: Record<string, unknown>
  const tag = Math.random().toString(36).slice(2, 8)

  // content documents the validator reads; create them only when the database has none
  async function body(slug: string, fallback: Record<string, unknown>) {
    const found = await payload.find({
      collection: 'content-documents',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
      pagination: false,
    })
    if (found.docs[0]) return found.docs[0].body as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- free-form document
    await payload.create({
      collection: 'content-documents',
      data: { slug, title: slug, body: fallback },
      overrideAccess: true,
    })
    return fallback
  }

  beforeAll(async () => {
    payload = await testPayload()
    const notice = await body('privacy-notice', {
      PRIVACY_VERSION: '2024-09',
      CONSENT_STATEMENT: 'I consent.',
    })
    const options = await body('registration-options', {
      regions: ['Global'],
      genders: ['Female'],
      minorityOptions: ['None'],
      ageBands: [{ value: '18_35' }],
      youthAffiliations: [{ value: 'member' }],
      nationalities: ['Testlandian'],
    })
    const adult = (options.ageBands as { value: string }[]).find((a) => a.value !== 'under_18')
    form = {
      entityType: 'individual',
      membershipTrack: 'network',
      membershipPolicyVersion: '2024-09',
      password: 'a-secure-password',
      passwordConfirm: 'a-secure-password',
      firstName: 'New',
      lastName: 'Member',
      phone: '+10000000000',
      gender: options.genders[0],
      ageBand: adult?.value,
      dateOfBirth: '2000-01-01',
      minorityIdentity: 'no',
      region: options.regions[0],
      nationality: options.nationalities[0],
      countryOfResidence: 'Testland',
      memberOfAccreditedNgo: 'no',
      privacyConsent: true,
      privacyNoticeVersion: notice.PRIVACY_VERSION,
      acceptCodeOfConduct: true,
      acceptDataProtection: true,
      acceptPrinciples: true,
      acceptCoiPolicy: true,
    }
  })

  afterAll(async () => {
    await payload.delete({
      collection: 'accounts',
      where: { email: { like: `signup-${tag}` } },
      overrideAccess: true,
    })
    await rm(DIR!, { recursive: true, force: true })
  })

  const register = (email: string) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify({ ...form, email }) })
  const accountFor = async (email: string) =>
    (
      await payload.find({
        collection: 'accounts',
        where: { email: { equals: email } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0]

  it('answers the same way for a new address and a registered one', async () => {
    const fresh = `signup-${tag}-new@example.org`
    const { email: taken } = await provisionAccount({})

    const a = await register(fresh)
    const b = await register(taken)
    expect(a.status).toBe(202)
    expect(b.status).toBe(202)
    expect(await a.json()).toEqual(await b.json())

    // the address owner, and only they, learns the difference
    const [confirm] = await emailsTo(fresh)
    expect(confirm.subject).toMatch(/confirm/i)
    expect(tokenFrom(confirm)).toBeDefined()
    const [notice] = await emailsTo(taken)
    expect(notice.text).toMatch(/already have an account/i)
    expect(tokenFrom(notice)).toBeUndefined()
  })

  it('creates nothing until the link is confirmed, then signs the person in once', async () => {
    const email = `signup-${tag}-flow@example.org`
    await register(email)
    expect(await accountFor(email)).toBeUndefined()

    const [mail] = await emailsTo(email)
    const token = tokenFrom(mail)!

    // opening the link (a mail scanner does this) changes nothing
    const preview = await api(`/auth/confirm-registration?token=${token}`)
    expect(preview.status).toBe(200)
    expect(await preview.text()).toContain('<form method="post"')
    expect(await accountFor(email)).toBeUndefined()

    const done = await api(`/auth/confirm-registration?token=${token}`, {
      method: 'POST',
      redirect: 'manual',
    })
    expect(done.status).toBe(303)
    expect(done.headers.get('set-cookie')).toContain('payload-token=')
    const account = await accountFor(email)
    expect(account?.emailVerifiedAt).toBeTruthy()
    await login(email, 'a-secure-password')

    // the link works once
    const again = await api(`/auth/confirm-registration?token=${token}`, {
      method: 'POST',
      redirect: 'manual',
    })
    expect(again.status).toBe(400)
  })

  it('rejects an unknown or malformed link on both verbs', async () => {
    for (const method of ['GET', 'POST']) {
      const res = await api('/auth/confirm-registration?token=not-a-real-token', { method })
      expect(res.status, method).toBe(400)
    }
    expect((await fetch(`${BASE}/api/auth/confirm-registration`)).status).toBe(400)
  })

  it('does not tell an unknown email from a wrong password at login', async () => {
    const { email } = await provisionAccount({})
    const wrong = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'not-the-password' }),
    })
    const unknown = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: `nobody-${tag}@example.org`, password: 'not-the-password' }),
    })
    expect(wrong.status).toBe(unknown.status)
    expect(await wrong.json()).toEqual(await unknown.json())
  })
})
