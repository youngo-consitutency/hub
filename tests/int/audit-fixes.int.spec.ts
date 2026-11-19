import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { provisionAccount, testPayload } from './provision'
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
    const before = (await live()).title
    const res = await api(`/member/content/live/announcement/${slug}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      body: json({ mode: 'apply', payload: { title: 'Sneaky' } }),
    })
    expect(res.status).toBe(403)
    expect((await live()).title).toBe(before)
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
    const payload = await testPayload()
    const listed = await provisionAccount({})
    const profile = await payload.create({
      collection: 'member-profiles',
      data: {
        account: listed.account.id,
        displayName: `Directory ${tag}`,
        directoryVisibility: 'members',
      },
      overrideAccess: true,
    })
    // the bug returned the profile's id as the person's id, which only shows if the two differ
    expect(profile.id).not.toBe(listed.account.id)

    const res = await api(`/member/people?search=${encodeURIComponent(`Directory ${tag}`)}`, {
      cookie: member.cookie,
    })
    expect(res.status).toBe(200)
    const { items } = (await res.json()) as { items: { id: number; displayName: string }[] }
    expect(items.map((p) => p.id)).toEqual([listed.account.id])
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

describe('a drafted patch is merged onto the live record when it is published', () => {
  it('keeps a change made to another field in the meantime', async () => {
    const payload = await testPayload()
    const editor = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.editor', scopeType: 'team', scopeId: 'content_editor' }],
    })
    const publisher = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.publisher', scopeType: 'team', scopeId: 'content_publisher' }],
    })
    const slug = `${tag}-patch`
    const created = await payload.create({
      collection: 'content-announcements',
      data: { slug, title: 'Before', body: 'Original body', state: 'published' },
      overrideAccess: true,
    })

    const drafted = await api(`/member/content/live/announcement/${slug}`, {
      method: 'PATCH',
      cookie: editor.cookie,
      body: json({ payload: { title: 'After' } }),
    })
    expect(drafted.status).toBe(201)
    const { item } = await drafted.json()

    // someone else edits the body while the draft waits for review
    await payload.update({
      collection: 'content-announcements',
      id: created.id,
      data: { body: 'Changed meanwhile' },
      overrideAccess: true,
    })

    const step = (path: string, cookie: string, body: object = {}) =>
      api(`/member/content/drafts/${item.id}/${path}`, {
        method: 'POST',
        cookie,
        body: json({ expectedVersion: item.revision, ...body }),
      })
    expect((await step('submit', editor.cookie)).status).toBe(200)
    expect((await step('review', publisher.cookie, { decision: 'approve' })).status).toBe(200)
    expect((await step('publish', publisher.cookie)).status).toBe(200)

    const live = await payload.findByID({
      collection: 'content-announcements',
      id: created.id,
      overrideAccess: true,
    })
    expect(live.title).toBe('After')
    expect(live.body).toBe('Changed meanwhile')
    await payload.delete({
      collection: 'content-announcements',
      id: created.id,
      overrideAccess: true,
    })
  })
})

describe('the membership status route', () => {
  it('refuses to change your own membership and caps the renewal date', async () => {
    const staff = await session({
      membershipTrack: 'constituency_work',
      teams: ['membership_team'],
    })
    const target = await provisionAccount({})
    const patch = (id: number | string, body: object) =>
      api(`/member/team/membership/accounts/${id}/status`, {
        method: 'PATCH',
        cookie: staff.cookie,
        body: json(body),
      })
    expect((await patch(staff.account.id, { status: 'active' })).status).toBe(403)
    const far = new Date(Date.now() + 3 * 365 * 86_400_000).toISOString()
    expect((await patch(target.account.id, { status: 'active', renewalDueAt: far })).status).toBe(
      400,
    )
  })
})
