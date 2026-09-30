import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { isCwActive } from './accounts'
import { APPOINTMENT_ROLES, councilSeatFor, normaliseScopeType } from './appointments'
import { advisoryAuthorityLock } from './authorityLock'
import { audit } from './audit'

// Writes to the `appointments` collection. Every grant is validated against
// the appointment registry (scope type, term window, CW membership where the
// role demands it) and audited; the database's partial unique index is the
// backstop against duplicate active appointments under concurrency.

export interface GrantInput {
  account: number
  appointmentRole: string
  scopeType?: string
  scopeId?: string
  startsAt?: Date | string
  endsAt?: Date | string | null
  appointedVia?: Record<string, any>
  appointedBy?: number
  evidence?: string
  substituteFor?: number
}

export async function grantAppointment(req: PayloadRequest, input: GrantInput) {
  const spec = APPOINTMENT_ROLES[input.appointmentRole]
  if (!spec) throw fail.validation({ appointmentRole: 'Unknown appointment role.' })
  // Input accepts either spelling; the stored value is canonical
  // ('organisation'), matching the collection enum.
  const scopeType = normaliseScopeType(input.scopeType ?? spec.scopeTypes[0])
  if (!spec.scopeTypes.includes(scopeType))
    throw fail.validation({
      scopeType: `${input.appointmentRole} cannot be scoped to ${scopeType}.`,
    })
  const scopeId = String(input.scopeId ?? 'platform').trim()
  if (!scopeId) throw fail.validation({ scopeId: 'Required.' })

  const startsAt = new Date(input.startsAt ?? Date.now())
  const endsAt = input.endsAt ? new Date(input.endsAt) : null
  if (endsAt && endsAt.getTime() <= startsAt.getTime())
    throw fail.validation({ endsAt: 'The end must follow the start.' })

  const row = {
    account: input.account,
    appointmentRole: input.appointmentRole,
    scopeType,
    scopeId,
    status: 'active',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    appointedVia: input.appointedVia ?? null,
    appointedBy: input.appointedBy ?? null,
    evidence: input.evidence?.trim() || null,
  } as any

  if (input.appointmentRole === 'council.substitute') {
    if (!input.substituteFor)
      throw fail.validation({ substituteFor: 'A substitute covers a principal appointment.' })
    const principal = await req.payload
      .findByID({ collection: 'appointments', id: input.substituteFor, overrideAccess: true })
      .catch(() => {
        throw fail.notFound('Principal appointment not found.')
      })
    if (!principal.councilSeat)
      throw fail.conflict('no_seat', 'The principal appointment does not hold a Council seat.')
    row.substituteFor = principal.id
    row.councilSeat = principal.councilSeat
    row.scopeType = (principal as any).scopeType
    row.scopeId = (principal as any).scopeId
  } else {
    row.councilSeat = councilSeatFor(input.appointmentRole, { scopeId, councilSeat: null })
  }

  // Create + audit commit together: a grant without its audit record (or
  // vice versa) must never persist.
  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Database transactions are unavailable.')
  req.transactionID = transactionID
  try {
    // Serialise with every other authority write on this account — including
    // the migration backfill — so a grant can never interleave with another
    // writer's check→insert.
    await advisoryAuthorityLock(req.payload, transactionID, input.account)
    // Eligibility is verified UNDER the lock: a concurrent resignation or
    // termination takes the same lock, so the account state checked here is
    // the state the grant commits against.
    const holder = await req.payload
      .findByID({ collection: 'accounts', id: input.account, overrideAccess: true, req })
      .catch(() => {
        throw fail.notFound('Account not found.')
      })
    if (spec.requiresCw && !isCwActive(holder))
      throw fail.conflict(
        'not_constituency_work',
        'This appointment requires active Constituency Work membership.',
      )
    const created = await req.payload.create({
      collection: 'appointments',
      data: row,
      overrideAccess: true,
      req,
    })
    await audit(req, { id: input.appointedBy ?? input.account }, {
      action: 'appointment.granted',
      targetType: 'appointment',
      targetId: String(created.id),
      reason: `${input.appointmentRole} on ${scopeType}:${scopeId}`,
      after: { account: input.account, endsAt: row.endsAt },
    } as any)
    await req.payload.db.commitTransaction(transactionID)
    return created
  } catch (error: any) {
    await req.payload.db.rollbackTransaction(transactionID)
    // The partial unique index (account, role, scopeType, scopeId WHERE
    // status='active') is the guard for concurrent grants; Payload wraps
    // the Postgres violation in a ValidationError, so check the whole
    // error chain for the constraint.
    const text = [error?.message, error?.cause?.message].filter(Boolean).join(' ')
    const uniqueViolation = (error?.data?.errors ?? []).some(
      (e: any) => e.tableName === 'appointments' && /unique/i.test(e.message ?? ''),
    )
    if (
      uniqueViolation ||
      text.includes('appointments_active_scope_unique') ||
      text.includes('duplicate key')
    )
      throw fail.conflict('duplicate_appointment', 'This account already holds that appointment.')
    throw error
  } finally {
    delete req.transactionID
  }
}

export async function revokeAppointment(
  req: PayloadRequest,
  appointmentId: number,
  actor: any,
  reason: string,
) {
  if (!reason || reason.trim().length < 8)
    throw fail.validation({ reason: 'Give a reason of at least 8 characters.' })
  const row = await req.payload
    .findByID({ collection: 'appointments', id: appointmentId, overrideAccess: true })
    .catch(() => {
      throw fail.notFound('Appointment not found.')
    })
  if ((row as any).status !== 'active')
    throw fail.conflict('invalid_phase', 'This appointment is no longer active.')
  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Database transactions are unavailable.')
  req.transactionID = transactionID
  try {
    // Serialise with every other authority write on this account before
    // re-checking: two concurrent revocations (or a revoke racing a
    // re-grant or a migration write) must not both succeed.
    const lockAccount =
      typeof (row as any).account === 'object' ? (row as any).account.id : (row as any).account
    await advisoryAuthorityLock(req.payload, transactionID, lockAccount)
    const fresh = await req.payload.findByID({
      collection: 'appointments',
      id: appointmentId,
      overrideAccess: true,
      req,
    })
    if ((fresh as any).status !== 'active')
      throw fail.conflict('invalid_phase', 'This appointment is no longer active.')
    const updated = await req.payload.update({
      collection: 'appointments',
      id: appointmentId,
      data: { status: 'revoked', endsAt: new Date().toISOString() },
      overrideAccess: true,
      req,
    })
    await audit(req, actor, {
      action: 'appointment.revoked',
      targetType: 'appointment',
      targetId: String(appointmentId),
      reason: reason.trim().slice(0, 500),
    } as any)
    await req.payload.db.commitTransaction(transactionID)
    return updated
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  } finally {
    delete req.transactionID
  }
}
