// Appointment backfill: converts legacy `assignments` mandate rows into
// canonical `appointments`. Accounts carrying the historical `focal_point`
// title are NOT migrated automatically — a title is provenance, not election
// evidence. A focal mandate is written only when the caller supplies explicit
// evidence: real term dates plus a verifiable reference (a completed
// focal_point election the account won, or an external appointment record
// such as adopted Council minutes). Unverified titles are reported for
// review and never grant authority.
//
// Guarantees:
// - stable source identity: each written row records its source in
//   `appointedVia` ({ source, assignmentId }) and a database unique index
//   enforces one appointment per source assignment across ALL statuses —
//   overlapping or stale runs cannot duplicate or resurrect a migrated row
// - writes are transactional: every create runs in its own transaction,
//   re-reads the SOURCE assignment (a revoked source writes only a revoked
//   record, never a live grant) and checks ALL canonical appointments
//   matching the resolved tuple — any provenance, any status — so a stale
//   plan can neither resurrect a revoked source nor bypass an independently
//   created and revoked appointment
// - historical status preserved: an inactive/expired/revoked source never
//   becomes a live appointment
// - never overwrites: a canonical row that was NOT produced by this
//   migration (a human grant, another flow) is left alone
// - unmapped rows are reported and denied, never widened

import {
  appointmentKey,
  appointmentState,
  councilSeatFor,
  legacyAppointmentRole,
  normaliseScopeType,
} from './appointments'

const PARTICIPATION_SCOPES = new Set([
  'body',
  'working_group',
  'organisation',
  'operational_team',
  'negotiation_track',
  'negotiation_project',
])

export interface LegacyRow {
  id: number
  account: number | { id: number }
  scopeType: string
  scopeId: string
  role: string
  status: string
  startsAt?: any
  endsAt?: any
  appointmentEvidence?: string | null
}

export function classifyAssignment(row: LegacyRow) {
  const scopeType = normaliseScopeType(row.scopeType)
  const appointmentRole = legacyAppointmentRole(row.scopeType, row.scopeId, row.role)
  if (!appointmentRole) return { kind: 'unmapped' as const }
  // A 'member' row in a member-joinable scope is participation, not a
  // mandate — it stays in the ledger.
  if (row.role === 'member' && PARTICIPATION_SCOPES.has(scopeType))
    return { kind: 'participation' as const, appointmentRole }
  return { kind: 'mandate' as const, appointmentRole }
}

// The migrated appointment keeps the source's lifecycle position: nothing
// dead comes back live.
export function migratedStatus(row: LegacyRow, now = new Date()): string {
  if (row.status !== 'active') {
    return ['expired', 'revoked', 'inactive'].includes(row.status) ? row.status : 'inactive'
  }
  if (row.endsAt && new Date(row.endsAt).getTime() <= now.getTime()) return 'expired'
  return 'active'
}

const accountIdOf = (row: LegacyRow) =>
  typeof row.account === 'object' ? row.account.id : row.account

async function fetchAll(payload: any, collection: string, where?: any) {
  const docs: any[] = []
  let page = 1
  for (;;) {
    const res = await payload.find({
      collection,
      where,
      limit: 500,
      page: page++,
      overrideAccess: true,
      pagination: true,
    })
    docs.push(...res.docs)
    if (!res.hasNextPage) break
  }
  return docs
}

// Completed focal_point elections whose recorded result names winners.
// result.races[race].winner is an election-candidates document id; the
// candidate links to the winning account. This is the only in-database
// verification a focal mandate can carry.
async function verifiedFocalWinners(payload: any) {
  const elections = await fetchAll(payload, 'elections', {
    and: [{ kind: { equals: 'focal_point' } }, { status: { equals: 'completed' } }],
  })
  if (!elections.length) return new Map<number, { electionId: number; race: string }>()
  const candidates = await fetchAll(payload, 'election-candidates', {
    election: { in: elections.map((e: any) => e.id) },
  })
  const candById = new Map(candidates.map((c: any) => [String(c.id), c]))
  const winners = new Map<number, { electionId: number; race: string }>()
  for (const e of elections as any[]) {
    for (const [race, r] of Object.entries<any>(e.result?.races ?? {})) {
      const cand = r?.winner != null ? candById.get(String(r.winner)) : undefined
      const acc = cand ? (typeof cand.account === 'object' ? cand.account.id : cand.account) : null
      if (acc != null && !winners.has(acc)) winners.set(acc, { electionId: e.id, race })
    }
  }
  return winners
}

export interface MigrationPlan {
  assignments: number
  mandate: number
  participation: number
  unmapped: LegacyRow[]
  states: Map<string, number>
  /** Mandate rows that would create an appointment on --write. */
  creates: { row: LegacyRow; appointmentRole: string; status: string }[]
  /** Already migrated (source-linked row exists — never touched). */
  alreadyMigrated: number
  /** A canonical row for the same tuple exists from another source —
   *  human changes are never overwritten. */
  existingCanonical: number
  /** Titled accounts backed by a completed focal_point election they won —
   *  still require caller-supplied term dates before any row is written. */
  focalVerified: { account: any; electionId: number; race: string }[]
  /** Titled accounts with no verifiable mandate — reported for review,
   *  never granted authority. */
  focalUnverified: any[]
  /** Titled accounts that already hold a focal_point appointment. */
  focalExisting: number
}

export async function planMigration(
  payload: any,
  opts: { accountIds?: number[] } = {},
): Promise<MigrationPlan> {
  const scope = opts.accountIds?.length ? { account: { in: opts.accountIds } } : undefined
  const focalWhere: any = { role: { equals: 'focal_point' } }
  if (opts.accountIds?.length) focalWhere.id = { in: opts.accountIds }
  const [assignments, appointments, focal, winners] = await Promise.all([
    fetchAll(payload, 'assignments', scope),
    fetchAll(payload, 'appointments', scope),
    fetchAll(payload, 'accounts', focalWhere),
    verifiedFocalWinners(payload),
  ])

  // Index canonical rows by stable source identity and by authority tuple.
  const bySource = new Map<string, any>()
  const byTuple = new Map<string, any>()
  for (const doc of appointments as any[]) {
    const via = doc.appointedVia
    if (via?.source === 'assignments_migration' && via?.assignmentId != null)
      bySource.set(String(via.assignmentId), doc)
    const acc = typeof doc.account === 'object' ? doc.account.id : doc.account
    byTuple.set(`${acc}|${appointmentKey(doc.appointmentRole, doc.scopeType, doc.scopeId)}`, doc)
  }

  const plan: MigrationPlan = {
    assignments: assignments.length,
    mandate: 0,
    participation: 0,
    unmapped: [],
    states: new Map(),
    creates: [],
    alreadyMigrated: 0,
    existingCanonical: 0,
    focalVerified: [],
    focalUnverified: [],
    focalExisting: 0,
  }

  for (const row of assignments as LegacyRow[]) {
    const state = appointmentState(row as any)
    plan.states.set(state, (plan.states.get(state) ?? 0) + 1)
    const c = classifyAssignment(row)
    if (c.kind === 'unmapped') plan.unmapped.push(row)
    else if (c.kind === 'participation') plan.participation += 1
    else {
      plan.mandate += 1
      const acc = accountIdOf(row)
      const key = appointmentKey(c.appointmentRole!, row.scopeType, row.scopeId)
      if (bySource.has(String(row.id))) plan.alreadyMigrated += 1
      else if (byTuple.has(`${acc}|${key}`)) plan.existingCanonical += 1
      else
        plan.creates.push({
          row,
          appointmentRole: c.appointmentRole!,
          status: migratedStatus(row),
        })
    }
  }

  // The historical focal_point title alone grants nothing and migrates
  // nothing: only titles paired with verifiable evidence may become
  // appointments, and even then the caller must supply real term dates.
  for (const account of focal as any[]) {
    const key = `${account.id}|${appointmentKey('focal_point', 'platform', 'platform')}`
    if (byTuple.has(key)) plan.focalExisting += 1
    else if (winners.has(account.id))
      plan.focalVerified.push({
        account,
        electionId: winners.get(account.id)!.electionId,
        race: winners.get(account.id)!.race,
      })
    else plan.focalUnverified.push(account)
  }

  return plan
}

// Evidence required to migrate a focal_point title into an appointment.
// Both term dates are mandatory — an open-ended mandate is never written.
// `electionId` must reference a completed focal_point election whose result
// names the account as a race winner (verified against the database at
// write time). `reference` records an external appointment record (e.g.
// adopted Council minutes) when no election row exists.
export interface FocalEvidence {
  startsAt: string
  endsAt: string
  electionId?: number
  reference?: string
  note?: string
}

export interface MigrationResult {
  created: number
  focalCreated: number
  /** Creates skipped because a concurrent write already recorded the
   *  source or tuple (unique-index backstop). */
  conflicts: number
  /** Creates skipped because the source was migrated after this plan was
   *  built — the stale plan is a no-op, never a resurrection. */
  staleSkipped: number
  /** Focal accounts whose supplied evidence failed verification — nothing
   *  was written for them. */
  focalRejected: { accountId: number; reason: string }[]
}

function isUniqueViolation(error: any): boolean {
  const text = [error?.message, error?.cause?.message].filter(Boolean).join(' ')
  const dataErrors = (error?.data?.errors ?? []).map((e: any) => e?.message ?? '').join(' ')
  return /unique|duplicate/i.test(`${text} ${dataErrors}`)
}

// Verify an election reference against live database state: the election
// must be a completed focal_point election whose result names this account
// as the winner of a race. Performed at write time — never trust the plan.
async function verifyElectionReference(
  payload: any,
  req: any,
  accountId: number,
  electionId: number,
): Promise<{ race: string } | null> {
  const election = await payload
    .findByID({ collection: 'elections', id: electionId, overrideAccess: true, req })
    .catch(() => null)
  if (!election || election.kind !== 'focal_point' || election.status !== 'completed') return null
  for (const [race, r] of Object.entries<any>((election as any).result?.races ?? {})) {
    if (r?.winner == null) continue
    const cand = await payload
      .findByID({ collection: 'election-candidates', id: r.winner, overrideAccess: true, req })
      .catch(() => null)
    const acc = cand ? (typeof cand.account === 'object' ? cand.account.id : cand.account) : null
    if (acc === accountId) return { race }
  }
  return null
}

export async function writeMigration(
  payload: any,
  plan: MigrationPlan,
  opts: { focalEvidence?: Map<number, FocalEvidence> } = {},
): Promise<MigrationResult> {
  const result: MigrationResult = {
    created: 0,
    focalCreated: 0,
    conflicts: 0,
    staleSkipped: 0,
    focalRejected: [],
  }

  // Every create runs in its own transaction with the source identity
  // re-checked inside it. A plan is only a snapshot: a concurrent run, or a
  // human grant/revocation after planning, must leave this run a no-op.
  // The `appointments_migration_source_unique` index is the database
  // backstop for true write races — one appointment per source assignment
  // across every status, so a revoked row can never be recreated.
  const inTransaction = async (work: (req: any) => Promise<void>) => {
    const transactionID = await payload.db.beginTransaction()
    if (transactionID == null) throw new Error('Database transactions are unavailable.')
    const req = { payload, transactionID } as any
    try {
      await work(req)
      await payload.db.commitTransaction(transactionID)
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID)
      throw error
    }
  }

  const accountAppointments = async (req: any, accountId: number) => {
    const { docs } = await payload.find({
      collection: 'appointments',
      where: { account: { equals: accountId } },
      limit: 500,
      overrideAccess: true,
      req,
    })
    return docs as any[]
  }

  for (const { row } of plan.creates) {
    const accountId = accountIdOf(row)
    try {
      await inTransaction(async (req) => {
        // Re-read the SOURCE assignment inside the transaction. The plan
        // snapshot may be stale — a human may have revoked, expired or
        // edited the ledger row since. Everything written here derives
        // from live state, so a revoked source can never be restored as a
        // live appointment.
        const source = await payload
          .findByID({ collection: 'assignments', id: row.id, overrideAccess: true, req })
          .catch(() => null)
        if (!source) {
          result.staleSkipped += 1
          return
        }
        const live = classifyAssignment(source as any as LegacyRow)
        if (live.kind !== 'mandate') {
          // The source was reclassified since planning (role edited to
          // participation or an unmapped value) — do not mint authority it
          // no longer represents.
          result.staleSkipped += 1
          return
        }
        const liveStatus = migratedStatus(source as any as LegacyRow)
        const liveKey = appointmentKey(
          live.appointmentRole!,
          (source as any).scopeType,
          (source as any).scopeId,
        )

        const existing = await accountAppointments(req, accountId)
        if (
          existing.some(
            (d) =>
              d.appointedVia?.source === 'assignments_migration' &&
              String(d.appointedVia?.assignmentId) === String(row.id),
          )
        ) {
          // Source already migrated — including a row a human has since
          // revoked or edited. Never touch it.
          result.staleSkipped += 1
          return
        }
        // Protect every canonical appointment matching the resolved tuple,
        // regardless of provenance or status: an independently created and
        // revoked grant is a human decision a stale plan must not bypass.
        if (
          existing.some(
            (d) => appointmentKey(d.appointmentRole, d.scopeType, d.scopeId) === liveKey,
          )
        ) {
          result.staleSkipped += 1
          return
        }
        await payload.create({
          collection: 'appointments',
          data: {
            account: accountId,
            appointmentRole: live.appointmentRole,
            scopeType: normaliseScopeType((source as any).scopeType),
            scopeId: (source as any).scopeId,
            councilSeat: councilSeatFor(live.appointmentRole!, source as any),
            status: liveStatus,
            startsAt: (source as any).startsAt ?? new Date().toISOString(),
            endsAt: (source as any).endsAt ?? null,
            evidence: (source as any).appointmentEvidence ?? null,
            appointedVia: {
              source: 'assignments_migration',
              assignmentId: row.id,
              assignmentStatus: (source as any).status,
              assignmentRole: (source as any).role,
              assignmentScope: `${(source as any).scopeType}:${(source as any).scopeId}`,
            },
          } as any,
          overrideAccess: true,
          req,
        })
        result.created += 1
      })
    } catch (error: any) {
      // The plan was stale in a way the re-check could not see (a true
      // write race): the database rejected the duplicate. Skip it.
      if (isUniqueViolation(error)) {
        result.conflicts += 1
        continue
      }
      throw error
    }
  }

  // Focal mandates: every titled account in the plan is a candidate for
  // migration only through explicit, verified evidence. No evidence, no
  // grant — the title is reported for review instead.
  const focalCandidates = [
    ...plan.focalVerified.map((v) => ({ account: v.account, verifiedElection: v })),
    ...plan.focalUnverified.map((account) => ({ account, verifiedElection: null as any })),
  ]
  for (const { account, verifiedElection } of focalCandidates) {
    const evidence = opts.focalEvidence?.get(account.id)
    const reject = (reason: string) => result.focalRejected.push({ accountId: account.id, reason })
    if (!evidence) {
      if (!verifiedElection) continue // unverified titles stay review-only
      reject('no evidence supplied — verified elections still require term dates')
      continue
    }
    const startsAt = evidence.startsAt ? new Date(evidence.startsAt) : null
    const endsAt = evidence.endsAt ? new Date(evidence.endsAt) : null
    if (
      !startsAt ||
      Number.isNaN(startsAt.getTime()) ||
      !endsAt ||
      Number.isNaN(endsAt.getTime())
    ) {
      reject(
        'actual startsAt and endsAt term dates are required — open-ended mandates are not written',
      )
      continue
    }
    if (endsAt.getTime() <= startsAt.getTime()) {
      reject('the term end must follow the term start')
      continue
    }
    try {
      await inTransaction(async (req) => {
        // Any existing focal_point appointment — whatever its provenance or
        // status, including a human-created and revoked one — blocks a
        // migration write. Migration never overrides recorded decisions.
        const existing = (await accountAppointments(req, account.id)).find(
          (d) =>
            d.appointmentRole === 'focal_point' &&
            d.scopeType === 'platform' &&
            d.scopeId === 'platform',
        )
        if (existing) {
          result.staleSkipped += 1
          return
        }
        let appointedVia: Record<string, any>
        if (evidence.electionId != null) {
          const race = await verifyElectionReference(payload, req, account.id, evidence.electionId)
          if (!race) {
            reject(
              `election ${evidence.electionId} is not a completed focal_point election won by this account`,
            )
            return
          }
          appointedVia = {
            source: 'election',
            electionId: evidence.electionId,
            race: race.race,
          }
        } else if (evidence.reference?.trim()) {
          appointedVia = { source: 'external_record', reference: evidence.reference.trim() }
        } else {
          reject('an electionId or external appointment reference is required')
          return
        }
        await payload.create({
          collection: 'appointments',
          data: {
            account: account.id,
            appointmentRole: 'focal_point',
            scopeType: 'platform',
            scopeId: 'platform',
            councilSeat: 'focal_point',
            // A term already over is history, not a live grant.
            status: endsAt.getTime() <= Date.now() ? 'expired' : 'active',
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            evidence:
              evidence.note?.trim() ||
              (evidence.electionId != null
                ? `Recorded from focal_point election ${evidence.electionId}.`
                : `Recorded from ${evidence.reference!.trim()}.`),
            appointedVia,
          } as any,
          overrideAccess: true,
          req,
        })
        result.focalCreated += 1
      })
    } catch (error: any) {
      if (isUniqueViolation(error)) {
        result.conflicts += 1
        continue
      }
      throw error
    }
  }

  return result
}
