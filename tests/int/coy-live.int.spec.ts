import type { Payload } from 'payload'
import { randomBytes } from 'node:crypto'
import { describe, it, beforeAll, expect } from 'vitest'

import { parseEmails } from '../../src/endpoints/coy'
import { testPayload } from './provision'
import { api, session } from './helpers'

describe('coy allowlist parsing', () => {
  it('splits, lowercases and de-duplicates addresses', () => {
    expect(parseEmails('A@x.test, a@x.test;\nb@x.test  not-an-email')).toEqual([
      'a@x.test',
      'b@x.test',
    ])
  })
})

describe('coy live operations', () => {
  let payload: Payload
  let slug: string
  let organiser: Awaited<ReturnType<typeof session>>
  let member: Awaited<ReturnType<typeof session>>
  const post = (
    path: string,
    cookie: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) => api(path, { method: 'POST', cookie, body: JSON.stringify(body), headers })

  beforeAll(async () => {
    payload = await testPayload()
    slug = `it-coy-${randomBytes(4).toString('hex')}`
    await payload.create({
      collection: 'content-coys',
      data: { slug, type: 'coy', title: 'IT COY', reviewStatus: 'approved', liveOps: true },
      overrideAccess: true,
    })
    organiser = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'coy', role: 'contact' },
    })
    member = await session({})
  })

  it('keeps organiser tools from ordinary members', async () => {
    const res = await api(`/member/coy/${slug}/participants`, { cookie: member.cookie })
    expect(res.status).toBe(403)
    const notices = await (
      await api(`/member/coy/${slug}/notices`, { cookie: member.cookie })
    ).json()
    expect(notices).toMatchObject({ allowlisted: false, items: [] })
  })

  it('blocks announcements until someone is listed', async () => {
    const res = await post(`/member/coy/${slug}/announce`, organiser.cookie, {
      title: 'Programme update',
      message: 'Doors open at nine.',
      reason: 'Day one logistics',
      channels: ['hub'],
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('empty_allowlist')
  })

  it('adds existing accounts and reports the rest', async () => {
    const missing = `missing-${Date.now()}@test.invalid`
    const res = await post(`/member/coy/${slug}/participants`, organiser.cookie, {
      emails: `${member.account.email}\n${missing}`,
      note: 'Delegation',
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ added: 1, missing: [missing] })
    const again = await post(`/member/coy/${slug}/participants`, organiser.cookie, {
      emails: member.account.email,
    })
    expect(await again.json()).toMatchObject({ added: 0, already: 1 })
  })

  it('posts a notice participants can read, once per campaign', async () => {
    const key = `it-${randomBytes(6).toString('hex')}`
    const body = {
      title: 'Programme update',
      message: 'Doors open at nine.\nBring your badge.',
      reason: 'Day one logistics',
      channels: ['hub'],
    }
    const res = await post(`/member/coy/${slug}/announce`, organiser.cookie, body, {
      'x-idempotency-key': key,
    })
    expect(res.status).toBe(202)
    expect((await res.json()).notice.body).toBe('Doors open at nine.\nBring your badge.')

    const replay = await post(`/member/coy/${slug}/announce`, organiser.cookie, body, {
      'x-idempotency-key': key,
    })
    expect((await replay.json()).replay).toBe(true)

    const notices = await (
      await api(`/member/coy/${slug}/notices`, { cookie: member.cookie })
    ).json()
    expect(notices.allowlisted).toBe(true)
    expect(notices.items).toHaveLength(1)

    const log = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'coy.announce' }, targetId: { equals: key } },
      overrideAccess: true,
    })
    expect(log.docs[0]?.reason).toBe('Day one logistics')
  })

  it('writes nothing when a requested channel is not configured', async () => {
    const before = await payload.count({ collection: 'coy-notices', overrideAccess: true })
    const res = await post(`/member/coy/${slug}/announce`, organiser.cookie, {
      title: 'Venue change',
      message: 'Moved to hall B.',
      reason: 'Venue change notice',
      channels: ['hub', 'email'],
    })
    if (res.status === 503) {
      expect((await res.json()).error.code).toBe('email_not_configured')
      const after = await payload.count({ collection: 'coy-notices', overrideAccess: true })
      expect(after.totalDocs).toBe(before.totalDocs)
    } else {
      expect(res.status).toBe(202)
    }
  })

  it('removes a participant once', async () => {
    const path = `/member/coy/${slug}/participants/${member.account.id}`
    expect((await api(path, { method: 'DELETE', cookie: organiser.cookie })).status).toBe(200)
    expect((await api(path, { method: 'DELETE', cookie: organiser.cookie })).status).toBe(404)
  })

  it('ignores conferences without live operations', async () => {
    const res = await api('/member/coy/no-such-coy/notices', { cookie: member.cookie })
    expect(res.status).toBe(404)
  })
})
