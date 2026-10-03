import type { Payload, PayloadRequest } from 'payload'

// Shared writer coordination for an account's authority records (S11/S13).
//
// Every path that creates or ends an authority record —
// grantAuthority/revokeAuthority, the platform assign()/revoke() SQL, and
// membership exits — takes the same transaction-scoped advisory lock on
// (AUTHORITY_LOCK_NS, accountId). The lock releases automatically at
// commit/rollback, so a check→insert can never interleave with a
// concurrent grant, revocation or edit: whichever transaction commits
// first wins, and the other sees the result.
//
// Lock ordering contract (deadlock-free). Every coordinated path acquires
// locks in this exact order:
//   1. this advisory lock on EVERY account the transaction may write —
//      always FIRST, in ascending account-id order (actor and target,
//      deduplicated; a self-targeting write takes one key)
//   2. row locks (SELECT ... FOR UPDATE / FOR SHARE reads / UPDATEs)
//   3. writes to `authority_records`
//
// Advisory-first is what makes the order complete: permissions() acquires
// FOR SHARE on the actor's own rows before writing, and a FOR SHARE holder
// upgrading to a write waits behind queued FOR UPDATE requests — if the
// advisory lock were taken after row locks, a self-targeting write (or a
// writer holding FOR UPDATE on the actor's row) could form a cycle.
// Multi-key ordering matters the same way: a writer holding FOR SHARE on
// the actor's rows and writing the target's rows could deadlock with the
// mirrored pair (A writes B while B writes A), so both keys are taken up
// front in a fixed order. No transaction ever waits on a row lock while
// holding an advisory key another writer needs to acquire first.
export const AUTHORITY_LOCK_NS = 0x594f48 // 'YOH'

/** Look up the underlying DB handle for an open Payload transaction. */
function txHandle(payload: Payload, transactionID: any) {
  const tx = (payload.db as any).sessions?.[transactionID]?.db
  if (!tx) throw new Error('Authority locks require an open database transaction.')
  return tx
}

/** Take the transaction-scoped Postgres advisory lock for an account's authority records. */
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

// Run `fn` inside a transaction that holds the account's advisory
// authority lock — step 1 of the lock order for any caller that does not
// manage its own transaction. When the request already carries a
// transaction the lock is taken on it and `fn` joins it; the caller still
// owns commit/rollback. Locks are transaction-scoped, so they release
// automatically at commit/rollback and re-acquiring the same key inside
// one transaction is a no-op. Multiple accounts are locked in ascending
// id order, exactly as the lock-order contract requires.
export async function withAuthorityLock<T>(
  req: PayloadRequest,
  accountId: number | number[],
  fn: () => Promise<T>,
): Promise<T> {
  const accountIds = [...new Set([accountId].flat())].sort((a, b) => a - b)
  const acquire = async (transactionID: any) => {
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
