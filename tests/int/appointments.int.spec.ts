import { describe, it, beforeAll, expect } from 'vitest'

import { provisionAccount, testPayload } from './provision'
import { api, session } from './helpers'

// PR1 regression coverage (§8): the shared permission model derives every
// capability and Council seat from `appointments` (canonical mandates) plus
// explicitly mapped legacy `assignments` rows — never from an account title.
// All records are generated at runtime; nothing about real people is
// embedded here.

const NOW = Date.now()
const iso = (ms: number) => new Date(NOW + ms).toISOString()

async function accessFor(account: any) {
  const payload = await testPayload()
  const { getAccessProfile } = await import('@/lib/access')
  return getAccessProfile({ payload } as any, account)
}

async function createAppointment(account: any, data: Record<string, any>) {
  const payload = await testPayload()
  return payload.create({
    collection: 'appointments',
    data: {
      account: account.id,
      status: 'active',
      startsAt: iso(-86400000),
      ...data,
    } as any,
    overrideAccess: true,
  })
}

async function createAssignment(account: any, data: Record<string, any>) {
  const payload = await testPayload()
  return payload.create({
    collection: 'assignments',
    data: {
      account: account.id,
      status: 'active',
      startsAt: iso(-86400000),
      ...data,
    } as any,
    overrideAccess: true,
  })
}

describe('appointment-derived permissions', () => {
  it('grants a GCT appointment exactly its responsibility area', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'gct.finance', scopeType: 'team', scopeId: 'gct' }],
    })
    const access = await accessFor(account)
    expect(access.teamRoles).toContain('gct')
    expect(access.teamRoles).toContain('finance_team')
    expect(access.capabilities).toContain('finance.review')
    expect(access.capabilities).toContain('gct.coordinate')
    expect(access.capabilities).not.toContain('membership.review')
    expect(access.capabilities).not.toContain('partnership.review')
    expect(access.councilSeats).toEqual([])
  })

  it('recognises a Council appointment consistently across sources', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'wg.contact_point', scopeType: 'working_group', scopeId: 'finance' }],
    })
    const access = await accessFor(account)
    expect(access.councilSeats).toEqual(['wg:finance'])
    expect(access.capabilities).toContain('council.vote')
    expect(access.capabilities).toContain('wg.manage:finance')
  })

  it('recognises a recorded substitute for the seat it covers only', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()
    const principal = await createAppointment(account, {
      appointmentRole: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: 'oceans',
    })
    const { account: deputy } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    await createAppointment(deputy, {
      appointmentRole: 'council.substitute',
      scopeType: 'platform',
      scopeId: 'platform',
      councilSeat: 'wg:oceans',
      substituteFor: principal.id,
    })
    const access = await accessFor(deputy)
    // The seat key is the principal's — a substitute cannot mint a new seat.
    expect(access.councilSeats).toEqual(['wg:oceans'])
  })

  it('maps legacy assignment rows and denies unmapped ones', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'election_facilitation',
      role: 'member',
    })
    await createAssignment(account, {
      scopeType: 'body',
      scopeId: 'ancient-committee',
      role: 'chairperson', // no explicit mapping → denied
    })
    const access = await accessFor(account)
    expect(access.capabilities).toContain('election.facilitate')
    expect(access.capabilities).not.toContain('body.manage:ancient-committee')
    expect(access.unmappedAssignments).toBe(1)
  })

  it('gives a technical administrator no constituency authority', async () => {
    const { account } = await provisionAccount({ role: 'admin' })
    const access = await accessFor(account)
    expect(access.capabilities).toContain('platform.manage')
    expect(access.councilSeats).toEqual([])
    expect(access.capabilities).not.toContain('council.vote')
    expect(access.capabilities).not.toContain('selection.manage')
    expect(access.capabilities).not.toContain('safeguarding.case')
    expect(access.teamRoles).toEqual([])
  })

  it('suppresses CW-gated appointments while membership is inactive', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'network', // appointment exists but grants nothing
      appointments: [{ role: 'team.selections', scopeType: 'team', scopeId: 'selection_team' }],
    })
    const access = await accessFor(account)
    expect(access.capabilities).not.toContain('selection.manage')
    expect(access.appointments.map((a) => a.role)).toContain('team.selections')
  })

  it('honours appointment windows and revocation', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()

    const future = await createAppointment(account, {
      appointmentRole: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
      startsAt: iso(86400000),
    })
    const lapsed = await createAppointment(account, {
      appointmentRole: 'team.comms',
      scopeType: 'team',
      scopeId: 'comms_team',
      endsAt: iso(-1),
    })
    const revoked = await createAppointment(account, {
      appointmentRole: 'team.reforms',
      scopeType: 'team',
      scopeId: 'reforms_team',
    })
    await payload.update({
      collection: 'appointments',
      id: revoked.id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })

    const access = await accessFor(account)
    expect(access.capabilities).not.toContain('finance.review')
    expect(access.capabilities).not.toContain('content.publish')
    expect(access.capabilities).not.toContain('reforms.coordinate')

    // Losing one appointment preserves the others.
    const live = await createAppointment(account, {
      appointmentRole: 'team.membership',
      scopeType: 'team',
      scopeId: 'membership_team',
    })
    const after = await accessFor(account)
    expect(after.capabilities).toContain('membership.review')
    expect(after.capabilities).not.toContain('finance.review')
    void future
    void lapsed
    void live
  })
})

describe('appointment service', () => {
  it('grants transactionally and rejects duplicates', async () => {
    const payload = await testPayload()
    const { grantAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })

    const first = await grantAppointment(req, {
      account: account.id,
      appointmentRole: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: 'ace',
      evidence: 'Recorded selection outcome',
    } as any)
    expect(first.councilSeat).toBe('wg:ace')

    await expect(
      grantAppointment(req, {
        account: account.id,
        appointmentRole: 'wg.contact_point',
        scopeType: 'working_group',
        scopeId: 'ace',
      } as any),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('refuses a CW-gated mandate for a Network member', async () => {
    const payload = await testPayload()
    const { grantAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'network' })
    await expect(
      grantAppointment(req, {
        account: account.id,
        appointmentRole: 'gct.coordinator',
        scopeType: 'team',
        scopeId: 'gct',
      } as any),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('records revocation with a reason and blocks double revocation', async () => {
    const payload = await testPayload()
    const { grantAppointment, revokeAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const { account: actor } = await provisionAccount({ role: 'admin' })
    const row = await grantAppointment(req, {
      account: account.id,
      appointmentRole: 'team.data_controller',
      scopeType: 'team',
      scopeId: 'data_controller',
    } as any)
    const revoked = await revokeAppointment(req, row.id, actor, 'Mandate ended, handover complete.')
    expect(revoked.status).toBe('revoked')
    await expect(
      revokeAppointment(req, row.id, actor, 'Mandate ended, handover complete.'),
    ).rejects.toMatchObject({ status: 409 })
    const access = await accessFor(account)
    expect(access.capabilities).not.toContain('privacy.manage')
  })
})

describe('appointments collection access', () => {
  it('blocks anonymous and member writes over the generated API', async () => {
    const anon = await api('/appointments', {
      method: 'POST',
      body: JSON.stringify({ appointmentRole: 'gct.coordinator' }),
    })
    expect([401, 403]).toContain(anon.status)
    const member = await session({})
    const res = await api('/appointments', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        account: member.account.id,
        appointmentRole: 'gct.coordinator',
        scopeType: 'team',
        scopeId: 'gct',
        startsAt: new Date().toISOString(),
      }),
    })
    expect(res.status).toBe(403)
  })

  it('lets members read only their own appointments', async () => {
    const mine = await session({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'coy.lcoy_liaison', scopeType: 'team', scopeId: 'lcoy_liaison' }],
    })
    const other = await session({ membershipTrack: 'constituency_work' })
    const res = await api('/appointments?limit=100', { cookie: mine.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.docs.length).toBeGreaterThanOrEqual(1)
    for (const doc of body.docs) {
      const owner = typeof doc.account === 'object' ? doc.account.id : doc.account
      expect(owner).toBe(mine.account.id)
    }
    const theirs = await api('/appointments?limit=100', { cookie: other.cookie })
    const otherBody = await theirs.json()
    expect(
      (otherBody.docs ?? []).every((d: any) => d.appointmentRole !== 'coy.lcoy_liaison'),
    ).toBe(true)
  })
})
