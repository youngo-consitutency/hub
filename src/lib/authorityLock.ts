import type { Payload } from 'payload'

// Shared writer coordination for an account's authority records (S11/S13).
//
// Every path that creates or ends a mandate — the assignments backfill,
// grantAppointment/revokeAppointment, and the platform assign()/revoke()
// SQL — takes the same transaction-scoped advisory lock on
// (AUTHORITY_LOCK_NS, accountId). The lock releases automatically at
// commit/rollback, so a migration's check→insert can never interleave with
// a concurrent human grant, revocation or edit: whichever transaction
// commits first wins, and the other sees the result.
//
// Lock ordering contract (deadlock-free). Every coordinated path acquires
// locks in this exact order:
//   1. this advisory lock on EVERY account the transaction may write —
//      always FIRST, in ascending account-id order (actor and target,
//      deduplicated; a self-targeting write takes one key)
//   2. row locks (SELECT ... FOR UPDATE / FOR SHARE reads / UPDATEs)
//   3. writes to `appointments` / `assignments`
//
// Advisory-first is what makes the order complete: permissions() acquires
// FOR SHARE on the actor's own rows before writing, and a FOR SHARE holder
// upgrading to a write waits behind queued FOR UPDATE requests — if the
// advisory lock were taken after row locks, a self-targeting write (or a
// migration holding FOR UPDATE on the actor's row) could form a cycle.
// Multi-key ordering matters the same way: a writer holding FOR SHARE on
// the actor's rows and writing the target's rows could deadlock with the
// mirrored pair (A writes B while B writes A), so both keys are taken up
// front in a fixed order. No transaction ever waits on a row lock while
// holding an advisory key another writer needs to acquire first.
export const AUTHORITY_LOCK_NS = 0x594f48 // 'YOH'

function txHandle(payload: Payload, transactionID: any) {
  const tx = (payload.db as any).sessions?.[transactionID]?.db
  if (!tx) throw new Error('Authority locks require an open database transaction.')
  return tx
}

export async function advisoryAuthorityLock(
  payload: Payload,
  transactionID: any,
  accountId: number,
): Promise<void> {
  if (!Number.isInteger(accountId))
    throw new Error('Authority lock requires an integer account id.')
  await (payload.db as any).execute({
    db: txHandle(payload, transactionID),
    raw: `SELECT pg_advisory_xact_lock(${AUTHORITY_LOCK_NS}, ${accountId})`,
  })
}

// Lock a ledger row for the duration of the current transaction. Any
// concurrent UPDATE/DELETE to the same row waits for us — Postgres row
// locks need no cooperation from the other writer.
export async function lockAssignmentRow(
  payload: Payload,
  transactionID: any,
  assignmentId: number,
): Promise<void> {
  if (!Number.isInteger(assignmentId))
    throw new Error('Row lock requires an integer assignment id.')
  await (payload.db as any).execute({
    db: txHandle(payload, transactionID),
    raw: `SELECT id FROM assignments WHERE id=${assignmentId} FOR UPDATE`,
  })
}
