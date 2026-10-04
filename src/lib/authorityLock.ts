import type { Payload, PayloadRequest } from 'payload'
import type { Doc, AnyValue } from './domain'

// Shared writer coordination for authority records (S11/S13). Every path
// that creates or ends a record takes the same transaction-scoped advisory
// lock on (AUTHORITY_LOCK_NS, accountId), so a check→insert can never
// interleave with a concurrent write — first commit wins.
//
// Lock order (deadlock-free), always:
//   1. advisory locks on EVERY account the transaction may write —
//      ascending account-id order, deduplicated (self-target = one key)
//   2. row locks (FOR UPDATE / FOR SHARE / UPDATEs)
//   3. writes to `authority_records`
//
// Advisory-first matters: permissions() holds FOR SHARE on the actor's rows
// before writing, so taking the advisory lock after row locks could cycle
// with a self-targeting write. Multi-key ordering closes the mirrored pair
// (A writes B while B writes A). No transaction waits on a row lock while
// holding an advisory key another writer needs first.
export const AUTHORITY_LOCK_NS = 0x594f48 // 'YOH'

function txHandle(payload: Payload, transactionID: AnyValue) {
  const tx = (payload.db as Doc).sessions?.[transactionID]?.db
  if (!tx) throw new Error('Authority locks require an open database transaction.')
  return tx
}

export async function advisoryAuthorityLock(
  payload: Payload,
  transactionID: AnyValue,
  accountId: number,
): Promise<void> {
  if (!Number.isInteger(accountId))
    throw new Error('Authority lock requires an integer account id.')
  await (payload.db as Doc).execute({
    db: txHandle(payload, transactionID),
    raw: `SELECT pg_advisory_xact_lock(${AUTHORITY_LOCK_NS}, ${accountId})`,
  })
}

// Run `fn` inside a transaction holding the account's advisory authority
// lock — lock-order step 1 for callers that don't manage a transaction. An
// existing request transaction is joined (caller still owns commit/rollback).
// Locks release at commit/rollback; re-acquiring the same key inside
// one transaction is a no-op. Multiple accounts are locked in ascending
// id order, exactly as the lock-order contract requires.
export async function withAuthorityLock<T>(
  req: PayloadRequest,
  accountId: number | number[],
  fn: () => Promise<T>,
): Promise<T> {
  const accountIds = [...new Set([accountId].flat())].sort((a, b) => a - b)
  const acquire = async (transactionID: AnyValue) => {
    for (const id of accountIds) await advisoryAuthorityLock(req.payload, transactionID, id)
  }
  if (req.transactionID != null) {
    await acquire(req.transactionID)
    return fn()
  }
  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Database transactions are unavailable.')
  req.transactionID = transactionID
  try {
    await acquire(transactionID)
    const result = await fn()
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  } finally {
    delete req.transactionID
  }
}
