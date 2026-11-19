import type { Payload, PayloadRequest } from 'payload'
import type { Doc } from './domain'
import { txHandle, withTransaction } from './pg'

// Shared advisory lock on (AUTHORITY_LOCK_NS, accountId) for every authority write.
// Lock order: advisory locks (ascending account id) first, then row locks, then writes.
export const AUTHORITY_LOCK_NS = 0x594f48 // 'YOH'

async function advisoryAuthorityLock(
  payload: Payload,
  transactionID: string | number,
  accountId: number,
): Promise<void> {
  if (!Number.isInteger(accountId))
    throw new Error('Authority lock requires an integer account id.')
  await (payload.db as Doc).execute({
    db: txHandle(payload, transactionID),
    raw: `SELECT pg_advisory_xact_lock(${AUTHORITY_LOCK_NS}, ${accountId})`,
  })
}

// Run `fn` in a transaction holding the account's advisory lock (lock-order
// step 1); joins an existing request transaction, locking multiple accounts in ascending id order.
export async function withAuthorityLock<T>(
  req: PayloadRequest,
  accountId: number | number[],
  fn: () => Promise<T>,
): Promise<T> {
  const accountIds = [...new Set([accountId].flat())].sort((a, b) => a - b)
  const acquire = async (transactionID: string | number) => {
    for (const id of accountIds) await advisoryAuthorityLock(req.payload, transactionID, id)
  }
  return withTransaction(req, async (transactionID) => {
    await acquire(transactionID)
    return fn()
  })
}
