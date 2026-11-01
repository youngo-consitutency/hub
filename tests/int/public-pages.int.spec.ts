import type { Payload } from 'payload'
import { describe, it, beforeAll, expect } from 'vitest'

import { baselinePage, validatePublicPage } from '../../src/shared/publicPages'
import { testPayload } from './provision'
import { api, session } from './helpers'

const section = (id: string) => ({ id, title: `Section ${id}`, body: 'Body text long enough.' })
const page = (overrides: object = {}) => ({
  slug: 'faq',
  title: 'Frequently asked questions',
  intro: 'What newcomers usually want to know.',
  sections: [section('a'), section('b')],
  baseRevisionId: null,
  basePublicationStatus: 'baseline',
  ...overrides,
})

describe('public page contract', () => {
  it('accepts a page and rejects extra fields, duplicates and unsafe links', () => {
    expect(validatePublicPage(page()).ok).toBe(true)
    expect(validatePublicPage(page({ createdBy: 1 })).errors.payload).toBeTruthy()
    expect(validatePublicPage(page({ sections: [section('a'), section('a')] })).ok).toBe(false)
    const bad = { ...section('a'), linkLabel: 'x', linkUrl: 'javascript:alert(1)' }
    expect(validatePublicPage(page({ sections: [bad] })).ok).toBe(false)
    expect(validatePublicPage(page({ baseRevisionId: 3 })).errors.baseRevisionId).toBeTruthy()
  })

  it('derives the baseline from the site document', () => {
    const doc = baselinePage('contact', {
      contact: {
        title: 'Contact',
        lead: 'Pick a route.',
        routes: [{ title: 'Joining YOUNGO', body: 'Text', cta: { label: 'Join', href: '/join' } }],
      },
    })
    expect(doc.sections[0]).toEqual({
      id: 'joining-youngo',
      title: 'Joining YOUNGO',
      body: 'Text',
      linkLabel: 'Join',
      linkUrl: '/join',
    })
  })
})

describe('public page workflow', () => {
  let payload: Payload
  let editor: Awaited<ReturnType<typeof session>>
  let publisher: Awaited<ReturnType<typeof session>>
  const post = (path: string, who: { cookie: string }, body: object = {}) =>
    api(path, { method: 'POST', cookie: who.cookie, body: JSON.stringify(body) })
  const live = async () => (await api('/pages/faq')).json()

  beforeAll(async () => {
    payload = await testPayload()
    editor = await session({ membershipTrack: 'constituency_work', teams: ['content_editor'] })
    publisher = await session({
      membershipTrack: 'constituency_work',
      teams: ['content_publisher'],
    })
  })

  async function approvedDraft(base: { revisionId: number | null; state: string }, title: string) {
    const res = await post('/member/content/drafts', editor, {
      contentType: 'page',
      payload: page({ title, baseRevisionId: base.revisionId, basePublicationStatus: base.state }),
    })
    expect(res.status).toBe(201)
    const { item } = await res.json()
    expect((await post(`/member/content/drafts/${item.id}/submit`, editor)).status).toBe(400)
    expect(
      (
        await post(`/member/content/drafts/${item.id}/submit`, editor, {
          expectedVersion: item.revision,
        })
      ).status,
    ).toBe(200)
    const review = { decision: 'approve', expectedVersion: item.revision + 1 }
    expect((await post(`/member/content/drafts/${item.id}/review`, editor, review)).status).toBe(
      403,
    )
    const stale = { ...review, expectedVersion: item.revision }
    expect((await post(`/member/content/drafts/${item.id}/review`, publisher, stale)).status).toBe(
      409,
    )
    expect((await post(`/member/content/drafts/${item.id}/review`, publisher, review)).status).toBe(
      200,
    )
    return { id: item.id as number, version: item.revision + 2 }
  }

  it('publishes a reviewed draft, refuses a stale one, and withdraws with a reason', async () => {
    const before = await live()
    const first = await approvedDraft(before, 'FAQ — reviewed')
    const second = await approvedDraft(before, 'FAQ — written against the same base')

    const publish = (draft: { id: number; version: number }, who = publisher) =>
      post(`/member/content/drafts/${draft.id}/publish`, who, { expectedVersion: draft.version })
    expect((await publish(first, editor)).status).toBe(403)
    expect((await publish(first)).status).toBe(200)

    const res = await api('/pages/faq')
    expect(res.headers.get('cache-control')).toContain('no-store')
    const after = await res.json()
    expect(after).toMatchObject({ state: 'published', revisionId: first.id })
    expect(after.document.title).toBe('FAQ — reviewed')
    expect(Object.keys(after).sort()).toEqual(['document', 'publishedAt', 'revisionId', 'state'])
    expect(JSON.stringify(after)).not.toMatch(/createdBy|creatorEmail|baseRevisionId/)

    expect((await publish(first)).status).toBe(409)
    const stale = await publish(second)
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.code).toBe('stale_target')

    const noReason = await post('/member/content/pages/faq/unpublish', publisher, {
      revisionId: first.id,
    })
    expect(noReason.status).toBe(400)
    const withdrawn = await post('/member/content/pages/faq/unpublish', publisher, {
      revisionId: first.id,
      reason: 'Out of date after the reform vote',
    })
    expect(withdrawn.status).toBe(200)
    expect(await live()).toMatchObject({ state: 'unpublished', document: null })

    const log = await payload.find({
      collection: 'audit-log',
      where: { targetType: { equals: 'page' }, targetId: { equals: 'faq' } },
      sort: '-createdAt',
      limit: 2,
      overrideAccess: true,
    })
    expect(log.docs.map((d) => d.action)).toEqual(['content.unpublished', 'content.published'])
  })
})
