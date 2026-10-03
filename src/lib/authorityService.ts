import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { isCwActive } from './accounts'
import {
  AUTHORITY_ROLES,
  recordCurrent,
  councilSeatFor,
  normaliseScopeType,
  recordKind,
} from './authority'
import { withAuthorityLock } from './authorityLock'
import { audit } from './audit'

// Writes to the `authority-records` collection. Every grant is validated
// against the role registry (scope type, term window, CW membership where
// the role demands it) and audited; the database's partial unique index is
// the backstop against duplicate active records under concurrency.

export interface GrantInput {
  account: number
  role: string
  scopeType?: string
  scopeId?: string
  startsAt?: Date | string
  endsAt?: Date | string | null
  provenance?: Record<string, any>
  recordedBy?: number
  evidence?: string
  substituteFor?: number
}

export async function grantAuthority(req: PayloadRequest, input: GrantInput) {
  const spec = AUTHORITY_ROLES[input.role]
  if (!spec) throw fail.validation({ role: 'Unknown authority role.' })
  // Input accepts either spelling; the stored value is canonical
  // ('organisation'), matching the collection enum.
  const scopeType = normaliseScopeType(input.scopeType ?? spec.scopeTypes[0])
  if (!spec.scopeTypes.includes(scopeType))
    throw fail.validation({
      scopeType: `${input.role} cannot be scoped to ${scopeType}.`,
    })
  const scopeId = String(input.scopeId ?? 'platform').trim()
  if (!scopeId) throw fail.validation({ scopeId: 'Required.' })

  const startsAt = new Date(input.startsAt ?? Date.now())
  const endsAt = input.endsAt ? new Date(input.endsAt) : null
  if (endsAt && endsAt.getTime() <= startsAt.getTime())
    throw fail.validation({ endsAt: 'The end must follow the start.' })

  const row = {
    account: input.account,
    role: input.role,
    kind: recordKind(scopeType, input.role),
    scopeType,
    scopeId,
    status: 'active',
    startsAt: startsAt.toISOString(),
    endsAt: endsAt?.toISOString() ?? null,
    provenance: input.provenance ?? null,
    recordedBy: input.recordedBy ?? null,
    evidence: input.evidence?.trim() || null,
  } as any

  if (input.role === 'council.substitute') {
    if (!input.substituteFor)
      throw fail.validation({ substituteFor: 'A substitute covers a principal appointment.' })
    const principal = await req.payload
      .findByID({ collection: 'authority-records', id: input.substituteFor, overrideAccess: true })
      .catch(() => {
        throw fail.notFound('Principal appointment not found.')
      })
    if (!recordCurrent(principal as any) || (principal as any).role === 'council.substitute')
      throw fail.conflict('invalid_principal', 'The principal record is not a current seat holder.')
    if (!principal.councilSeat)
      throw fail.conflict('no_seat', 'The principal record does not hold a Council seat.')
    row.substituteFor = principal.id
    row.councilSeat = principal.councilSeat
    row.scopeId = `seat:${principal.councilSeat}`
  } else {
    row.councilSeat = councilSeatFor(input.role, { scopeId, councilSeat: null })
  }

  // Create + audit commit together under the shared authority lock: a
  // grant without its audit record (or vice versa) must never persist,
  // and the check→insert sequence serialises with every other authority
  // writer on the account.
  try {
    return await withAuthorityLock(req, input.account, async () => {
      // Eligibility is verified UNDER the lock: a concurrent resignation or
      // termination takes the same lock, so the account state checked here
      // is the state the grant commits against.
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
        collection: 'authority-records',
        data: row,
        overrideAccess: true,
        req,
      })
      await audit(req, { id: input.recordedBy ?? input.account }, {
        action: 'authority.granted',
        targetType: 'authority_record',
        targetId: String(created.id),
        reason: `${input.role} on ${scopeType}:${scopeId}`,
        after: { account: input.account, endsAt: row.endsAt },
      } as any)
      return created
    })
  } catch (error: any) {
    // The partial unique index (account, role, scopeType, scopeId WHERE
    // status='active') is the guard for concurrent grants; Payload wraps
    // the Postgres violation in a ValidationError, so check the whole
    // error chain for the constraint.
    const text = [error?.message, error?.cause?.message].filter(Boolean).join(' ')
    const uniqueViolation = (error?.data?.errors ?? []).some(
      (e: any) => e.tableName === 'authority_records' && /unique/i.test(e.message ?? ''),
    )
    if (
      uniqueViolation ||
      text.includes('authority_records_active_scope_unique') ||
      text.includes('duplicate key')
    )
      throw fail.conflict('duplicate_record', 'This account already holds that record.')
    throw error
  }
}

// The revocation write itself. Callers must hold the record account's
// advisory lock inside an active transaction — revokeAuthority does that
// for standalone calls; composite flows (the admin team-role endpoint,
// membership exits) call this directly so lookup and revocation share ONE
// lock scope.
export async function revokeAuthorityInTx(
  req: PayloadRequest,
  recordId: number,
  actor: any,
  reason: string,
) {
  const fresh = await req.payload.findByID({
    collection: 'authority-records',
    id: recordId,
    overrideAccess: true,
    req,
  })
  if ((fresh as any).status !== 'active')
    throw fail.conflict('invalid_phase', 'This record is no longer active.')
  const updated = await req.payload.update({
    collection: 'authority-records',
    id: recordId,
    data: { status: 'revoked', endsAt: new Date().toISOString() },
    overrideAccess: true,
    req,
  })
  await audit(req, actor, {
    action: 'authority.revoked',
    targetType: 'authority_record',
    targetId: String(recordId),
    reason: reason.trim().slice(0, 500),
  } as any)
  return updated
}

export async function revokeAuthority(
  req: PayloadRequest,
  recordId: number,
  actor: any,
  reason: string,
) {
  if (!reason || reason.trim().length < 8)
    throw fail.validation({ reason: 'Give a reason of at least 8 characters.' })
  const row = await req.payload
    .findByID({ collection: 'authority-records', id: recordId, overrideAccess: true })
    .catch(() => {
      throw fail.notFound('Authority record not found.')
    })
  if ((row as any).status !== 'active')
    throw fail.conflict('invalid_phase', 'This record is no longer active.')
  // Serialise with every other authority write on this account before
  // re-checking: two concurrent revocations (or a revoke racing a
  // re-grant) must not both succeed.
  const lockAccount =
    typeof (row as any).account === 'object' ? (row as any).account.id : (row as any).account
  return withAuthorityLock(req, lockAccount, () =>
    revokeAuthorityInTx(req, recordId, actor, reason),
  )
}
