// Appointment backfill: converts legacy `assignments` mandate rows into
// canonical `appointments`, and accounts holding the historical
// `focal_point` title into evidenced focal-point appointments.
//
// Guarantees:
// - stable source identity: each written row records its source in
//   `appointedVia` ({ source, assignmentId }) so a repeat run recognises
//   it without touching status or details — including rows a human has
//   since revoked or edited
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
  /** Accounts carrying the focal_point title without an appointment. */
  focalAccounts: any[]
  focalExisting: number
}

export async function planMigration(
  payload: any,
  opts: { accountIds?: number[] } = {},
): Promise<MigrationPlan> {
  const scope = opts.accountIds?.length ? { account: { in: opts.accountIds } } : undefined
  const focalWhere: any = { role: { equals: 'focal_point' } }
  if (opts.accountIds?.length) focalWhere.id = { in: opts.accountIds }
  const [assignments, appointments, focal] = await Promise.all([
    fetchAll(payload, 'assignments', scope),
    fetchAll(payload, 'appointments', scope),
    fetchAll(payload, 'accounts', focalWhere),
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
    focalAccounts: [],
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

  // The historical focal_point account title is migrated into an evidenced
  // appointment (S11) — the title alone no longer grants authority.
  for (const account of focal as any[]) {
    const key = `${account.id}|${appointmentKey('focal_point', 'platform', 'platform')}`
    if (byTuple.has(key)) plan.focalExisting += 1
    else plan.focalAccounts.push(account)
  }

  return plan
}

export interface MigrationResult {
  created: number
  focalCreated: number
  /** Creates skipped because a concurrent run already wrote the active row. */
  conflicts: number
}

export async function writeMigration(payload: any, plan: MigrationPlan): Promise<MigrationResult> {
  let created = 0
  let conflicts = 0
  for (const { row, appointmentRole, status } of plan.creates) {
    const accountId = accountIdOf(row)
    try {
      await payload.create({
        collection: 'appointments',
        data: {
          account: accountId,
          appointmentRole,
          scopeType: normaliseScopeType(row.scopeType),
          scopeId: row.scopeId,
          councilSeat: councilSeatFor(appointmentRole, row as any),
          status,
          startsAt: row.startsAt ?? new Date().toISOString(),
          endsAt: row.endsAt ?? null,
          evidence: row.appointmentEvidence ?? null,
          appointedVia: {
            source: 'assignments_migration',
            assignmentId: row.id,
            assignmentStatus: row.status,
            assignmentRole: row.role,
            assignmentScope: `${row.scopeType}:${row.scopeId}`,
          },
        } as any,
        overrideAccess: true,
      })
      created += 1
    } catch (error: any) {
      // Duplicate active-row conflicts mean the appointment already exists —
      // skip rather than fail the whole run.
      if (/unique|duplicate/i.test(error?.message ?? '')) {
        conflicts += 1
        continue
      }
      throw error
    }
  }

  let focalCreated = 0
  for (const account of plan.focalAccounts) {
    await payload.create({
      collection: 'appointments',
      data: {
        account: account.id,
        appointmentRole: 'focal_point',
        scopeType: 'platform',
        scopeId: 'platform',
        councilSeat: 'focal_point',
        status: 'active',
        startsAt: new Date().toISOString(),
        evidence: 'Migrated from the recorded focal_point account role.',
        appointedVia: { source: 'account_role', detail: 'focal_point title at migration' },
      } as any,
      overrideAccess: true,
    })
    focalCreated += 1
  }

  return { created, focalCreated, conflicts }
}
