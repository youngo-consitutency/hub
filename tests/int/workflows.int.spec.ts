import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { api, session } from './helpers'

describe('operational workflows', () => {
  let member: { cookie: string; account: AnyValue }
  let finance: { cookie: string; account: AnyValue }
  let safeguarding: { cookie: string; account: AnyValue }
  let dpo: { cookie: string; account: AnyValue }

  beforeAll(async () => {
    member = await session({ membershipTrack: 'constituency_work' })
    finance = await session({ membershipTrack: 'constituency_work', teams: ['finance_team'] })
    safeguarding = await session({
      membershipTrack: 'constituency_work',
      teams: ['safeguarding_team'],
    })
    dpo = await session({ membershipTrack: 'constituency_work', teams: ['data_controller'] })
  })

  it('funding: member submits, finance reviews, disburses, member reports', async () => {
    const created = await api('/member/funding', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        title: 'Travel support',
        purpose: 'Regional meeting travel',
        amountNumeric: 150,
        category: 'event_travel',
      }),
    })
    expect(created.status).toBe(201)
    const { request } = await created.json()
    expect(request.status).toBe('submitted')

    // member sees own request; finance sees the queue
    expect((await api(`/member/funding/${request.id}`, { cookie: member.cookie })).status).toBe(200)
    const queue = await api('/member/team/funding', { cookie: finance.cookie })
    expect(queue.status).toBe(200)
    expect((await queue.json()).items.some((i: AnyValue) => i.id === request.id)).toBe(true)

    // ordinary member cannot review
    expect(
      (
        await api(`/member/team/funding/${request.id}/review`, {
          method: 'POST',
          cookie: member.cookie,
          body: JSON.stringify({ status: 'approved' }),
        })
      ).status,
    ).toBe(403)

    // review → approve → disburse (finance only) → member reports
    for (const status of ['under_review', 'approved']) {
      const res = await api(`/member/team/funding/${request.id}/review`, {
        method: 'POST',
        cookie: finance.cookie,
        body: JSON.stringify({ status }),
      })
      expect(res.status).toBe(200)
    }
    const disbursed = await api(`/member/team/funding/${request.id}/disburse`, {
      method: 'POST',
      cookie: finance.cookie,
    })
    expect(disbursed.status).toBe(200)
    const reported = await api(`/member/funding/${request.id}/report`, {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ reportNote: 'Funds used for booked travel.' }),
    })
    expect(reported.status).toBe(200)
    expect((await reported.json()).request.status).toBe('reported')
  })

  it('safeguarding: confidential report, team-only case list and updates', async () => {
    const created = await api('/member/safeguarding', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        kind: 'concern',
        severity: 'high',
        description: 'A concern about member conduct at an event.',
        anonymous: true,
      }),
    })
    expect(created.status).toBe(201)
    const { caseRef } = await created.json()
    expect(caseRef).toMatch(/^SG-/)

    // reporter sees only their own reference + status
    const mine = await api('/member/safeguarding', { cookie: member.cookie })
    expect(mine.status).toBe(200)
    const { items } = await mine.json()
    expect(items[0].caseRef).toBe(caseRef)
    expect(items[0].description).toBeUndefined()

    // non-team members cannot list cases
    expect((await api('/member/team/safeguarding', { cookie: finance.cookie })).status).toBe(403)

    // team sees the case; anonymous hides the reporter
    const team = await api('/member/team/safeguarding', { cookie: safeguarding.cookie })
    expect(team.status).toBe(200)
    const cases = (await team.json()).items
    const found = cases.find((c: AnyValue) => `SG-${c.id}` === caseRef)
    expect(found).toBeTruthy()
    expect(found.reporter).toBeNull()

    // update flow: received → triaged → investigating
    for (const status of ['triaged', 'investigating']) {
      const res = await api(`/member/team/safeguarding/${found.id}/update`, {
        method: 'POST',
        cookie: safeguarding.cookie,
        body: JSON.stringify({ status, note: `Moved to ${status}.` }),
      })
      expect(res.status).toBe(200)
    }
  })

  it('COI, recognition and privacy request lifecycles', async () => {
    // COI: declare → membership team resolves
    const coi = await api('/member/coi', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        interest: 'Employer grant',
        details: 'Employer funds a related programme.',
        relatedScope: 'finance',
      }),
    })
    expect(coi.status).toBe(201)
    const coiId = (await coi.json()).declaration.id
    const membership = await session({
      membershipTrack: 'constituency_work',
      teams: ['membership_team'],
    })
    const resolved = await api(`/member/team/membership/coi/${coiId}/review`, {
      method: 'POST',
      cookie: membership.cookie,
      body: JSON.stringify({ status: 'resolved', reviewNote: 'Noted; recusal recorded.' }),
    })
    expect(resolved.status).toBe(200)

    // privacy: request → data controller fulfils
    const priv = await api('/member/privacy', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ kind: 'access', details: 'Request copy of my data.' }),
    })
    expect(priv.status).toBe(201)
    const privId = (await priv.json()).request.id
    const progress = await api(`/member/team/privacy/${privId}/respond`, {
      method: 'POST',
      cookie: dpo.cookie,
      body: JSON.stringify({ status: 'in_progress' }),
    })
    expect(progress.status).toBe(200)
    const fulfilled = await api(`/member/team/privacy/${privId}/respond`, {
      method: 'POST',
      cookie: dpo.cookie,
      body: JSON.stringify({ status: 'fulfilled', responseNote: 'Export provided.' }),
    })
    expect(fulfilled.status).toBe(200)
    expect((await fulfilled.json()).request.status).toBe('fulfilled')
  })

  it('partnerships: major sponsorship requires a council decision before approval', async () => {
    const p = await api('/member/partnerships', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        organisationName: 'Example Foundation',
        kind: 'sponsorship',
        summary: 'Grant sponsorship for the assembly.',
        requiresCouncilDecision: true,
      }),
    })
    expect(p.status).toBe(201)
    const pid = (await p.json()).request.id
    const partnerships = await session({
      membershipTrack: 'constituency_work',
      teams: ['partnerships_team'],
    })
    const underReview = await api(`/member/team/partnerships/${pid}/review`, {
      method: 'POST',
      cookie: partnerships.cookie,
      body: JSON.stringify({ status: 'under_review' }),
    })
    expect(underReview.status).toBe(200)
    const blocked = await api(`/member/team/partnerships/${pid}/review`, {
      method: 'POST',
      cookie: partnerships.cookie,
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error.code).toBe('council_decision_required')
  })
})
