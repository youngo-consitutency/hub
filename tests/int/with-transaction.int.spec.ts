import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { withTransaction } from '../../src/lib/pg'

// a req with a recording db: no database needed, only the begin/commit/rollback contract
function fakeReq(begin: unknown = 'tx-1', transactionID?: string) {
  const db = {
    beginTransaction: vi.fn(async () => begin),
    commitTransaction: vi.fn(async () => {}),
    rollbackTransaction: vi.fn(async () => {}),
  }
  const req = { payload: { db }, transactionID } as unknown as PayloadRequest
  return { req, db }
}

describe('withTransaction', () => {
  it('begins, commits and clears the id when fn succeeds', async () => {
    const { req, db } = fakeReq()
    const seen: unknown[] = []
    const result = await withTransaction(req, async (id) => {
      seen.push(id, req.transactionID)
      return 42
    })
    expect(result).toBe(42)
    // fn sees the new id both as its argument and on the request
    expect(seen).toEqual(['tx-1', 'tx-1'])
    expect(db.commitTransaction).toHaveBeenCalledWith('tx-1')
    expect(db.rollbackTransaction).not.toHaveBeenCalled()
    expect(req.transactionID).toBeUndefined()
  })

  it('rolls back, rethrows the original error and clears the id when fn throws', async () => {
    const { req, db } = fakeReq()
    const boom = new Error('boom')
    await expect(
      withTransaction(req, async () => {
        throw boom
      }),
    ).rejects.toBe(boom)
    expect(db.rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(db.commitTransaction).not.toHaveBeenCalled()
    expect(req.transactionID).toBeUndefined()
  })

  it('joins an open transaction and leaves its commit to the owner', async () => {
    const { req, db } = fakeReq('unused', 'outer')
    const result = await withTransaction(req, async (id) => id)
    expect(result).toBe('outer')
    expect(db.beginTransaction).not.toHaveBeenCalled()
    expect(db.commitTransaction).not.toHaveBeenCalled()
    expect(db.rollbackTransaction).not.toHaveBeenCalled()
    // the owner still holds it
    expect(req.transactionID).toBe('outer')
  })

  it('does not roll back a joined transaction when fn throws', async () => {
    const { req, db } = fakeReq('unused', 'outer')
    await expect(
      withTransaction(req, async () => {
        throw new Error('inner')
      }),
    ).rejects.toThrow('inner')
    expect(db.rollbackTransaction).not.toHaveBeenCalled()
    expect(req.transactionID).toBe('outer')
  })

  it('nested calls share one transaction and commit once', async () => {
    const { req, db } = fakeReq()
    await withTransaction(req, async () => {
      await withTransaction(req, async () => {})
      // the inner call must not have cleared the outer's id
      expect(req.transactionID).toBe('tx-1')
    })
    expect(db.beginTransaction).toHaveBeenCalledTimes(1)
    expect(db.commitTransaction).toHaveBeenCalledTimes(1)
  })

  it('fails loudly when the adapter has no transactions', async () => {
    const { req, db } = fakeReq(null)
    await expect(withTransaction(req, async () => 1)).rejects.toThrow(
      'Database transactions are unavailable.',
    )
    expect(db.commitTransaction).not.toHaveBeenCalled()
    expect(req.transactionID).toBeUndefined()
  })
})
