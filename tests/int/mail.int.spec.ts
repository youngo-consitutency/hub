import type { Payload } from 'payload'
import { randomBytes } from 'node:crypto'
import { describe, it, beforeAll, expect } from 'vitest'

import { mailReach } from '../../src/shared/mailReach'
import { emailPlainText, sanitizeEmailHtml } from '../../src/shared/emailHtml'
import { getPgPool } from '../../src/lib/pg'
import { testPayload } from './provision'
import { api, session } from './helpers'

describe('mail reach', () => {
  it('gives contact points their own groups only', () => {
    expect(mailReach({ capabilities: ['wg.manage:ace', 'council.vote'] })).toEqual({
      canDraft: true,
      everyone: false,
      wgSlugs: ['ace'],
    })
  })

  it('gives focal points, comms and OT liaisons the constituency', () => {
    for (const cap of ['notifications.send', 'wg.manage_all', 'ot.coordinate:finance']) {
      expect(mailReach({ capabilities: [cap] }).everyone).toBe(true)
    }
    expect(mailReach({ capabilities: ['hub.read'] }).canDraft).toBe(false)
  })
})

describe('email html', () => {
  it('wraps loose editor text in a paragraph', () => {
    expect(sanitizeEmailHtml('Loose text<p></p>')).toBe('<p>Loose text</p><p></p>')
  })

  it('closes unfinished lists and paragraphs', () => {
    expect(sanitizeEmailHtml('<ul><li>one<li>two</ul><p>a<p>b')).toBe(
      '<ul><li>one</li><li>two</li></ul><p>a</p><p>b</p>',
    )
  })

  it('keeps formatting and safe links, drops scripts and unsafe links', () => {
    const html = sanitizeEmailHtml(
      '<p onclick="x()">Hi <b>all</b></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a><a href="https://youngo.test">ok</a>',
    )
    expect(html).toBe(
      '<p>Hi <strong>all</strong></p><p>bad<a href="https://youngo.test/">ok</a></p>',
    )
    expect(emailPlainText(html)).toContain('Hi all')
  })
})

describe('mail desk api', () => {
  let payload: Payload
  let wg: string
  let contact: Awaited<ReturnType<typeof session>>
  let member: Awaited<ReturnType<typeof session>>
  const draftBody = (scope: object) => ({
    title: 'Working group call moved',
    message: '<p>The call moves to Thursday at 14:00 UTC.</p>',
    scope,
  })

  beforeAll(async () => {
    payload = await testPayload()
    wg = `it-wg-${randomBytes(4).toString('hex')}`
    await payload.create({
      collection: 'working-groups',
      data: { slug: wg, name: 'IT group' },
      overrideAccess: true,
    })
    contact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: wg, role: 'contact' },
    })
    member = await session({})
    await payload.create({
      collection: 'wg-progress',
      data: { account: member.account.id, wgSlug: wg, status: 'active' },
      overrideAccess: true,
    })
  })

  it('is closed to members without a mandate', async () => {
    expect((await api('/member/mail/drafts', { cookie: member.cookie })).status).toBe(403)
  })

  it('keeps contact points inside their own groups', async () => {
    const post = (body: object) =>
      api('/member/mail/drafts', {
        method: 'POST',
        cookie: contact.cookie,
        body: JSON.stringify(body),
      })
    expect((await post(draftBody({ type: 'constituency' }))).status).toBe(403)
    expect((await post(draftBody({ type: 'working_group', wgSlug: 'ace' }))).status).toBe(403)
    const outsider = await session({})
    const res = await post(draftBody({ type: 'individual', accountIds: [outsider.account.id] }))
    expect(res.status).toBe(403)
  })

  it('finds people by name without exposing email', async () => {
    const res = await api(`/member/mail/people?q=${encodeURIComponent('IT ')}`, {
      cookie: contact.cookie,
    })
    const { people } = await res.json()
    expect(people.some((p: { id: number }) => p.id === member.account.id)).toBe(true)
    // test accounts are named after their address, so check the shape, not the text
    for (const person of people) expect(Object.keys(person).sort()).toEqual(['id', 'name'])
  })

  it('saves a draft without sending, then queues it to the group', async () => {
    const created = await api('/member/mail/drafts', {
      method: 'POST',
      cookie: contact.cookie,
      body: JSON.stringify(draftBody({ type: 'working_group', wgSlug: wg })),
    })
    expect(created.status).toBe(201)
    const { draft } = await created.json()
    expect(draft.status).toBe('draft')
    const outbox = async () =>
      (
        await getPgPool()!.query(
          `SELECT count(*)::int AS n FROM notification_outbox WHERE source_type='mail_draft' AND source_id=$1`,
          [String(draft.id)],
        )
      ).rows[0].n
    expect(await outbox()).toBe(0)

    const other = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: wg, role: 'contact' },
    })
    const foreign = await api(`/member/mail/drafts/${draft.id}`, {
      method: 'PATCH',
      cookie: other.cookie,
      body: JSON.stringify(draftBody({ type: 'working_group', wgSlug: wg })),
    })
    expect(foreign.status).toBe(404)

    const count = await api('/member/mail/preview', {
      method: 'POST',
      cookie: contact.cookie,
      body: JSON.stringify({ scope: { type: 'working_group', wgSlug: wg } }),
    })
    // contact points are active members of their group too
    const members = await payload.count({
      collection: 'wg-progress',
      where: { wgSlug: { equals: wg }, status: { equals: 'active' } },
      overrideAccess: true,
    })
    const { count: eligible } = await count.json()
    expect(eligible).toBe(members.totalDocs)

    const queued = await api(`/member/mail/drafts/${draft.id}/queue`, {
      method: 'POST',
      cookie: contact.cookie,
    })
    expect(queued.status).toBe(202)
    expect((await queued.json()).queued).toBe(eligible)
    expect(await outbox()).toBe(eligible)

    const log = await payload.find({
      collection: 'audit-log',
      where: { action: { equals: 'mail.draft_queued' }, targetId: { equals: String(draft.id) } },
      overrideAccess: true,
    })
    expect(log.totalDocs).toBe(1)

    const again = await api(`/member/mail/drafts/${draft.id}/discard`, {
      method: 'POST',
      cookie: contact.cookie,
    })
    expect(again.status).toBe(404)
  })
})
