import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass123!'

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') || ''
  const token = setCookie.match(/payload-token=([^;]+)/)?.[1]
  return { cookie: `payload-token=${token}`, json: await res.json() }
}

const api = (
  path: string,
  { cookie, ...init }: { cookie?: string } & RequestInit = {},
) =>
  fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  })

describe('payload', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('reads seeded accounts and content collections', async () => {
    const accounts = await payload.find({ collection: 'accounts', limit: 1 })
    expect(accounts.totalDocs).toBeGreaterThan(0)
    const events = await payload.find({ collection: 'content-events', limit: 1 })
    expect(events.totalDocs).toBeGreaterThan(0)
  })
})

describe('API contract (requires dev server on :3000)', () => {
  let member: { cookie: string }
  let admin: { cookie: string }

  beforeAll(async () => {
    member = await login('demo-member@youngo.demo')
    admin = await login('demo-admin@youngo.demo')
  })

  it('rejects anonymous member requests', async () => {
    for (const path of ['/member/people', '/member/profile', '/member/access']) {
      const res = await api(path)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('unauthorized')
    }
  })

  it('serves the member directory shape the SPA reads', async () => {
    const res = await api('/member/people', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    const items = body.items ?? body.people ?? body
    expect(Array.isArray(items)).toBe(true)
    if (items.length) {
      const p = items[0]
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('displayName')
      expect(p).toHaveProperty('photoUrl')
      expect(p).toHaveProperty('workingGroups')
    }
  })

  it('retires the legacy member points route with 410', async () => {
    const res = await api('/member/ngo/points', { cookie: member.cookie })
    expect(res.status).toBe(410)
    expect((await res.json()).error.code).toBe('retired')
  })

  it('validates push endpoints against the browser push allowlist', async () => {
    const bad = await api('/push/subscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://attacker.example.com/steal',
          keys: { p256dh: 'x', auth: 'y' },
        },
      }),
    })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.code).toBe('invalid_push_endpoint')
  })

  it('upserts a push subscription idempotently', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/it-${Date.now()}`
    const body = {
      subscription: { endpoint, keys: { p256dh: 'k', auth: 'a' } },
    }
    const first = await api('/push/subscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify(body),
    })
    const second = await api('/push/subscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify(body),
    })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const a = await first.json()
    const b = await second.json()
    expect(a.subscription.id).toBe(b.subscription.id)
    await api('/push/unsubscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ endpoint }),
    })
  })

  it('scopes admin broadcast endpoints to capable staff', async () => {
    const res = await api('/member/admin/notifications/outbox', {
      cookie: member.cookie,
    })
    expect(res.status).toBe(403)
    const adminRes = await api('/member/admin/notifications/outbox', {
      cookie: admin.cookie,
    })
    expect(adminRes.status).toBe(200)
    expect(Array.isArray((await adminRes.json()).items)).toBe(true)
  })

  it('renders an announcement email preview with the legacy shape', async () => {
    const res = await api('/member/admin/notifications/preview', {
      method: 'POST',
      cookie: admin.cookie,
      body: JSON.stringify({
        title: 'Test',
        message: 'Hello members',
        reason: 'contract test reason',
        scope: { type: 'all_active' },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subject).toBe('Test')
    expect(body.text).toContain('Hello members')
    expect(typeof body.html).toBe('string')
  })

  it('rejects invalid opportunity trust states', async () => {
    const res = await api('/member/opportunities/trust/11', {
      method: 'POST',
      cookie: admin.cookie,
      body: JSON.stringify({ state: 'bogus' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation')
  })

  it('unpublishes live content and hides it from public reads', async () => {
    const events = await (await api('/events')).json()
    const list = Array.isArray(events) ? events : events.items || []
    const slug = list[0]?.slug
    expect(slug).toBeTruthy()
    const unpub = await api(`/member/content/live/event/${slug}/unpublish`, {
      method: 'POST',
      cookie: admin.cookie,
      body: JSON.stringify({ reason: 'contract test' }),
    })
    expect(unpub.status).toBe(200)
    expect((await unpub.json()).unpublished).toBe(true)
    const gone = await api(`/events/${slug}`)
    expect(gone.status).toBe(404)
    // restore for other tests
    await api(`/member/content/live/event/${slug}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: JSON.stringify({ payload: { title: list[0].title } }),
    })
  })

  it('rejects a second open membership appeal', async () => {
    // demo-pending is unverified; appeal path requires rejected membership.
    const pending = await login('demo-pending@youngo.demo')
    const res = await api('/member/membership/appeal', {
      method: 'POST',
      cookie: pending.cookie,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Identity-Kind': 'passport',
        'X-Appeal-Statement': encodeURIComponent('contract test appeal'),
      },
      body: Buffer.from('fake-proof'),
    })
    // pending members aren't rejected → expect conflict/validation, not 500
    expect([400, 403, 409]).toContain(res.status)
  })
})
