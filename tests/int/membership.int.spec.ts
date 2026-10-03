import { describe, it, beforeAll, expect } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

describe('membership lifecycle (S17)', () => {
  let cwMember: { cookie: string; account: any }
  let staff: { cookie: string; account: any }
  let member: { cookie: string; account: any }

  beforeAll(async () => {
    cwMember = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'finance', role: 'contact' },
    })
    staff = await session({ membershipTrack: 'constituency_work', teams: ['membership_team'] })
    member = await session({})
  })

  it('reports the member state and renews Constituency Work', async () => {
    const state = await api('/member/membership/state', {
      cookie: cwMember.cookie,
    })
    expect(state.status).toBe(200)
    const body = await state.json()
    expect(body.constituencyWorkStatus).toBe('active')
    // A WG Contact Point is a mandate: it reports through `records`,
    // the single authority store.
    expect(
      body.records.some((a: any) => a.role === 'wg.contact_point' && a.scopeId === 'finance'),
    ).toBe(true)

    const renew = await api('/member/membership/renew', {
      method: 'POST',
      cookie: cwMember.cookie,
    })
    expect(renew.status).toBe(200)
    const renewed = await renew.json()
    expect(renewed.constituencyWorkStatus).toBe('active')
    expect(new Date(renewed.renewalDueAt).getUTCMonth()).toBe(1) // February

    // Network-track member has nothing to renew.
    expect(
      (
        await api('/member/membership/renew', {
          method: 'POST',
          cookie: member.cookie,
        })
      ).status,
    ).toBe(400)
  })

  it(
    'CW resignation ends WG authority records and opens a two-week handover',
    { timeout: 60000 },
    async () => {
      const resign = await api('/member/membership/resign', {
        method: 'POST',
        cookie: cwMember.cookie,
        body: JSON.stringify({ scope: 'constituency_work' }),
      })
      expect(resign.status).toBe(200)
      const body = await resign.json()
      expect(body.handover.status).toBe('open')
      expect(body.handover.items.length).toBeGreaterThanOrEqual(3)
      const dueMs = new Date(body.handover.dueAt).getTime() - Date.now()
      expect(dueMs).toBeGreaterThan(13 * 86400000)

      const state = await (
        await api('/member/membership/state', { cookie: cwMember.cookie })
      ).json()
      expect(state.constituencyWorkStatus).toBeFalsy()
      // Resignation ends every record; ended rows stay visible for audit.
      expect(state.records.length).toBeGreaterThan(0)
      expect(state.records.every((r: any) => r.status !== 'active')).toBe(true)

      // member completes the checklist → handover closes
      const handoverId = body.handover.id
      const itemCount = body.handover.items.length
      for (let i = 0; i < itemCount; i += 1) {
        const res = await api(`/member/handovers/${handoverId}/items/${i}/complete`, {
          method: 'POST',
          cookie: cwMember.cookie,
        })
        expect(res.status).toBe(200)
      }
      const handovers = await (await api('/member/handovers', { cookie: cwMember.cookie })).json()
      expect(handovers.items[0].status).toBe('completed')
    },
  )

  it(
    'termination ends authority records, opens a handover, and the expiry sweep clears lapsed CW members',
    { timeout: 90000 },
    async () => {
      // Termination by the membership team.
      const target = await session({
        membershipTrack: 'constituency_work',
        wg: { slug: 'finance', role: 'member' },
      })
      const terminate = await api(
        `/member/team/membership/accounts/${target.account.id}/terminate`,
        {
          method: 'POST',
          cookie: staff.cookie,
          body: JSON.stringify({ reason: 'contract test termination' }),
        },
      )
      expect(terminate.status).toBe(200)
      const terminated = await terminate.json()
      expect(terminated.account.membershipStatus).toBe('terminated')
      expect(terminated.handover.status).toBe('open')

      // Ordinary members cannot terminate.
      expect(
        (
          await api(`/member/team/membership/accounts/${member.account.id}/terminate`, {
            method: 'POST',
            cookie: member.cookie,
            body: JSON.stringify({ reason: 'should not work' }),
          })
        ).status,
      ).toBe(403)

      // Expiry sweep: lapse the renewal due date, then run the job.
      const lapsed = await session({
        membershipTrack: 'constituency_work',
        wg: { slug: 'ace', role: 'member' },
      })
      const payload = await testPayload()
      await payload.update({
        collection: 'accounts',
        id: lapsed.account.id,
        data: {
          renewalDueAt: new Date(Date.now() - 86400000).toISOString(),
        } as any,
        overrideAccess: true,
      })
      const sweep = await api('/member/team/membership/renewals/run', {
        method: 'POST',
        cookie: staff.cookie,
      })
      expect(sweep.status).toBe(200)
      const swept = await sweep.json()
      const hit = swept.items.find((i: any) => i.accountId === lapsed.account.id)
      expect(hit).toBeTruthy()
      expect(hit.recordsEnded).toBe(1)

      // membership team can see the open handovers queue
      const queue = await api('/member/team/membership/handovers', {
        cookie: staff.cookie,
      })
      expect(queue.status).toBe(200)
      const { items } = await queue.json()
      expect(items.length).toBeGreaterThanOrEqual(2)
      expect(
        (
          await api('/member/team/membership/handovers', {
            cookie: member.cookie,
          })
        ).status,
      ).toBe(403)
    },
  )
})
