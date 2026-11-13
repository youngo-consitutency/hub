import type { AnyValue, Doc } from '../../src/lib/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { testPayload } from './provision'
import { api, session, BASE } from './helpers'

describe('joining an open working group', () => {
  const BODY = `it-join-${Math.random().toString(36).slice(2, 8)}`
  let member: { cookie: string; account: Doc }

  beforeAll(async () => {
    const payload = await testPayload()
    await (payload.db as AnyValue).pool.query(
      `INSERT INTO platform_bodies (id, name, kind) VALUES ($1, $2, 'working_group') ON CONFLICT DO NOTHING`,
      [BODY, `Join test body ${BODY}`],
    )
    member = await session({ membershipTrack: 'constituency_work' })
  })

  it('records an active participation row starting now', async () => {
    const res = await api(`/platform/bodies/${BODY}/join`, {
      method: 'POST',
      cookie: member.cookie,
      body: '{}',
    })
    expect(res.status).toBe(200)

    const payload = await testPayload()
    const { rows } = await (payload.db as AnyValue).pool.query(
      `SELECT kind, role, status, starts_at <= now() AS started FROM authority_records WHERE account_id=$1 AND scope_type='body' AND scope_id=$2`,
      [member.account.id, BODY],
    )
    expect(rows).toEqual([
      { kind: 'participation', role: 'body.member', status: 'active', started: true },
    ])

    // joining twice stays idempotent
    const again = await api(`/platform/bodies/${BODY}/join`, {
      method: 'POST',
      cookie: member.cookie,
      body: '{}',
    })
    expect(again.status).toBe(200)
  })
})

describe('public calendar feeds', () => {
  const tag = `it-ics-${Math.random().toString(36).slice(2, 8)}`
  const MEETING = `https://zoom.us/j/${tag}`
  const ids: (number | string)[] = []

  beforeAll(async () => {
    const payload = await testPayload()
    const doc = await payload.create({
      collection: 'content-events',
      data: {
        slug: tag,
        title: tag,
        type: 'wg_call',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 90000000).toISOString(),
        description: `Dial in at ${MEETING} please`,
        meetingUrl: MEETING,
        state: 'published',
      },
      overrideAccess: true,
    })
    ids.push(doc.id)
  })

  afterAll(async () => {
    const payload = await testPayload()
    for (const id of ids) {
      await payload.delete({ collection: 'content-events', id, overrideAccess: true })
    }
  })

  it.each([`/ics/event/${tag}.ics`, '/ics/all.ics'])(
    'does not leak the meeting link in %s',
    async (path) => {
      const res = await fetch(`${BASE}${path}`)
      expect(res.status).toBe(200)
      const body = await res.text()
      expect(body).toContain(tag)
      expect(body).not.toContain(MEETING)
      expect(body).not.toContain('zoom.us')
    },
  )
})
