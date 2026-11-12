import type { Payload } from 'payload'
import crypto from 'node:crypto'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

import type { Doc } from '../../src/lib/domain'
import { testPayload } from './provision'
import { api, session } from './helpers'

type Session = Awaited<ReturnType<typeof session>>

const PLATFORM = { role: 'focal_point', scopeType: 'platform', scopeId: 'platform' }

describe('intelligence api', () => {
  let payload: Payload
  let member: Session
  let author: Session
  let applier: Session
  let controller: Session
  let contactId: number | string
  // letters + digits so the query tokeniser keeps it whole
  const token = `zq${crypto.randomBytes(6).toString('hex')}`

  const ask = (who: Session, body: Doc) =>
    api('/intelligence/query', { method: 'POST', cookie: who.cookie, body: JSON.stringify(body) })
  const propose = (who: Session, body: Doc, key?: string) =>
    api('/intelligence/writebacks', {
      method: 'POST',
      cookie: who.cookie,
      headers: key ? { 'Idempotency-Key': key } : {},
      body: JSON.stringify({
        action: 'save_research_note',
        title: `Note ${token}`,
        note: 'Evidence summary for review.',
        citations: ['E1'],
        ...body,
      }),
    })
  const reason = 'Sources checked against the record.'
  const act = (who: Session, id: number, step: 'approve' | 'apply', body: Doc = { reason }) =>
    api(`/intelligence/writebacks/${id}/${step}`, {
      method: 'POST',
      cookie: who.cookie,
      body: JSON.stringify(body),
    })

  beforeAll(async () => {
    payload = await testPayload()
    // selections gives a team role without intelligence.contacts.read (membership team has it)
    member = await session({ membershipTrack: 'constituency_work', teams: ['selection_team'] })
    author = await session({ membershipTrack: 'constituency_work', records: [PLATFORM] })
    applier = await session({ membershipTrack: 'constituency_work', records: [PLATFORM] })
    controller = await session({ membershipTrack: 'constituency_work', teams: ['data_controller'] })
    const contact = await payload.create({
      collection: 'directory-contacts',
      data: { group: 'it', roleTitle: `Liaison ${token}`, personName: `Person ${token}` },
      overrideAccess: true,
    })
    contactId = contact.id
  })

  afterAll(async () => {
    if (contactId)
      await payload.delete({
        collection: 'directory-contacts',
        id: contactId,
        overrideAccess: true,
      })
  })

  it('gives a member no contact evidence and only their own role context', async () => {
    const res = await ask(member, { query: `${token} role scope` })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain('@test.invalid')
    const { evidence } = JSON.parse(text)
    expect(evidence.some((e: Doc) => e.sourceType === 'contact')).toBe(false)

    const own = await payload.find({
      collection: 'authority-records',
      where: { account: { equals: member.account.id } },
      overrideAccess: true,
    })
    const ownTitles = own.docs.map((r: Doc) => `Your role: ${r.role}`)
    const roles = evidence.filter((e: Doc) => e.sourceType === 'authority_record')
    expect(roles.length).toBeGreaterThan(0)
    for (const r of roles) expect(ownTitles).toContain(r.title)
  })

  it('serves contact evidence to a contacts holder and tolerates a junk limit', async () => {
    const res = await ask(author, { query: token, limit: 'lots' })
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain('@test.invalid')
    const { evidence } = JSON.parse(text)
    expect(evidence).toContainEqual(
      expect.objectContaining({ sourceType: 'contact', title: `Person ${token}` }),
    )
  })

  it('rejects missing or malformed citations', async () => {
    for (const citations of [
      undefined,
      [],
      [{ junk: true }],
      [{ title: 'x', url: '//evil.test' }],
      [{ title: 'x', url: '/\\evil.test' }],
    ]) {
      const res = await propose(author, { citations })
      expect(res.status).toBe(400)
      expect((await res.json()).error.fields).toHaveProperty('citations')
    }
  })

  it('returns the same note for a repeated idempotency key, even concurrently', async () => {
    const key = crypto.randomUUID()
    const first = await propose(author, {}, key)
    expect(first.status).toBe(201)
    const again = await propose(author, {}, key)
    expect(again.status).toBe(200)
    expect((await again.json()).item.id).toBe((await first.json()).item.id)

    const raced = await Promise.all([
      propose(author, {}, `${key}-r`),
      propose(author, {}, `${key}-r`),
    ])
    expect(raced.map((r) => r.status).sort()).toEqual([200, 201])
    const [a, b] = await Promise.all(raced.map((r) => r.json()))
    expect(a.item.id).toBe(b.item.id)
  })

  it('enforces independent approval, approval before apply, and one transition each', async () => {
    const created = await propose(author, {
      citations: [{ title: `Source ${token}`, url: '/events/example' }],
    })
    expect(created.status).toBe(201)
    const { item } = await created.json()

    const self = await act(author, item.id, 'approve')
    expect(self.status).toBe(409)
    expect((await self.json()).error.code).toBe('separation_of_duties')

    const early = await act(applier, item.id, 'apply')
    expect(early.status).toBe(409)

    const unexplained = await act(controller, item.id, 'approve', { reason: ' ' })
    expect(unexplained.status).toBe(400)
    expect((await unexplained.json()).error.fields).toHaveProperty('reason')

    const approvals = await Promise.all([
      act(controller, item.id, 'approve'),
      act(applier, item.id, 'approve'),
    ])
    expect(approvals.map((r) => r.status).sort()).toEqual([200, 409])
    const approver = approvals[0].status === 200 ? controller : applier
    const { docs: trail } = await payload.find({
      collection: 'audit-log',
      where: {
        action: { equals: 'intelligence.writeback_approved' },
        targetId: { equals: String(item.id) },
      },
      overrideAccess: true,
    })
    expect(trail.map((e) => e.reason)).toEqual([reason])
    const other = approver === controller ? applier : author

    const applied = await Promise.all([act(other, item.id, 'apply'), act(other, item.id, 'apply')])
    expect(applied.map((r) => r.status).sort()).toEqual([200, 409])

    const list = await api('/intelligence/writebacks', { cookie: author.cookie })
    expect(list.status).toBe(200)
    const text = await list.text()
    // test names embed the email, so look for email fields rather than the address
    expect(text).not.toMatch(/"(email|accountEmail)"/)
    const listed = JSON.parse(text).items.find((n: Doc) => n.id === item.id)
    expect(listed).toMatchObject({ status: 'applied' })
    expect(listed.account).toEqual({ id: author.account.id, name: author.account.name })
  })
})
