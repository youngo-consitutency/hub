import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

const tag = `fix-${Math.random().toString(36).slice(2, 8)}`
const json = (body: unknown) => JSON.stringify(body)

describe('content update goes through review by default', () => {
  let payload: Payload
  let editor: Awaited<ReturnType<typeof session>>
  let publisher: Awaited<ReturnType<typeof session>>
  const slug = `${tag}-announcement`

  beforeAll(async () => {
    payload = await testPayload()
    editor = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.editor', scopeType: 'team', scopeId: 'content_editor' }],
    })
    publisher = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.publisher', scopeType: 'team', scopeId: 'content_publisher' }],
    })
    await payload.create({
      collection: 'content-announcements',
      data: { slug, title: 'Original', body: 'Keep this body', state: 'published' },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    const { docs } = await payload.find({
      collection: 'content-announcements',
      where: { slug: { equals: slug } },
      overrideAccess: true,
    })
    for (const doc of docs)
      await payload.delete({
        collection: 'content-announcements',
        id: doc.id,
        overrideAccess: true,
      })
  })

  const live = async () =>
    (
      await payload.find({
        collection: 'content-announcements',
        where: { slug: { equals: slug } },
        overrideAccess: true,
      })
    ).docs[0]

  it('creates a draft and leaves the live record alone', async () => {
    const res = await api(`/member/content/live/announcement/${slug}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      body: json({ payload: { title: 'Edited' } }),
    })
    expect(res.status).toBe(201)
    expect((await live()).title).toBe('Original')
  })

  it('applies only the fields sent when a publisher asks to apply', async () => {
    const res = await api(`/member/content/live/announcement/${slug}`, {
      method: 'PATCH',
      cookie: publisher.cookie,
      body: json({ mode: 'apply', payload: { title: 'Edited' } }),
    })
    expect(res.status).toBe(200)
    const doc = await live()
    expect(doc.title).toBe('Edited')
    expect(doc.body).toBe('Keep this body')
  })

  it('refuses apply-now without publish rights', async () => {
    const res = await api(`/member/content/live/announcement/${slug}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      body: json({ mode: 'apply', payload: { title: 'Sneaky' } }),
    })
    expect(res.status).toBe(403)
    expect((await live()).title).toBe('Edited')
  })
})

describe('drafting links stay members-only', () => {
  let payload: Payload
  let member: Awaited<ReturnType<typeof session>>
  const slug = `${tag}-submission`

  beforeAll(async () => {
    payload = await testPayload()
    member = await session({})
    await payload.create({
      collection: 'content-submissions',
      data: { slug, title: 'Fix test', status: 'open', draftUrl: 'https://docs.example.org/draft' },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    const { docs } = await payload.find({
      collection: 'content-submissions',
      where: { slug: { equals: slug } },
      overrideAccess: true,
    })
    for (const doc of docs)
      await payload.delete({ collection: 'content-submissions', id: doc.id, overrideAccess: true })
  })

  const find = (items: { slug: string; draftUrl?: string }[]) => items.find((s) => s.slug === slug)

  it('hides draftUrl from anonymous readers', async () => {
    const list = await (await api('/submissions?state=open')).json()
    expect(find(list.items)).toBeDefined()
    expect(find(list.items)).not.toHaveProperty('draftUrl')
    const one = await (await api(`/submissions/${slug}`)).json()
    expect(one).not.toHaveProperty('draftUrl')
  })

  it('still shows it to verified members', async () => {
    const list = await (await api('/submissions?state=open', { cookie: member.cookie })).json()
    expect(find(list.items)?.draftUrl).toBe('https://docs.example.org/draft')
  })
})

describe('officers cannot grant themselves mandates', () => {
  it('refuses a team role for the caller', async () => {
    const operator = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'gct.internal', scopeType: 'team', scopeId: 'gct' }],
    })
    const res = await api(`/member/admin/accounts/${operator.account.id}/team-role`, {
      method: 'POST',
      cookie: operator.cookie,
      body: json({
        teamRole: 'content_publisher',
        enabled: true,
        reason: 'Granting myself publishing rights',
      }),
    })
    expect(res.status).toBe(403)
  })
})

describe('member directory search', () => {
  it('searches and filters by tag without a server error', async () => {
    const member = await session({})
    for (const query of ['search=climate', 'tag=climate']) {
      const res = await api(`/member/people?${query}`, { cookie: member.cookie })
      expect(res.status, query).toBe(200)
    }
  })

  it('returns account ids, not profile ids', async () => {
    const member = await session({})
    const res = await api('/member/people?pageSize=50', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const { items } = await res.json()
    const ids = items.map((p: { accountId?: number; id?: number }) => p.accountId ?? p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('email links need a confirming click', () => {
  it('opening an unsubscribe link changes nothing; the POST does', async () => {
    const payload = await testPayload()
    const member = await session({})
    const { createUnsubscribeToken } = await import('../../src/lib/notifications')
    const token = encodeURIComponent(createUnsubscribeToken(member.account.id, 'group_mail'))
    const prefs = async () =>
      (
        await payload.find({
          collection: 'notification-prefs',
          where: { account: { equals: member.account.id } },
          overrideAccess: true,
        })
      ).docs[0]

    const preview = await api(`/notifications/unsubscribe?token=${token}`)
    expect(preview.status).toBe(200)
    expect(await preview.text()).toContain('<form method="post"')
    expect(await prefs()).toBeUndefined()

    const done = await api(`/notifications/unsubscribe?token=${token}`, { method: 'POST' })
    expect(done.status).toBe(200)
    expect(((await prefs())?.email as Record<string, boolean>).group_mail).toBe(false)
  })

  it('rejects a forged unsubscribe token on both verbs', async () => {
    for (const method of ['GET', 'POST']) {
      const res = await api('/notifications/unsubscribe?token=forged.token', { method })
      expect(res.status, method).toBe(400)
    }
  })
})
