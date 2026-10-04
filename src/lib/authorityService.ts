import type { PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
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
import type { Doc, AccountLike, AnyValue } from './domain'

// Writes to `authority-records`. Grants validate against the role registry
// and are audited; the partial unique index backstops concurrent duplicates.

export interface GrantInput {
  account: number
  role: string
  scopeType?: string
  scopeId?: string
  startsAt?: Date | string
  endsAt?: Date | string | null
  provenance?: AnyValue
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
  } as Doc

  const lockAccounts: number[] = [input.account]
  if (input.role === 'council.substitute') {
    if (!input.substituteFor)
      throw fail.validation({ substituteFor: 'A substitute covers a principal appointment.' })
    const principal = await req.payload
      .findByID({ collection: 'authority-records', id: input.substituteFor, overrideAccess: true })
      .catch(() => {
        throw fail.notFound('Principal appointment not found.')
      })
    row.substituteFor = principal.id
    const principalAccount = (principal.account as Doc)?.id ?? principal.account
    if (Number.isInteger(principalAccount)) lockAccounts.push(principalAccount)
  } else {
    row.councilSeat = councilSeatFor(input.role, { scopeId, councilSeat: null })
  }

  // Create + audit commit atomically under the shared lock. Substitute
  // grants also lock the PRINCIPAL's account — revoking the covered seat is
  // an authority write on that account, so both keys are held (ascending)
  // before re-validating the principal inside the transaction.
  try {
    return await withAuthorityLock(req, lockAccounts, async () => {
      if (input.role === 'council.substitute') {
        const principal = await req.payload
          .findByID({
            collection: 'authority-records',
            id: row.substituteFor,
            overrideAccess: true,
            req,
          })
          .catch(() => {
            throw fail.notFound('Principal appointment not found.')
          })
        if (!recordCurrent(principal) || principal.role === 'council.substitute')
          throw fail.conflict(
            'invalid_principal',
            'The principal record is not a current seat holder.',
          )
        if (!principal.councilSeat)
          throw fail.conflict('no_seat', 'The principal record does not hold a Council seat.')
        row.councilSeat = principal.councilSeat
        row.scopeId = `seat:${principal.councilSeat}`
      }
      // Eligibility is verified under the lock — concurrent exits take the
      // same lock, so this check is what the grant commits against.
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
        data: row as RequiredDataFromCollectionSlug<'authority-records'>,
        overrideAccess: true,
        req,
      })
      await audit(
        req,
        { id: input.recordedBy ?? input.account },
        {
          action: 'authority.granted',
          targetType: 'authority_record',
          targetId: String(created.id),
          reason: `${input.role} on ${scopeType}:${scopeId}`,
          after: { account: input.account, endsAt: row.endsAt },
        },
      )
      return created
    })
  } catch (error: AnyValue) {
    // The partial unique index guards concurrent grants; Payload wraps the
    // violation in a ValidationError — check the whole error chain.
    const text = [error?.message, error?.cause?.message].filter(Boolean).join(' ')
    const uniqueViolation = (error?.data?.errors ?? []).some(
      (e: AnyValue) => e.tableName === 'authority_records' && /unique/i.test(e.message ?? ''),
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

// The revocation write. Callers must hold the account's advisory lock —
// revokeAuthority does so; composite flows call this directly to share one
// lock scope.
export async function revokeAuthorityInTx(
  req: PayloadRequest,
  recordId: number,
  actor: AccountLike,
  reason: string,
) {
  const fresh = await req.payload.findByID({
    collection: 'authority-records',
    id: recordId,
    overrideAccess: true,
    req,
  })
  if ((fresh as Doc).status !== 'active')
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
  })
  return updated
}

export async function revokeAuthority(
  req: PayloadRequest,
  recordId: number,
  actor: AccountLike,
  reason: string,
) {
  if (!reason || reason.trim().length < 8)
    throw fail.validation({ reason: 'Give a reason of at least 8 characters.' })
  const row = await req.payload
    .findByID({ collection: 'authority-records', id: recordId, overrideAccess: true })
    .catch(() => {
      throw fail.notFound('Authority record not found.')
    })
  if ((row as Doc).status !== 'active')
    throw fail.conflict('invalid_phase', 'This record is no longer active.')
  // Serialise before re-checking — racing revoke/re-grant must not both win.
  const lockAccount =
    typeof (row as Doc).account === 'object' ? (row as Doc).account.id : (row as Doc).account
  return withAuthorityLock(req, lockAccount, () =>
    revokeAuthorityInTx(req, recordId, actor, reason),
  )
}
