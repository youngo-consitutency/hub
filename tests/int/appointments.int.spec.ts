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

// Waits until Postgres registers a writer QUEUED on the account's shared
// advisory lock — real database evidence of blocking, not a timeout guess.
async function waitForAdvisoryWaiter(accountId: number, timeoutMs = 10000) {
  const { requirePgPool } = await import('@/lib/pg')
  const { AUTHORITY_LOCK_NS } = await import('@/lib/authorityLock')
  const pool = requirePgPool()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const { rows } = await pool.query(
      `SELECT l.pid, a.query
       FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
       WHERE l.locktype = 'advisory' AND NOT l.granted
         AND l.classid = $1 AND l.objid = $2`,
      [AUTHORITY_LOCK_NS, accountId],
    )
    if (rows.length) return rows
    if (Date.now() > deadline)
      throw new Error(`No advisory-lock waiter appeared for account ${accountId}`)
    await new Promise((r) => setTimeout(r, 50))
  }
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

  it('confines a substitute to the covered seat and validates the principal', async () => {
    const payload = await testPayload()
    const { grantAppointment, revokeAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const { account: deputy } = await provisionAccount({ membershipTrack: 'constituency_work' })

    const principal = await grantAppointment(req, {
      account: account.id,
      appointmentRole: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: 'oceans',
    } as any)

    const sub = await grantAppointment(req, {
      account: deputy.id,
      appointmentRole: 'council.substitute',
      scopeType: 'platform',
      scopeId: 'platform',
      substituteFor: principal.id,
    } as any)
    // The row keeps the platform scope — the covered seat is carried by
    // councilSeat alone, so the substitute can never inherit the
    // principal's participation scopes.
    expect(sub.scopeType).toBe('platform')
    expect(sub.scopeId).toBe('seat:wg:oceans')
    expect(sub.councilSeat).toBe('wg:oceans')

    const access = await accessFor(deputy)
    expect(access.councilSeats).toEqual(['wg:oceans'])
    expect(access.wgAssignments ?? []).not.toContainEqual(
      expect.objectContaining({ wgSlug: 'oceans' }),
    )
    expect(access.bodyScopes ?? []).not.toContain('oceans')

    // A substitute cannot cover another substitute.
    const { account: second } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await expect(
      grantAppointment(req, {
        account: second.id,
        appointmentRole: 'council.substitute',
        scopeType: 'platform',
        scopeId: 'platform',
        substituteFor: sub.id,
      } as any),
    ).rejects.toMatchObject({ status: 409 })

    // Nor a principal whose mandate has ended.
    const { account: admin } = await provisionAccount({ role: 'admin' })
    await revokeAppointment(req, principal.id, admin, 'Term ended.')
    const { account: third } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await expect(
      grantAppointment(req, {
        account: third.id,
        appointmentRole: 'council.substitute',
        scopeType: 'platform',
        scopeId: 'platform',
        substituteFor: principal.id,
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

  it('keeps the source superseded when a migrated appointment is edited then revoked', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    await migrate(account)
    const payload = await testPayload()
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    // Edit the migrated appointment to a different role and scope — the
    // supersession link is the source identity, not the current tuple.
    await payload.update({
      collection: 'appointments',
      id: docs[0].id,
      data: { appointmentRole: 'team.partnerships', scopeId: 'partnerships_team' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'appointments',
      id: docs[0].id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })
    const access = await accessFor(account)
    // The revoked appointment grants nothing AND the edited tuple must not
    // release the original finance ledger row back into force.
    expect(access.capabilities).not.toContain('finance.review')
    expect(access.capabilities).not.toContain('partnership.review')
    // The provenance link survives the edits — it is write-once.
    const after = await payload.findByID({
      collection: 'appointments',
      id: docs[0].id,
      overrideAccess: true,
    })
    expect((after as any).appointedVia.source).toBe('assignments_migration')
    expect(String((after as any).appointedVia.assignmentId)).toBe(String(src.id))
  })

  it('never duplicates or resurrects under overlapping and stale plans', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'safeguarding_team',
      role: 'member',
      status: 'inactive',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    // Two plans built before either writes — the overlap window.
    const planA = await planMigration(payload, { accountIds: [account.id] })
    const planB = await planMigration(payload, { accountIds: [account.id] })
    expect(planA.creates).toHaveLength(1)
    const a = await writeMigration(payload, planA)
    expect(a.created).toBe(1)
    // The second run's plan still says "create", but the write-time source
    // check must make it a no-op — even for an inactive historical row.
    const b = await writeMigration(payload, planB)
    expect(b.created).toBe(0)
    expect(b.staleSkipped + b.conflicts).toBe(1)
    expect(await appointmentCount(account)).toBe(1)

    // A human then revokes the migrated appointment, and the stale plan
    // runs again: the revoked row must never be recreated or reactivated.
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
    const rerun = await writeMigration(payload, planA)
    expect(rerun.created).toBe(0)
    expect(rerun.staleSkipped + rerun.conflicts).toBe(1)
    expect(await appointmentCount(account)).toBe(1)
    const { docs: after } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect((after[0] as any).status).toBe('revoked')
    expect((await accessFor(account)).capabilities).not.toContain('safeguarding.case')
  })

  it('preserves human edits to a migrated appointment across reruns', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'reforms_team',
      role: 'member',
    })
    await migrate(account)
    const payload = await testPayload()
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    // A human corrects the evidence and term after migration.
    await payload.update({
      collection: 'appointments',
      id: docs[0].id,
      data: { evidence: 'Council decision 2026-01', endsAt: iso(86400000 * 30) },
      overrideAccess: true,
    })
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    expect(plan.alreadyMigrated).toBe(1)
    const result = await writeMigration(payload, plan)
    expect(result.created).toBe(0)
    const after = await payload.findByID({
      collection: 'appointments',
      id: docs[0].id,
      overrideAccess: true,
    })
    expect((after as any).evidence).toBe('Council decision 2026-01')
    expect((after as any).status).toBe('active')
  })

  it('re-reads the source in the write transaction — a revoked source never comes back live', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    expect(plan.creates[0].status).toBe('active')

    // A human revokes the source row AFTER the plan was built.
    await payload.update({
      collection: 'assignments',
      id: src.id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })
    const result = await writeMigration(payload, plan)
    // The stale plan must not restore the grant: the write re-reads the
    // source, so the migrated row carries the live 'revoked' status — the
    // mandate is recorded as ended, not resurrected.
    expect(result.created).toBe(1)
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect((docs[0] as any).status).toBe('revoked')
    expect((await accessFor(account)).capabilities).not.toContain('finance.review')
  })

  it('does not bypass an independently created and revoked canonical appointment', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'partnerships_team',
      role: 'member',
    })
    // Plan BEFORE the human acts — this is the stale-plan window.
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    expect(plan.creates).toHaveLength(1)

    // A human records the same mandate directly, then revokes it.
    const { grantAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    const human = await grantAppointment(req, {
      account: account.id,
      appointmentRole: 'team.partnerships',
      scopeType: 'team',
      scopeId: 'partnerships_team',
      evidence: 'Recorded directly by Council.',
    } as any)
    await payload.update({
      collection: 'appointments',
      id: human.id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })

    // The stale run must respect the revoked canonical row — any
    // provenance, any status — not mint a fresh live one beside it.
    const result = await writeMigration(payload, plan)
    expect(result.created).toBe(0)
    expect(await appointmentCount(account)).toBe(1)
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect((docs[0] as any).status).toBe('revoked')
    expect((docs[0] as any).evidence).toBe('Recorded directly by Council.')
    expect((await accessFor(account)).capabilities).not.toContain('partnership.review')
  })

  it('serialises a concurrent human grant — the write lock is provably held', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })

    // Pause migration inside the write transaction — reads done, locks held.
    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const writeP = writeMigration(payload, plan, {
      hooks: {
        beforeCreate: async () => {
          pauseReached()
          await resumeGate
        },
      },
    })
    await atPause

    // A human grant for the same tuple must block on the shared lock —
    // verified at the database: pg_locks shows the writer queued on the
    // account's advisory key before we release the pause.
    const { grantAppointment } = await import('@/lib/appointmentService')
    const req = { payload, headers: new Headers() } as any
    let humanSettled = false
    const humanP = grantAppointment(req, {
      account: account.id,
      appointmentRole: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
      evidence: 'Direct Council grant.',
    } as any).finally(() => {
      humanSettled = true
    })
    await waitForAdvisoryWaiter(account.id)
    expect(humanSettled).toBe(false)

    release()
    const result = await writeP
    expect(result.created).toBe(1)
    // The grant then runs — and the active-unique index rejects the
    // duplicate rather than interleaving a second row.
    await expect(humanP).rejects.toThrow(/already holds|duplicate/i)
    expect(await appointmentCount(account)).toBe(1)
  })

  it('serialises a concurrent source revocation — the cascade converges on ended', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    const { account: admin } = await provisionAccount({ role: 'admin' })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })

    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const writeP = writeMigration(payload, plan, {
      hooks: {
        beforeCreate: async () => {
          pauseReached()
          await resumeGate
        },
      },
    })
    await atPause

    // A human revokes the source ledger row mid-write — under the shared
    // lock order it queues on the account's advisory lock (before its own
    // FOR SHARE reads), verified in pg_locks.
    const { revoke } = await import('@/modules/platform/service')
    let humanSettled = false
    const humanP = revoke(
      { id: String(admin.id), role: 'admin' },
      String(src.id),
      'Mandate withdrawn by the responsible committee.',
    ).finally(() => {
      humanSettled = true
    })
    await waitForAdvisoryWaiter(account.id)
    expect(humanSettled).toBe(false)

    release()
    await writeP
    await humanP
    // Both orders converge on "ended": the revoke cascade ends the
    // migration-linked appointment even though it committed first.
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect((docs[0] as any).status).toBe('revoked')
    const { docs: ledger } = await payload.find({
      collection: 'assignments',
      where: { id: { equals: src.id } },
      overrideAccess: true,
    })
    expect((ledger[0] as any).status).toBe('revoked')
    expect((await accessFor(account)).capabilities).not.toContain('finance.review')
  })

  it('writes under the live holder when the source account was re-pointed', async () => {
    const { account: stale } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    const { account: live } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    const src = await createAssignment(stale, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [stale.id] })

    // The holder changes after planning: the write must follow the live
    // source row, not the planned account id.
    await payload.update({
      collection: 'assignments',
      id: src.id,
      data: { account: live.id },
      overrideAccess: true,
    })
    const result = await writeMigration(payload, plan)
    expect(result.created).toBe(1)
    expect(await appointmentCount(stale)).toBe(0)
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: live.id } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect((docs[0] as any).appointmentRole).toBe('team.finance')
  })

  it('serialises a self-targeting revocation — permissions() FOR SHARE cannot deadlock', async () => {
    // The admin revokes their OWN source row mid-migration: permissions()
    // takes FOR SHARE on the actor's rows — the very row the migration
    // holds FOR UPDATE. Under the shared lock order (advisory first) this
    // serialises instead of deadlocking on the row-lock queue.
    const { account: admin } = await provisionAccount({
      role: 'admin',
      membershipTrack: 'constituency_work',
    })
    const src = await createAssignment(admin, {
      scopeType: 'team',
      scopeId: 'finance_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [admin.id] })

    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const writeP = writeMigration(payload, plan, {
      hooks: {
        beforeCreate: async () => {
          pauseReached()
          await resumeGate
        },
      },
    })
    await atPause

    const { revoke } = await import('@/modules/platform/service')
    let humanSettled = false
    const humanP = revoke(
      { id: String(admin.id), role: 'admin' },
      String(src.id),
      'Withdrawing my own mandate for rotation.',
    ).finally(() => {
      humanSettled = true
    })
    // The self-revoke waits on the advisory lock before its FOR SHARE
    // reads can touch the locked row — no lock-order cycle.
    await waitForAdvisoryWaiter(admin.id)
    expect(humanSettled).toBe(false)

    release()
    await writeP
    await humanP
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: admin.id } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect((docs[0] as any).status).toBe('revoked')
    expect((await accessFor(admin)).capabilities).not.toContain('finance.review')
  })

  it('serialises a self-targeting assignment — actor and target share one lock key', async () => {
    // The admin records a mandate on their OWN account while the migration
    // holds that account's advisory lock and a FOR UPDATE on their ledger
    // row. assign() locks {actor, target} (deduplicated to one key) before
    // permissions()' FOR SHARE on the actor's rows — so it queues on the
    // advisory lock instead of forming a row-lock cycle.
    const { account: admin } = await provisionAccount({
      role: 'admin',
      membershipTrack: 'constituency_work',
    })
    await createAssignment(admin, {
      scopeType: 'team',
      scopeId: 'partnerships_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [admin.id] })

    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const writeP = writeMigration(payload, plan, {
      hooks: {
        beforeCreate: async () => {
          pauseReached()
          await resumeGate
        },
      },
    })
    await atPause

    const { assign } = await import('@/modules/platform/service')
    let humanSettled = false
    const humanP = assign(
      { id: String(admin.id), role: 'admin' },
      {
        accountId: String(admin.id),
        scopeType: 'team',
        scopeId: 'membership_team',
        role: 'member',
        startsAt: iso(-86400000),
        endsAt: iso(86400000),
        evidence: 'Recording my own team mandate per the committee minutes.',
      },
    ).finally(() => {
      humanSettled = true
    })
    // Queued on the same advisory key — verified in pg_locks, not timing.
    await waitForAdvisoryWaiter(admin.id)
    expect(humanSettled).toBe(false)

    release()
    await writeP
    await humanP
    // Both mandates exist: the migrated partnerships row and the direct
    // membership assignment — serialised, not interleaved or deadlocked.
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: admin.id }, status: { equals: 'active' } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(2)
    const roles = docs.map((d: any) => d.appointmentRole).sort()
    expect(roles).toEqual(['team.membership', 'team.partnerships'])
    const access = await accessFor(admin)
    expect(access.capabilities).toContain('partnership.review')
    expect(access.capabilities).toContain('membership.review')
  })

  it('serialises concurrent writes — two overlapping runs create one row', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'comms_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const planA = await planMigration(payload, { accountIds: [account.id] })
    const planB = await planMigration(payload, { accountIds: [account.id] })
    const [a, b] = await Promise.all([
      writeMigration(payload, planA),
      writeMigration(payload, planB),
    ])
    // Exactly one write wins; the loser is stopped by the in-transaction
    // re-check or the source-unique index — never both creating a row.
    expect(a.created + b.created).toBe(1)
    expect(await appointmentCount(account)).toBe(1)
    expect((await accessFor(account)).capabilities).toContain('content.review')
  })
})

describe('admin team-role endpoint', () => {
  async function setTeamRole(
    cookie: string,
    accountId: number,
    teamRole: string,
    enabled: boolean,
  ) {
    return api(`/member/admin/accounts/${accountId}/team-role`, {
      method: 'POST',
      cookie,
      body: JSON.stringify({
        teamRole,
        enabled,
        reason: 'Mandate rotation recorded in committee minutes.',
      }),
    })
  }

  it('grants and removes team authority through canonical appointments', async () => {
    const admin = await session({ role: 'admin' })
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })

    // Enable → a canonical appointment is created, not a ledger row.
    const on = await setTeamRole(admin.cookie, account.id, 'membership_team', true)
    expect(on.status).toBe(200)
    const payload = await testPayload()
    const { docs: appts } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(appts).toHaveLength(1)
    expect((appts[0] as any).appointmentRole).toBe('team.membership')
    expect((await accessFor(account)).capabilities).toContain('membership.review')

    // Disable → the appointment is revoked, authority gone.
    const off = await setTeamRole(admin.cookie, account.id, 'membership_team', false)
    expect(off.status).toBe(200)
    expect((await accessFor(account)).capabilities).not.toContain('membership.review')
    const { docs: after } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect((after[0] as any).status).toBe('revoked')
  })

  it('removes authority created by migration and by direct grant alike', async () => {
    const admin = await session({ role: 'admin' })
    const payload = await testPayload()

    // Source 1: legacy row migrated into an appointment.
    const { account: migrated } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    await createAssignment(migrated, {
      scopeType: 'team',
      scopeId: 'membership_team',
      role: 'member',
    })
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    await writeMigration(payload, await planMigration(payload, { accountIds: [migrated.id] }))
    expect((await accessFor(migrated)).capabilities).toContain('membership.review')

    // Source 2: a direct canonical grant, no ledger history.
    const { account: direct } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    const { grantAppointment } = await import('@/lib/appointmentService')
    await grantAppointment(
      { payload, headers: new Headers() } as any,
      {
        account: direct.id,
        appointmentRole: 'team.membership',
        scopeType: 'team',
        scopeId: 'membership_team',
        evidence: 'Recorded directly by Council.',
      } as any,
    )
    expect((await accessFor(direct)).capabilities).toContain('membership.review')

    // The same endpoint removes both.
    for (const account of [migrated, direct]) {
      const res = await setTeamRole(admin.cookie, account.id, 'membership_team', false)
      expect(res.status).toBe(200)
      expect((await accessFor(account)).capabilities).not.toContain('membership.review')
      const { docs } = await payload.find({
        collection: 'appointments',
        where: { account: { equals: account.id } },
        overrideAccess: true,
      })
      expect(docs.every((d: any) => d.status === 'revoked')).toBe(true)
    }
  })

  it('removes legacy-only authority that was never migrated', async () => {
    const admin = await session({ role: 'admin' })
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'membership_team',
      role: 'member',
    })
    const payload = await testPayload()

    // The unmigrated ledger row still grants authority today.
    expect((await accessFor(account)).capabilities).toContain('membership.review')

    const res = await setTeamRole(admin.cookie, account.id, 'membership_team', false)
    expect(res.status).toBe(200)
    // No appointment exists to revoke — the legacy row itself must end.
    expect((await accessFor(account)).capabilities).not.toContain('membership.review')
    const { docs: appts } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(appts).toHaveLength(0)
    const { docs: ledger } = await payload.find({
      collection: 'assignments',
      where: { id: { equals: src.id } },
      overrideAccess: true,
    })
    expect((ledger[0] as any).status).toBe('revoked')
  })

  it('removal racing a migration waits on the shared lock and still ends both rows', async () => {
    const admin = await session({ role: 'admin' })
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'membership_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })

    // Pause the migration inside its write transaction — the account's
    // advisory lock and the source row lock are held.
    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const writeP = writeMigration(payload, plan, {
      hooks: {
        beforeCreate: async () => {
          pauseReached()
          await resumeGate
        },
      },
    })
    await atPause

    // The removal must queue on the advisory lock BEFORE reading state —
    // verified as a real not-granted waiter in pg_locks.
    let settled = false
    const removeP = setTeamRole(admin.cookie, account.id, 'membership_team', false).finally(() => {
      settled = true
    })
    await waitForAdvisoryWaiter(account.id)
    expect(settled).toBe(false)

    release()
    await writeP
    const res = await removeP
    expect(res.status).toBe(200)
    // The removal ran after the migration commit: it revokes the fresh
    // appointment AND ends the source row — nothing grants afterwards.
    const { docs: appts } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(appts).toHaveLength(1)
    expect((appts[0] as any).status).toBe('revoked')
    const { docs: ledger } = await payload.find({
      collection: 'assignments',
      where: { id: { equals: src.id } },
      overrideAccess: true,
    })
    expect((ledger[0] as any).status).toBe('revoked')
    expect((await accessFor(account)).capabilities).not.toContain('membership.review')
  })
})

describe('membership exit atomicity', () => {
  it('a grant arriving between the exit sweep and the status change cannot slip through', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const src = await createAssignment(account, {
      scopeType: 'team',
      scopeId: 'safeguarding_team',
      role: 'member',
    })
    const payload = await testPayload()
    const { applyMembershipTransition } = await import('@/endpoints/membership')

    // Pause inside the transition transaction: the sweep has run, the
    // status change has NOT yet committed — the window a racing grant
    // would previously have slipped through.
    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const transitionP = applyMembershipTransition(
      { payload, headers: new Headers() } as any,
      account.id,
      {
        accountFields: {
          membershipStatus: 'expired',
          membershipEndedAt: iso(0),
          membershipEndReason: 'resigned',
          constituencyWorkStatus: '',
        },
        handover: { reason: 'resignation', scopeLabel: 'Membership' },
        actor: account,
        auditEntry: () => ({
          action: 'membership.resigned',
          targetType: 'account',
          targetId: String(account.id),
        }),
      },
      {
        afterSweep: () => {
          pauseReached()
          return resumeGate
        },
      },
    )
    await atPause

    // The grant queues on the account's advisory lock — pg_locks proves it —
    // then re-verifies eligibility against the committed post-exit state.
    const { grantAppointment } = await import('@/lib/appointmentService')
    const grantP = grantAppointment(
      { payload, headers: new Headers() } as any,
      {
        account: account.id,
        appointmentRole: 'team.safeguarding',
        scopeType: 'team',
        scopeId: 'safeguarding_team',
        evidence: 'Committee mandate recorded during the exit window.',
      } as any,
    )
    await waitForAdvisoryWaiter(account.id)

    release()
    await transitionP
    await expect(grantP).rejects.toThrow(/constituency work/i)

    // The whole transition committed atomically: swept rows and the status
    // change landed together, and the grant left nothing behind.
    const { docs: appts } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(appts).toHaveLength(0)
    const { docs: ledger } = await payload.find({
      collection: 'assignments',
      where: { id: { equals: src.id } },
      overrideAccess: true,
    })
    expect((ledger[0] as any).status).toBe('expired')
    const holder = await payload.findByID({
      collection: 'accounts',
      id: account.id,
      overrideAccess: true,
    })
    expect((holder as any).membershipStatus).toBe('expired')
    expect((await accessFor(account)).capabilities).not.toContain('safeguarding.case')
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

  it('reports an unverified title for review and never grants it', async () => {
    const { account } = await provisionAccount({
      role: 'focal_point',
      membershipTrack: 'constituency_work',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    // The title alone is not election evidence: review-only, no appointment.
    expect(plan.focalVerified).toHaveLength(0)
    expect(plan.focalUnverified.map((a: any) => a.id)).toContain(account.id)
    const result = await writeMigration(payload, plan)
    expect(result.focalCreated).toBe(0)

    const { totalDocs } = await payload.count({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(0)
    const access = await accessFor(account)
    expect(access.councilSeats).toEqual([])
    expect(access.capabilities).not.toContain('council.vote')
  })

  it('rejects focal evidence without real term dates or a reference', async () => {
    const { account } = await provisionAccount({
      role: 'focal_point',
      membershipTrack: 'constituency_work',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })

    // Open-ended: no endsAt → rejected.
    let result = await writeMigration(payload, plan, {
      focalEvidence: new Map([[account.id, { startsAt: iso(-86400000) } as any]]),
    })
    expect(result.focalCreated).toBe(0)
    expect(result.focalRejected[0].reason).toContain('term dates')

    // No verifiable reference → rejected.
    result = await writeMigration(payload, plan, {
      focalEvidence: new Map([
        [account.id, { startsAt: iso(-86400000), endsAt: iso(86400000) } as any],
      ]),
    })
    expect(result.focalCreated).toBe(0)
    expect(result.focalRejected[0].reason).toContain('reference')
    expect((await accessFor(account)).capabilities).not.toContain('council.vote')
  })

  it('migrates an externally evidenced mandate and revokes cleanly', async () => {
    const { account } = await provisionAccount({
      role: 'focal_point',
      membershipTrack: 'constituency_work',
    })
    const payload = await testPayload()
    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    const result = await writeMigration(payload, plan, {
      focalEvidence: new Map([
        [
          account.id,
          {
            reference: 'Council minutes 2025-01 recording the Focal Point appointment',
            startsAt: iso(-86400000),
            endsAt: iso(86400000 * 365),
          },
        ],
      ]),
    })
    expect(result.focalCreated).toBe(1)
    expect(result.focalRejected).toHaveLength(0)

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

  it('verifies an election reference against a completed focal_point election', async () => {
    const { account } = await provisionAccount({
      role: 'focal_point',
      membershipTrack: 'constituency_work',
    })
    const payload = await testPayload()
    const election = await payload.create({
      collection: 'elections',
      data: {
        title: 'Focal Point election',
        kind: 'focal_point',
        status: 'completed',
        races: [{ slug: 'global', label: 'Global Focal Point' }],
      } as any,
      overrideAccess: true,
    })
    const candidate = await payload.create({
      collection: 'election-candidates',
      data: {
        election: election.id,
        race: 'global',
        account: account.id,
        statement: 'Fictional test candidacy statement.',
        status: 'screened_in',
        nominatedAt: iso(-86400000),
      } as any,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'elections',
      id: election.id,
      data: { result: { races: { global: { winner: candidate.id } } } } as any,
      overrideAccess: true,
    })

    const { planMigration, writeMigration } = await import('@/lib/appointmentMigration')
    const plan = await planMigration(payload, { accountIds: [account.id] })
    // The election verifies the mandate; the evidence file supplies terms.
    expect(plan.focalVerified.map((v: any) => v.account.id)).toContain(account.id)
    expect(plan.focalUnverified.map((a: any) => a.id)).not.toContain(account.id)

    // A different election id (or none) must not satisfy verification —
    // and the verified election without dates is still refused.
    let result = await writeMigration(payload, plan, {
      focalEvidence: new Map([
        [account.id, { electionId: election.id, startsAt: iso(-86400000) } as any],
      ]),
    })
    expect(result.focalCreated).toBe(0)

    result = await writeMigration(payload, plan, {
      focalEvidence: new Map([
        [
          account.id,
          { electionId: election.id, startsAt: iso(-86400000), endsAt: iso(86400000 * 365) },
        ],
      ]),
    })
    expect(result.focalCreated).toBe(1)
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect((docs[0] as any).appointedVia).toMatchObject({
      source: 'election',
      electionId: election.id,
      race: 'global',
    })
    expect((await accessFor(account)).councilSeats).toContain('focal_point')
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
