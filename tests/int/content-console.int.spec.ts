import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

// the /cms console edits content-documents for content publishers only; nothing else
// opens, and creating or deleting stays with provisioning scripts
const tag = `console-${Math.random().toString(36).slice(2, 8)}`

describe('content console', () => {
  let payload: Payload
  let docId: number | string
  let member: Awaited<ReturnType<typeof session>>
  let publisher: Awaited<ReturnType<typeof session>>

  beforeAll(async () => {
    payload = await testPayload()
    member = await session({})
    publisher = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'content.publisher', scopeType: 'team', scopeId: 'content_publisher' }],
    })
    const doc = await payload.create({
      collection: 'content-documents',
      data: { slug: tag, title: tag, body: { note: 'before' } },
      overrideAccess: true,
    })
    docId = doc.id
  })

  afterAll(async () => {
    await payload
      .delete({ collection: 'content-documents', id: docId, overrideAccess: true })
      .catch(() => {})
  })

  const patch = (cookie: string | undefined, title: string) =>
    api(`/content-documents/${docId}`, {
      method: 'PATCH',
      cookie,
      body: JSON.stringify({ title }),
    })

  it('refuses edits from anyone without content.publish', async () => {
    expect((await patch(undefined, 'anon')).status).toBeGreaterThanOrEqual(401)
    expect((await patch(member.cookie, 'member')).status).toBe(403)
    const stored = await payload.findByID({ collection: 'content-documents', id: docId })
    expect(stored.title).toBe(tag)
  })

  it('lets a content publisher edit, and records who did', async () => {
    const res = await patch(publisher.cookie, `${tag}-edited`)
    expect(res.status).toBe(200)
    const trail = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'content_document.update' }, targetId: { equals: tag } },
      overrideAccess: true,
    })
    expect(trail.docs.some((entry) => entry.actorEmail === publisher.email)).toBe(true)
  })

  it('keeps create and delete closed, even to a publisher', async () => {
    const created = await api('/content-documents', {
      method: 'POST',
      cookie: publisher.cookie,
      body: JSON.stringify({ slug: `${tag}-new`, title: 'x', body: {} }),
    })
    expect(created.status).toBe(403)
    const deleted = await api(`/content-documents/${docId}`, {
      method: 'DELETE',
      cookie: publisher.cookie,
    })
    expect(deleted.status).toBe(403)
  })

  it('opens the console only for publishers', async () => {
    const accounts = payload.config.collections.find((c) => c.slug === 'accounts')
    const gate = accounts?.access?.admin
    expect(gate).toBeTypeOf('function')
    const asReq = async (cookie: string) => {
      const { user } = await payload.auth({ headers: new Headers({ cookie }) })
      return { user, payload } as never
    }
    expect(await gate!({ req: await asReq(publisher.cookie) })).toBe(true)
    expect(await gate!({ req: await asReq(member.cookie) })).toBe(false)
  })
})
