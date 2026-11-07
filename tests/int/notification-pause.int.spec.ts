import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPgPool } from '../../src/lib/pg'
import { drainNotificationOutbox } from '../../src/lib/notifications'
import { provisionAccount } from './provision'

describe('notification outbox with delivery disabled', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('leaves queued notifications untouched instead of marking them sent', async () => {
    const { account } = await provisionAccount({})
    const pool = getPgPool()!
    const key = `pause-${Math.random().toString(36).slice(2)}`
    await pool.query(
      `INSERT INTO notification_outbox(account_id,channel,category,template_key,source_type,source_id,deduplication_key,payload,available_at)
       VALUES($1,'push','announcement','test','test',$2,$2,'{}',now())`,
      [account.id, key],
    )
    vi.stubEnv('HUB_DELIVERY_DISABLED', 'true')
    const result = await drainNotificationOutbox({}, { limit: 500 })
    expect(result).toMatchObject({ claimed: 0, sent: 0, paused: true })
    const { rows } = await pool.query(
      'SELECT status, attempts::int AS attempts FROM notification_outbox WHERE deduplication_key=$1',
      [key],
    )
    expect(rows[0]).toEqual({ status: 'queued', attempts: 0 })
  })
})
