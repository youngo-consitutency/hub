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
// Lock ordering contract (deadlock-free):
//   1. row locks on `assignments` source rows (SELECT ... FOR UPDATE)
//   2. this advisory lock
//   3. writes to `appointments`
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
