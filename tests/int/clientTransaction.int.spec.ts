import type { Pool } from 'pg'
import { describe, expect, it } from 'vitest'

import { withClientTransaction } from '../../src/modules/negotiation/contributionShared'

// records every statement and release so the helper's contract is visible
function fakePool() {
  const log: string[] = []
  const client = {
    query: async (sql: string) => void log.push(sql),
    release: () => void log.push('release'),
  }
  return { log, pool: { connect: async () => client } as unknown as Pool }
}

describe('withClientTransaction', () => {
  it('commits what fn returns and releases the client', async () => {
    const { log, pool } = fakePool()
    expect(await withClientTransaction(pool, async () => 'done')).toBe('done')
    expect(log).toEqual(['BEGIN', 'COMMIT', 'release'])
  })

  it('rolls back, rethrows and still releases when fn throws', async () => {
    const { log, pool } = fakePool()
    await expect(
      withClientTransaction(pool, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(log).toEqual(['BEGIN', 'ROLLBACK', 'release'])
  })

  it('refuses to run without a pool', async () => {
    await expect(withClientTransaction(null, async () => 1)).rejects.toMatchObject({
      status: 503,
    })
  })
})
