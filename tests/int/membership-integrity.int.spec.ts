import type { AnyValue } from '../../src/lib/domain'
import { beforeAll, describe, expect, it } from 'vitest'

import { testPayload } from './provision'
import { api, login, session } from './helpers'

const post = (path: string, cookie: string, body: unknown = {}) =>
  api(path, { method: 'POST', cookie, body: JSON.stringify(body) })

const COURSE = {
  version: 'it',
  passScore: 2,
  modules: [],
  quiz: [
    { id: 'q1', prompt: 'one', choices: ['a', 'b'], correct: 'a' },
    { id: 'q2', prompt: 'two', choices: ['a', 'b'], correct: 'b' },
  ],
}
const RIGHT = { answers: { q1: 'a', q2: 'b' } }
const WRONG = { answers: { q1: 'b', q2: 'a' } }

async function setCourse() {
  const payload = await testPayload()
  const found = await payload.find({
    collection: 'content-documents',
    where: { slug: { equals: 'membership-course' } },
    limit: 1,
    overrideAccess: true,
  })
  const data = { slug: 'membership-course', title: 'Course', body: COURSE }
  if (found.docs[0])
    await payload.update({
      collection: 'content-documents',
      id: found.docs[0].id,
      data,
      overrideAccess: true,
    })
  else await payload.create({ collection: 'content-documents', data, overrideAccess: true })
}

async function setAccount(id: number, data: AnyValue) {
  const payload = await testPayload()
  await payload.update({ collection: 'accounts', id, data, overrideAccess: true })
}

async function accountOf(id: number) {
  const payload = await testPayload()
  return (await payload.findByID({
    collection: 'accounts',
    id,
    overrideAccess: true,
  })) as AnyValue
}

describe('H1: membership exit cannot be reversed by self-renewal', () => {
  it('a fully resigned member cannot renew back to active CW', { timeout: 60000 }, async () => {
    // the audit's chain: CW applicant passes the course, resigns, signs back in, renews
    await setCourse()
    const m = await session({ verified: false, membershipTrack: 'constituency_work' })
    expect((await post('/member/course/submit', m.cookie, RIGHT)).status).toBe(200)
    expect((await accountOf(m.account.id)).constituencyWorkStatus).toBe('pending_onboarding')
    const resign = await post('/member/membership/resign', m.cookie, { scope: 'membership' })
    expect(resign.status).toBe(200)
    const again = await login(m.email, m.password)
    expect((await post('/member/membership/renew', again.cookie)).status).toBe(409)
    const row = await accountOf(m.account.id)
    expect(row.membershipStatus).toBe('expired')
    expect(row.constituencyWorkStatus || null).toBeNull()
  })

  it('a member who resigned or lapsed from CW needs the team to reactivate', async () => {
    const m = await session({ membershipTrack: 'constituency_work' })
    const resign = await post('/member/membership/resign', m.cookie, {
      scope: 'constituency_work',
    })
    expect(resign.status).toBe(200)
    expect((await post('/member/membership/renew', m.cookie)).status).toBe(409)
    expect((await accountOf(m.account.id)).constituencyWorkStatus || null).toBeNull()
  })

  it('a current CW member still renews', async () => {
    const m = await session({ membershipTrack: 'constituency_work' })
    expect((await post('/member/membership/renew', m.cookie)).status).toBe(200)
  })
})

describe('H2: ended accounts cannot reinstate themselves via the course', () => {
  beforeAll(setCourse)

  it.each([
    ['rejected', { membershipStatus: 'rejected', hubAccessStatus: 'pending_course' }],
    ['terminated', { membershipStatus: 'terminated', hubAccessStatus: 'suspended' }],
    ['expired', { membershipStatus: 'expired', hubAccessStatus: 'suspended' }],
  ])('a %s account is refused and stays as it was', async (status, patch) => {
    const m = await session({ verified: false })
    await setAccount(m.account.id, patch)
    expect((await post('/member/course/submit', m.cookie, RIGHT)).status).toBe(403)
    const row = await accountOf(m.account.id)
    expect(row.membershipStatus).toBe(status)
    expect(row.hubAccessStatus).toBe(patch.hubAccessStatus)
    expect(row.memberStatus).toBe('pending_course')
  })

  it('a suspended account is refused even without a closed membership status', async () => {
    const m = await session({ verified: false })
    await setAccount(m.account.id, { hubAccessStatus: 'suspended' })
    expect((await post('/member/course/submit', m.cookie, RIGHT)).status).toBe(403)
  })

  it('a registrant still passes the course, graded on the server from the stored key', async () => {
    const m = await session({ verified: false })
    // a client-supplied score is ignored; only answers count
    const cheat = await post('/member/course/submit', m.cookie, { score: 99, answers: {} })
    expect(cheat.status).toBe(400)
    const fail = await post('/member/course/submit', m.cookie, WRONG)
    expect(fail.status).toBe(400)
    const ok = await post('/member/course/submit', m.cookie, RIGHT)
    expect(ok.status).toBe(200)
    const row = await accountOf(m.account.id)
    expect(row.memberStatus).toBe('verified')
    expect(row.membershipStatus).toBe('course_passed')
  })

  it('rejects further attempts after too many failures', async () => {
    const m = await session({ verified: false })
    for (let i = 0; i < 5; i += 1)
      expect((await post('/member/course/submit', m.cookie, WRONG)).status).toBe(400)
    expect((await post('/member/course/submit', m.cookie, RIGHT)).status).toBe(429)
    expect((await accountOf(m.account.id)).memberStatus).toBe('pending_course')
  })

  it('does not publish the answer key through /documents', async () => {
    const res = await api('/documents/membership-course')
    expect(res.status).toBe(200)
    const doc = await res.json()
    expect(doc.body.quiz).toHaveLength(2)
    expect(JSON.stringify(doc)).not.toContain('correct')
  })

  it('does not publish the answer key through the generated REST read', async () => {
    const res = await api('/content-documents?where[slug][equals]=membership-course')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.docs).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain('"correct"')
  })

  it('does not send the answer key to members taking the course', async () => {
    const m = await session({ verified: false })
    const res = await api('/member/course', { cookie: m.cookie })
    expect(JSON.stringify(await res.json())).not.toContain('"correct"')
  })
})

describe('onboarding and contact point review of WG membership', () => {
  let cp: { cookie: string; account: AnyValue }
  let member: { cookie: string; account: AnyValue }
  const wg = 'finance'

  beforeAll(async () => {
    cp = await session({ membershipTrack: 'constituency_work', wg: { slug: wg, role: 'contact' } })
    member = await session({})
  })

  it('self-onboarding never activates the WG membership', async () => {
    const res = await post(`/member/workspace/${wg}/onboard`, member.cookie, {
      presentationOk: true,
      rulesOk: true,
    })
    expect(res.status).toBe(200)
    expect((await res.json()).progress.status).not.toBe('active')
  })

  it('Approve sets the WG membership to active without leaking account data', async () => {
    const join = await post(`/member/workspace/${wg}/join`, member.cookie)
    expect((await join.json()).progress.status).toBe('pending_approval')
    const res = await post(`/member/cp/${wg}/members/${member.account.id}/role`, cp.cookie, {
      role: 'member',
      status: 'active',
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.progress.status).toBe('active')
    expect(JSON.stringify(body)).not.toContain('"email"')
  })

  it('Reject sets the WG membership to rejected', async () => {
    const res = await post(`/member/cp/${wg}/members/${member.account.id}/role`, cp.cookie, {
      role: 'member',
      status: 'rejected',
    })
    expect(res.status).toBe(200)
    expect((await res.json()).progress.status).toBe('rejected')
  })

  it('refuses an unknown status', async () => {
    const res = await post(`/member/cp/${wg}/members/${member.account.id}/role`, cp.cookie, {
      status: 'pending_approval',
    })
    expect(res.status).toBe(400)
  })

  it('onboarding does not reopen a rejected membership', async () => {
    const res = await post(`/member/workspace/${wg}/onboard`, member.cookie, {
      presentationOk: true,
      rulesOk: true,
    })
    expect((await res.json()).progress.status).toBe('rejected')
    // nor can a repeat join request overwrite the contact point's decision
    const join = await post(`/member/workspace/${wg}/join`, member.cookie)
    expect((await join.json()).progress.status).toBe('rejected')
  })

  it('only a contact point of that group may review', async () => {
    const res = await post(`/member/cp/${wg}/members/${member.account.id}/role`, member.cookie, {
      status: 'active',
    })
    expect(res.status).toBe(403)
  })
})

describe('contact point endpoints return projections, not account documents', () => {
  it('booking a CP call does not expose the host account', async () => {
    const payload = await testPayload()
    const host = await session({})
    await setAccount(host.account.id, {
      legacyPasswordHash: 'legacy-hash-marker',
      legacyPasswordSalt: 'legacy-salt-marker',
    })
    const slot = await payload.create({
      collection: 'cp-call-slots',
      data: {
        hostAccount: host.account.id,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'open',
      },
      overrideAccess: true,
    })
    const booker = await session({})
    const res = await post(`/member/cp-calls/slots/${slot.id}/book`, booker.cookie, {})
    expect(res.status).toBe(201)
    const text = JSON.stringify(await res.json())
    expect(text).not.toContain('legacy-hash-marker')
    expect(text).not.toContain('legacy-salt-marker')
    expect(text).not.toContain('"email"')
    expect(text).not.toContain('"dateOfBirth"')

    const released = await post('/member/cp-calls/mine/cancel', booker.cookie, {
      slotId: String(slot.id),
    })
    expect(released.status).toBe(200)
    expect(JSON.stringify(await released.json())).not.toContain('legacy-hash-marker')
  })
})
