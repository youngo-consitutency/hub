import type { Doc } from '../../src/lib/domain'
import { beforeAll, describe, expect, it } from 'vitest'
import { testPayload } from './provision'
import { api, session } from './helpers'

// a unique word so the query only matches the row this spec creates
const ROLE = `Zebrafinch ${Math.random().toString(36).slice(2, 8)} contact point`

describe('intelligence query', () => {
  let focal: { cookie: string; account: Doc }
  let member: { cookie: string; account: Doc }

  beforeAll(async () => {
    await (
      await testPayload()
    ).create({
      collection: 'directory-contacts',
      data: {
        group: 'Teams',
        roleTitle: ROLE,
        description: 'Role mailbox for the spec',
        publicEmail: 'zebrafinch@test.invalid',
      },
      overrideAccess: true,
    })
    focal = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'focal_point', scopeType: 'platform', scopeId: 'platform' }],
    })
    member = await session({})
  })

  const ask = (cookie: string) =>
    api('/intelligence/query', {
      method: 'POST',
      cookie,
      body: JSON.stringify({ query: ROLE.split(' ').slice(0, 2).join(' ') }),
    })

  it('cites directory contacts for accounts that may read them', async () => {
    const res = await ask(focal.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    const contact = body.evidence.find((e: Doc) => e.sourceType === 'contact')
    expect(contact?.title).toBe(ROLE)
    expect(contact?.snippet).toContain('zebrafinch@test.invalid')
  })

  it('leaves contacts out for ordinary members', async () => {
    const res = await ask(member.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.evidence.some((e: Doc) => e.sourceType === 'contact')).toBe(false)
  })
})
