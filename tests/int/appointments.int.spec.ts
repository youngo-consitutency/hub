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

describe('migration supersession', () => {
  it('keeps a migrated record denied after the appointment is revoked', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()
    // Legacy grant that the migration replaced…
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    // …and its canonical replacement.
    const appt = await createAppointment(account, {
      appointmentRole: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
    })
    expect((await accessFor(account)).capabilities).toContain('finance.review')

    await payload.update({
      collection: 'appointments',
      id: appt.id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })
    // The untouched legacy row must NOT resurrect the permission.
    expect((await accessFor(account)).capabilities).not.toContain('finance.review')
  })

  it('keeps a migrated record denied after the appointment lapses', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'reforms_team',
      role: 'member',
    })
    await createAppointment(account, {
      appointmentRole: 'team.reforms',
      scopeType: 'team',
      scopeId: 'reforms_team',
      endsAt: iso(-3600000), // lapsed by window, still status=active
    })
    expect((await accessFor(account)).capabilities).not.toContain('reforms.coordinate')
  })
})

describe('migration backfill', () => {
  async function migrate(account: any) {
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    const result = await writeMigration(payload, plan)
    return { plan, result }
  }

  async function appointmentCount(account: any) {
    const payload = await testPayload()
    const { totalDocs } = await payload.count({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    return totalDocs
  }

  it('preserves historical status — inactive sources never come back live', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'safeguarding_team',
      role: 'member',
      status: 'inactive',
    })
    const { plan } = await migrate(account)
    expect(plan.creates).toHaveLength(1)
    expect(plan.creates[0].status).toBe('inactive')
    const payload = await testPayload()
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect((docs[0] as any).status).toBe('inactive')
    expect((docs[0] as any).appointedVia.assignmentId).toBe(src.id)
    expect((await accessFor(account)).capabilities).not.toContain('safeguarding.case')
  })

  it('is idempotent across repeat runs and after revocation', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    await migrate(account)
    expect(await appointmentCount(account)).toBe(1)

    // Second run: the source-linked row is recognised, nothing new.
    const second = await migrate(account)
    expect(second.plan.creates).toHaveLength(0)
    expect(second.plan.alreadyMigrated).toBe(1)
    expect(await appointmentCount(account)).toBe(1)

    // Revoke the migrated appointment, then rerun: no resurrection.
    const payload = await testPayload()
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'appointments',
      id: docs[0].id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })
    const third = await migrate(account)
    expect(third.plan.creates).toHaveLength(0)
    expect(third.plan.alreadyMigrated).toBe(1)
    expect(await appointmentCount(account)).toBe(1)
    expect((await accessFor(account)).capabilities).not.toContain('finance.review')
  })

  it('never overwrites a canonical row written by another process', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()
    const { grantAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    // A human grant for the same tuple, with its own details.
    const human = await grantAppointment(req, {
      account: account.id,
      appointmentRole: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
      evidence: 'Council decision 2025-07',
    } as any)
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    const { plan, result } = await migrate(account)
    expect(plan.creates).toHaveLength(0)
    expect(plan.existingCanonical).toBe(1)
    expect(result.created).toBe(0)
    const after = await payload.findByID({
      collection: 'appointments',
      id: human.id,
      overrideAccess: true,
    })
    expect((after as any).evidence).toBe('Council decision 2025-07')
    expect((after as any).status).toBe('active')
  })

  it('normalises organisation scopes through grant and migration', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()
    const { grantAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    const granted = await grantAppointment(req, {
      account: account.id,
      appointmentRole: 'org.representative',
      scopeType: 'organization', // API spelling → stored canonical
      scopeId: 'org-acme',
    } as any)
    expect((granted as any).scopeType).toBe('organisation')
    expect((await accessFor(account)).councilSeats).toContain('org:org-acme')

    const { account: legacy } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    await createAssignment(legacy, {
      scopeType: 'organization', // ledger spelling
      scopeId: 'org-beta',
      role: 'representative',
    })
    const { plan } = await migrate(legacy)
    expect(plan.creates).toHaveLength(1)
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: legacy.id } },
      overrideAccess: true,
    })
    expect((docs[0] as any).scopeType).toBe('organisation')
    expect((docs[0] as any).appointmentRole).toBe('org.representative')
    expect((await accessFor(legacy)).councilSeats).toContain('org:org-beta')
  })
})

describe('focal point authority', () => {
  it('grants nothing from the account title alone', async () => {
    const { account } = await provisionAccount({
      role: 'focal_point',
      membershipTrack: 'constituency_work',
    })
    const access = await accessFor(account)
    expect(access.councilSeats).toEqual([])
    expect(access.capabilities).not.toContain('council.vote')
    expect(access.capabilities).not.toContain('constituency.coordinate')
    expect(access.isFocalPoint).toBeFalsy()
  })

  it('migrates the title into an evidenced appointment and revokes cleanly', async () => {
    const { account } = await provisionAccount({
      role: 'focal_point',
      membershipTrack: 'constituency_work',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    expect(plan.focalAccounts).toHaveLength(1)
    await writeMigration(payload, plan)

    const granted = await accessFor(account)
    expect(granted.councilSeats).toContain('focal_point')
    expect(granted.capabilities).toContain('council.vote')
    expect(granted.isFocalPoint).toBe(true)

    // Revocation removes the authority even though the title remains.
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'appointments',
      id: docs[0].id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })
    const after = await accessFor(account)
    expect(after.councilSeats).toEqual([])
    expect(after.capabilities).not.toContain('council.vote')
  })
})

describe('strict legacy tuples', () => {
  it('denies unknown GCT and negotiation roles through stored rows', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, { scopeType: 'team', scopeId: 'gct', role: 'overlord' })
    await createAssignment(account, {
      scopeType: 'negotiation_track',
      scopeId: 'track-x',
      role: 'observer',
    })
    const access = await accessFor(account)
    expect(access.unmappedAssignments).toBe(2)
    expect(access.capabilities).not.toContain('gct.coordinate')
    expect(access.teamRoles).not.toContain('gct')
    expect(access.negotiationAssignments).toEqual([])
  })

  it('denies unknown roles at the resolver, including events', async () => {
    const { legacyAppointmentRole } = await import('@/lib/appointments')
    // Unknown roles → null (reported unmapped), never defaulted.
    expect(legacyAppointmentRole('team', 'gct', 'overlord')).toBeNull()
    expect(legacyAppointmentRole('event', 'cop30', 'vip')).toBeNull()
    expect(legacyAppointmentRole('negotiation_track', 't', 'observer')).toBeNull()
    // Known tuples still resolve.
    expect(legacyAppointmentRole('team', 'gct', 'member')).toBe('gct.coordinator')
    expect(legacyAppointmentRole('team', 'gct', 'finance')).toBe('gct.finance')
    expect(legacyAppointmentRole('event', 'cop30', 'member')).toBe('cct.member')
    expect(legacyAppointmentRole('event', 'cop30', 'coordinator')).toBe('cct.coordinator')
    expect(legacyAppointmentRole('negotiation_track', 't', 'reviewer')).toBe('negotiation.reviewer')
  })
})

describe('shared permission derivation', () => {
  it('gives a GCT membership appointment membership.review through both endpoint families', async () => {
    const session_ = await session({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'gct.membership', scopeType: 'team', scopeId: 'gct' }],
    })
    // Payload family: capability in the access profile.
    const access = await accessFor(session_.account)
    expect(access.capabilities).toContain('membership.review')
    // Platform family: the same appointment satisfies the workspace check.
    const res = await api('/platform/overview', { cookie: session_.cookie })
    expect(res.status).toBe(200)
    expect((await res.json()).canReviewMembership).toBe(true)
  })
})

describe('GCT responsibility endpoints', () => {
  async function requestDoc(collection: string, account: any, data: Record<string, any>) {
    const payload = await testPayload()
    return payload.create({
      collection: collection as any,
      data: { account: account.id, ...data } as any,
      overrideAccess: true,
    })
  }

  it('admits only the matching GCT area to funding, partnerships and recognition review', async () => {
    const { account: applicant } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    const funding = await requestDoc('funding-requests', applicant, {
      title: 'Travel support',
      purpose: 'Regional coordination meeting',
      amountNumeric: 400,
      currency: 'EUR',
      category: 'event_travel',
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    })
    const partnership = await requestDoc('partnership-requests', applicant, {
      organisationName: 'Partner Org',
      kind: 'partnership',
      summary: 'Joint programme proposal',
      status: 'proposed',
      proposedAt: new Date().toISOString(),
    })
    const recognition = await requestDoc('recognition-requests', applicant, {
      kind: 'certificate',
      purpose: 'Working-group service',
      status: 'requested',
      requestedAt: new Date().toISOString(),
    })

    const financeArea = await session({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'gct.finance', scopeType: 'team', scopeId: 'gct' }],
    })
    const partnershipsArea = await session({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'gct.partnerships', scopeType: 'team', scopeId: 'gct' }],
    })
    const coordinationArea = await session({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'gct.coordination', scopeType: 'team', scopeId: 'gct' }],
    })
    const internalArea = await session({
      membershipTrack: 'constituency_work',
      appointments: [{ role: 'gct.internal', scopeType: 'team', scopeId: 'gct' }],
    })

    // Funding: only finance.review.
    expect((await api('/member/team/funding', { cookie: financeArea.cookie })).status).toBe(200)
    expect((await api('/member/team/funding', { cookie: internalArea.cookie })).status).toBe(403)
    expect((await api('/member/team/funding', { cookie: partnershipsArea.cookie })).status).toBe(
      403,
    )
    const fundReview = await api(`/member/team/funding/${funding.id}/review`, {
      method: 'POST',
      cookie: financeArea.cookie,
      body: JSON.stringify({ status: 'under_review' }),
    })
    expect(fundReview.status).toBe(200)
    expect(
      (
        await api(`/member/team/funding/${funding.id}/review`, {
          method: 'POST',
          cookie: internalArea.cookie,
          body: JSON.stringify({ status: 'approved' }),
        })
      ).status,
    ).toBe(403)

    // Partnerships: only partnership.review.
    expect(
      (await api('/member/team/partnerships', { cookie: partnershipsArea.cookie })).status,
    ).toBe(200)
    expect((await api('/member/team/partnerships', { cookie: financeArea.cookie })).status).toBe(
      403,
    )
    expect(
      (
        await api(`/member/team/partnerships/${partnership.id}/review`, {
          method: 'POST',
          cookie: financeArea.cookie,
          body: JSON.stringify({ status: 'under_review' }),
        })
      ).status,
    ).toBe(403)

    // Recognition: only recognition.review (GCT coordination support).
    expect(
      (await api('/member/team/recognition', { cookie: coordinationArea.cookie })).status,
    ).toBe(200)
    expect((await api('/member/team/recognition', { cookie: internalArea.cookie })).status).toBe(
      403,
    )
    void recognition
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
    expect((otherBody.docs ?? []).every((d: any) => d.appointmentRole !== 'coy.lcoy_liaison')).toBe(
      true,
    )
  })
})
