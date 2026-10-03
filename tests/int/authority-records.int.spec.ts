import { describe, it, expect } from 'vitest'

import { provisionAccount, testPayload } from './provision'

// Authority-store regression coverage: the shared permission model derives
// every capability and Council seat from `authority-records` — the single
// store for mandates and participation. Legacy role spellings resolve
// through one explicit map; unmapped strings are denied, never widened.
// All records are generated at runtime; nothing about real people is
// embedded here.

const NOW = Date.now()
const iso = (ms: number) => new Date(NOW + ms).toISOString()

async function accessFor(account: any) {
  const payload = await testPayload()
  const { getAccessProfile } = await import('@/lib/access')
  return getAccessProfile({ payload } as any, account)
}

async function createRecord(account: any, data: Record<string, any>) {
  const payload = await testPayload()
  return payload.create({
    collection: 'authority-records',
    data: {
      account: account.id,
      kind: 'mandate',
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

describe('record-derived permissions', () => {
  it('grants a GCT record exactly its responsibility area', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'constituency_work',
      records: [{ role: 'gct.finance', scopeType: 'team', scopeId: 'gct' }],
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

  it('recognises a Council-seat record consistently', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'constituency_work',
      records: [{ role: 'wg.contact_point', scopeType: 'working_group', scopeId: 'finance' }],
    })
    const access = await accessFor(account)
    expect(access.councilSeats).toEqual(['wg:finance'])
    expect(access.capabilities).toContain('council.vote')
    expect(access.capabilities).toContain('wg.manage:finance')
  })

  it('recognises a recorded substitute for the seat it covers only', async () => {
    const payload = await testPayload()
    const { grantAuthority } = await import('@/lib/authorityService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const principal = await grantAuthority(req, {
      account: account.id,
      role: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: 'oceans',
    })
    const { account: deputy } = await provisionAccount({
      membershipTrack: 'constituency_work',
    })
    await grantAuthority(req, {
      account: deputy.id,
      role: 'council.substitute',
      scopeType: 'platform',
      scopeId: 'platform',
      substituteFor: (principal as any).id,
    })
    const access = await accessFor(deputy)
    // The seat key is the principal's — a substitute cannot mint a new seat.
    expect(access.councilSeats).toEqual(['wg:oceans'])
  })

  it('resolves recorded legacy role strings and denies unmapped ones', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    // Rows written before the single-store migration keep their recorded
    // spelling; the resolver maps them (or reports them unmapped).
    await createRecord(account, {
      scopeType: 'team',
      scopeId: 'election_facilitation',
      role: 'member',
    })
    await createRecord(account, {
      scopeType: 'body',
      scopeId: 'ancient-committee',
      role: 'chairperson', // no explicit mapping → denied
    })
    const access = await accessFor(account)
    expect(access.capabilities).toContain('election.facilitate')
    expect(access.capabilities).not.toContain('body.manage:ancient-committee')
    expect(access.unmappedRecords).toBe(1)
  })

  it('gives a plain member no authority beyond base capabilities', async () => {
    const { account } = await provisionAccount({})
    const access = await accessFor(account)
    expect(access.councilSeats).toEqual([])
    expect(access.capabilities).not.toContain('platform.manage')
    expect(access.capabilities).not.toContain('accounts.manage')
    expect(access.capabilities).not.toContain('council.vote')
    expect(access.capabilities).not.toContain('selection.manage')
    expect(access.capabilities).not.toContain('safeguarding.case')
    expect(access.teamRoles).toEqual([])
  })

  it('gives a focal point platform operations without team memberships', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'constituency_work',
      records: [{ role: 'focal_point', scopeType: 'platform', scopeId: 'platform' }],
    })
    const access = await accessFor(account)
    expect(access.capabilities).toContain('platform.manage')
    expect(access.capabilities).toContain('accounts.manage')
    expect(access.capabilities).toContain('audit.read')
    expect(access.councilSeats).toContain('focal_point')
    expect(access.capabilities).not.toContain('safeguarding.case')
    expect(access.capabilities).not.toContain('finance.review')
  })

  it('suppresses CW-gated records while membership is inactive', async () => {
    const { account } = await provisionAccount({
      membershipTrack: 'network', // record exists but grants nothing
      records: [{ role: 'team.selections', scopeType: 'team', scopeId: 'selection_team' }],
    })
    const access = await accessFor(account)
    expect(access.capabilities).not.toContain('selection.manage')
    expect(access.records.map((a) => a.role)).toContain('team.selections')
  })

  it('honours record windows and revocation', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()

    const future = await createRecord(account, {
      role: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
      startsAt: iso(86400000),
    })
    const lapsed = await createRecord(account, {
      role: 'team.comms',
      scopeType: 'team',
      scopeId: 'comms_team',
      endsAt: iso(-1),
    })
    const revoked = await createRecord(account, {
      role: 'team.reforms',
      scopeType: 'team',
      scopeId: 'reforms_team',
    })
    await payload.update({
      collection: 'authority-records',
      id: revoked.id,
      data: { status: 'revoked' },
      overrideAccess: true,
    })

    const access = await accessFor(account)
    expect(access.capabilities).not.toContain('finance.review')
    expect(access.capabilities).not.toContain('content.publish')
    expect(access.capabilities).not.toContain('reforms.coordinate')

    // Losing one record preserves the others.
    const live = await createRecord(account, {
      role: 'team.membership',
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

describe('authority service', () => {
  it('grants transactionally and rejects duplicates', async () => {
    const payload = await testPayload()
    const { grantAuthority } = await import('@/lib/authorityService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })

    const first = await grantAuthority(req, {
      account: account.id,
      role: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: 'ace',
      evidence: 'Recorded selection outcome',
    })
    expect((first as any).councilSeat).toBe('wg:ace')

    await expect(
      grantAuthority(req, {
        account: account.id,
        role: 'wg.contact_point',
        scopeType: 'working_group',
        scopeId: 'ace',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('confines a substitute to the covered seat and validates the principal', async () => {
    const payload = await testPayload()
    const { grantAuthority, revokeAuthority } = await import('@/lib/authorityService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const { account: deputy } = await provisionAccount({ membershipTrack: 'constituency_work' })

    const principal = await grantAuthority(req, {
      account: account.id,
      role: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: 'oceans',
    })

    const sub = await grantAuthority(req, {
      account: deputy.id,
      role: 'council.substitute',
      scopeType: 'platform',
      scopeId: 'platform',
      substituteFor: (principal as any).id,
    })
    // The row keeps the platform scope — the covered seat is carried by
    // councilSeat alone, so the substitute can never inherit the
    // principal's participation scopes.
    expect((sub as any).scopeType).toBe('platform')
    expect((sub as any).scopeId).toBe('seat:wg:oceans')
    expect((sub as any).councilSeat).toBe('wg:oceans')

    const access = await accessFor(deputy)
    expect(access.councilSeats).toEqual(['wg:oceans'])
    expect(access.wgAssignments ?? []).not.toContainEqual(
      expect.objectContaining({ wgSlug: 'oceans' }),
    )
    expect(access.bodyScopes ?? []).not.toContain('oceans')

    // A substitute cannot cover another substitute.
    const { account: second } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await expect(
      grantAuthority(req, {
        account: second.id,
        role: 'council.substitute',
        scopeType: 'platform',
        scopeId: 'platform',
        substituteFor: (sub as any).id,
      }),
    ).rejects.toMatchObject({ status: 409 })

    // Nor a principal whose mandate has ended.
    const { account: actor } = await provisionAccount({})
    await revokeAuthority(req, (principal as any).id, actor, 'Term ended.')
    const { account: third } = await provisionAccount({ membershipTrack: 'constituency_work' })
    await expect(
      grantAuthority(req, {
        account: third.id,
        role: 'council.substitute',
        scopeType: 'platform',
        scopeId: 'platform',
        substituteFor: (principal as any).id,
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('refuses a CW-gated mandate for a Network member', async () => {
    const payload = await testPayload()
    const { grantAuthority } = await import('@/lib/authorityService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'network' })
    await expect(
      grantAuthority(req, {
        account: account.id,
        role: 'gct.coordinator',
        scopeType: 'team',
        scopeId: 'gct',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('records revocation with a reason and blocks double revocation', async () => {
    const payload = await testPayload()
    const { grantAuthority, revokeAuthority } = await import('@/lib/authorityService')
    const req = { payload, headers: new Headers() } as any
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const { account: actor } = await provisionAccount({})
    const row = await grantAuthority(req, {
      account: account.id,
      role: 'team.data_controller',
      scopeType: 'team',
      scopeId: 'data_controller',
    })
    const revoked = await revokeAuthority(
      req,
      (row as any).id,
      actor,
      'Mandate ended, handover complete.',
    )
    expect((revoked as any).status).toBe('revoked')
    await expect(
      revokeAuthority(req, (row as any).id, actor, 'Mandate ended, handover complete.'),
    ).rejects.toMatchObject({ status: 409 })
    const access = await accessFor(account)
    expect(access.capabilities).not.toContain('privacy.manage')
  })

  it('serialises a concurrent grant — the shared advisory lock is provably held', async () => {
    const payload = await testPayload()
    const { grantAuthority } = await import('@/lib/authorityService')
    const { withAuthorityLock } = await import('@/lib/authorityLock')
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })

    // Hold the account's authority lock inside a transaction; a grant for
    // the same account must queue on it — verified in pg_locks.
    const holderReq = { payload, headers: new Headers() } as any
    let pauseReached!: () => void
    const atPause = new Promise<void>((r) => (pauseReached = r))
    let release!: () => void
    const resumeGate = new Promise<void>((r) => (release = r))
    const holderP = withAuthorityLock(holderReq, account.id, async () => {
      pauseReached()
      await resumeGate
    })
    await atPause

    const req = { payload, headers: new Headers() } as any
    let grantSettled = false
    const grantP = grantAuthority(req, {
      account: account.id,
      role: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
      evidence: 'Direct Council grant.',
    }).finally(() => {
      grantSettled = true
    })
    await waitForAdvisoryWaiter(account.id)
    expect(grantSettled).toBe(false)

    release()
    await holderP
    const granted = await grantP
    expect((granted as any).role).toBe('team.finance')
    expect((await accessFor(account)).capabilities).toContain('finance.review')
  })

  it('the active-unique index admits exactly one of two overlapping grants', async () => {
    const payload = await testPayload()
    const { grantAuthority } = await import('@/lib/authorityService')
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const input = {
      account: account.id,
      role: 'team.reforms',
      scopeType: 'team',
      scopeId: 'reforms_team',
    }
    const results = await Promise.allSettled([
      grantAuthority({ payload, headers: new Headers() } as any, input),
      grantAuthority({ payload, headers: new Headers() } as any, input),
    ])
    const ok = results.filter((r) => r.status === 'fulfilled')
    const dup = results.filter(
      (r) => r.status === 'rejected' && (r as PromiseRejectedResult).reason?.status === 409,
    )
    expect(ok).toHaveLength(1)
    expect(dup).toHaveLength(1)
    const { totalDocs } = await payload.count({
      collection: 'authority-records',
      where: { account: { equals: account.id } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })
})

describe('provenance', () => {
  it('is write-once — an edit cannot rewrite how the record was made', async () => {
    const { account } = await provisionAccount({ membershipTrack: 'constituency_work' })
    const payload = await testPayload()
    const row = await createRecord(account, {
      role: 'team.finance',
      scopeType: 'team',
      scopeId: 'finance_team',
      provenance: { source: 'council_minutes', ref: 'fixture' },
    })
    await payload.update({
      collection: 'authority-records',
      id: row.id,
      data: { provenance: { source: 'forged' } },
      overrideAccess: true,
    })
    const after = await payload.findByID({
      collection: 'authority-records',
      id: row.id,
      overrideAccess: true,
    })
    expect((after as any).provenance.source).toBe('council_minutes')
  })
})
