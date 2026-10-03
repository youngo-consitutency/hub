import type { Payload } from 'payload'

import { describe, it, beforeAll, expect } from 'vitest'

import { provisionAccount, testPayload, type TestSpec } from './provision'
import { api, session } from './helpers'

describe('payload', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await testPayload()
  })

  it('reads provisioned accounts and content collections', async () => {
    await provisionAccount({})
    const accounts = await payload.find({ collection: 'accounts', limit: 1 })
    expect(accounts.totalDocs).toBeGreaterThan(0)
    await (
      await testPayload()
    ).create({
      collection: 'content-events',
      data: {
        slug: `it-event-${Math.random().toString(36).slice(2, 8)}`,
        title: 'Contract test event',
        type: 'wg_call',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        state: 'published',
      },
      draft: false,
      overrideAccess: true,
    })
    const events = await payload.find({ collection: 'content-events', limit: 1 })
    expect(events.totalDocs).toBeGreaterThan(0)
  })
})

describe('API contract (requires dev server on :3000)', () => {
  let member: { cookie: string; account: any }
  let admin: { cookie: string; account: any }
  let membershipStaff: { cookie: string; account: any }
  let publisher: { cookie: string; account: any }

  beforeAll(async () => {
    member = await session({})
    admin = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'focal_point', scopeType: 'platform', scopeId: 'platform' }],
    })
    membershipStaff = await session({
      membershipTrack: 'constituency_work',
      teams: ['membership_team'],
    })
    publisher = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.publisher', scopeType: 'team', scopeId: 'content_publisher' }],
    })
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
    // The directory only lists verified members with a members-visible
    // profile — provision one explicitly so the shape assertions run.
    const payload = await testPayload()
    await payload.create({
      collection: 'member-profiles',
      data: {
        account: member.account.id,
        displayName: 'Directory Fixture',
        directoryVisibility: 'members',
      } as any,
      overrideAccess: true,
    })
    const res = await api('/member/people', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    const items = body.items ?? body.people ?? body
    expect(items.length).toBeGreaterThan(0)
    const p = items[0]
    expect(p).toHaveProperty('id')
    expect(p).toHaveProperty('displayName')
    expect(p).toHaveProperty('photoUrl')
    expect(p).toHaveProperty('workingGroups')
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
      cookie: membershipStaff.cookie,
      body: JSON.stringify({ state: 'bogus' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation')
  })

  it('unpublishes live content and hides it from public reads', async () => {
    const event = await (
      await testPayload()
    ).create({
      collection: 'content-events',
      data: {
        slug: `it-unpublish-${Math.random().toString(36).slice(2, 8)}`,
        title: 'Unpublish contract event',
        type: 'webinar',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        state: 'published',
      },
      draft: false,
      overrideAccess: true,
    })
    const slug = event.slug
    expect(slug).toBeTruthy()
    const unpub = await api(`/member/content/live/event/${slug}/unpublish`, {
      method: 'POST',
      cookie: publisher.cookie,
      body: JSON.stringify({ reason: 'contract test' }),
    })
    expect(unpub.status).toBe(200)
    expect((await unpub.json()).unpublished).toBe(true)
    const gone = await api(`/events/${slug}`)
    expect(gone.status).toBe(404)
    // restore for other tests
    await api(`/member/content/live/event/${slug}`, {
      method: 'PATCH',
      cookie: publisher.cookie,
      body: JSON.stringify({ payload: { title: event.title } }),
    })
  })

  it('rejects an appeal from a member whose application was not rejected', async () => {
    // Pending members are not rejected — the endpoint must fail with the
    // not_rejected conflict code, not a validation error or a 500.
    const pending = await session({ verified: false })
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
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('not_rejected')
  })
})
