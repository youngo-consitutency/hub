import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const databaseUrl = process.env.TEST_DATABASE_URL

test(
  'PostgreSQL enforces suspension transitions, delivery leases and current publication reads',
  { skip: databaseUrl ? false : 'TEST_DATABASE_URL is not set' },
  async (t) => {
    process.env.DATABASE_URL = databaseUrl
    const { getPool } = await import('../server/lib/db.js')
    const { createSession, getSessionAccount, authenticate } =
      await import('../server/lib/accounts.js')
    const { completeCourse } = await import('../server/lib/lifecycle.js')
    const { hashPassword } = await import('../server/lib/password.js')
    const notifications = await import('../server/lib/notifications/store.js')
    const { scheduleDueNotifications } =
      await import('../server/lib/notifications/scheduler.js')
    const { saveSubscription } = await import('../server/lib/pushStore.js')
    const { runNotificationBatch } = await import('../server/worker.js')
    const pool = getPool()
    const id = randomUUID()
    const revisionId = randomUUID()
    const key = `remediation-${id}`
    t.after(async () => {
      await pool.query(
        'DELETE FROM hub_content_publications WHERE published_by=$1',
        [id],
      )
      await pool.query(
        'DELETE FROM hub_content_revisions WHERE created_by=$1',
        [id],
      )
      await pool.query('DELETE FROM hub_accounts WHERE id=$1', [id])
      await pool.end()
    })
    const { salt, hash } = await hashPassword('Postgres Test Passphrase 7!')
    await pool.query(
      `INSERT INTO hub_accounts(id,email,password_hash,password_salt,name,entity_type,membership_track,country,membership_policy_version,member_status,hub_access_status,membership_status,email_verified_at)
    VALUES($1,$2,$3,$4,'Test','individual','constituency_work','Kenya','test','pending_course','pending_course','registered',now())`,
      [id, `${id}@example.org`, hash, salt],
    )
    assert.ok(
      await authenticate(`${id}@example.org`, 'Postgres Test Passphrase 7!'),
    )
    assert.equal(
      (await completeCourse(id, { score: 10 })).membershipStatus,
      'awaiting_onboarding',
    )
    await pool.query(
      "UPDATE hub_accounts SET membership_status='active' WHERE id=$1",
      [id],
    )
    assert.equal(
      (await completeCourse(id, { score: 10 })).membershipStatus,
      'active',
    )
    for (const [access, status] of [
      ['suspended', 'active'],
      ['active', 'terminated'],
      ['active', 'expired'],
    ]) {
      await pool.query(
        "UPDATE hub_accounts SET hub_access_status='active',membership_status='active' WHERE id=$1",
        [id],
      )
      const old = await createSession(id)
      const legacy = randomUUID()
      await pool.query(
        "INSERT INTO hub_sessions(token,account_id,expires_at) VALUES($1,$2,now()+interval '1 day')",
        [legacy, id],
      )
      await pool.query(
        'UPDATE hub_accounts SET hub_access_status=$2,membership_status=$3 WHERE id=$1',
        [id, access, status],
      )
      assert.equal(await createSession(id), null)
      assert.equal(await getSessionAccount(old.token), null)
      assert.equal(await getSessionAccount(legacy), null)
      assert.equal(
        await authenticate(`${id}@example.org`, 'Postgres Test Passphrase 7!'),
        null,
      )
      assert.equal(await completeCourse(id, { score: 10 }), null)
    }
    await pool.query(
      "UPDATE hub_accounts SET hub_access_status='active',membership_status='active' WHERE id=$1",
      [id],
    )
    const suspender = await pool.connect()
    try {
      await suspender.query('BEGIN')
      await suspender.query(
        "UPDATE hub_accounts SET hub_access_status='suspended',membership_status='terminated' WHERE id=$1",
        [id],
      )
      const completion = completeCourse(id, { score: 10 })
      await suspender.query('COMMIT')
      assert.equal(await completion, null)
    } finally {
      suspender.release()
    }
    await pool.query(
      "UPDATE hub_accounts SET hub_access_status='active',membership_status='active' WHERE id=$1",
      [id],
    )
    await notifications.updateNotificationPreferences(id, {
      email: { digest: true, deadline: true },
    })
    await notifications.enqueueNotification({
      accountId: id,
      category: 'digest',
      templateKey: 'digest',
      deduplicationKey: key,
      payload: { title: 'Test', message: 'Test' },
    })
    const [old] = await notifications.claimDueNotifications({ leaseMs: 1 })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await notifications.requeueExpiredLeases()
    const [current] = await notifications.claimDueNotifications()
    assert.equal(await notifications.notificationClaimIsCurrent(old), false)
    await notifications.markNotificationSent(old, 'stale')
    assert.equal(
      (
        await pool.query('SELECT status FROM notification_outbox WHERE id=$1', [
          old.id,
        ])
      ).rows[0].status,
      'sending',
    )
    await notifications.markNotificationSent(current, 'valid')
    assert.equal(
      (
        await pool.query(
          'SELECT count(*)::int AS n FROM notification_delivery_attempts WHERE outbox_id=$1',
          [old.id],
        )
      ).rows[0].n,
      1,
    )
    const capped = await notifications.deliveryDecision(current)
    assert.equal(capped.allowed, false)
    assert.ok(capped.retryAt)
    assert.equal(
      (await notifications.deliveryDecision(current, new Date(capped.retryAt)))
        .allowed,
      true,
    )

    const now = new Date('2026-09-16T06:00:00Z')
    await notifications.updateNotificationPreferences(id, {
      digestDay: 3,
      digestHourUtc: 6,
      email: { digest: true, deadline: true },
    })
    await pool.query(
      `INSERT INTO hub_content_revisions(id,content_type,content_key,payload,created_by,status) VALUES($1,'announcement',$2,$3,$4,'published')`,
      [revisionId, key, { title: 'Live call', body: 'A live call' }, id],
    )
    await pool.query(
      `INSERT INTO hub_content_publications(content_type,content_key,payload,revision_id,published_by,published_at) VALUES('announcement',$1,$2,$3,$4,$5)`,
      [
        key,
        {
          title: 'Live call',
          body: 'A live call',
          ctaDeadlineAt: '2026-09-18T23:00:00Z',
        },
        revisionId,
        id,
        now,
      ],
    )
    assert.deepEqual(await scheduleDueNotifications({ now, env: {} }), {
      digest: 1,
      deadline: 1,
    })
    assert.deepEqual(await scheduleDueNotifications({ now, env: {} }), {
      digest: 0,
      deadline: 0,
    })
    const scheduled = await pool.query(
      "SELECT payload FROM notification_outbox WHERE account_id=$1 AND source_type='digest'",
      [id],
    )
    assert.match(scheduled.rows[0].payload.message, /Live call/)
    await pool.query(
      "UPDATE hub_content_publications SET status='unpublished' WHERE content_key=$1",
      [key],
    )
    assert.deepEqual(
      await scheduleDueNotifications({
        now: new Date('2026-09-23T06:00:00Z'),
        env: {},
      }),
      { digest: 0, deadline: 0 },
    )

    const lock = await pool.connect()
    try {
      await lock.query(
        "SELECT pg_advisory_lock(hashtext('youngo-email-delivery'))",
      )
      assert.equal((await runNotificationBatch({})).skipped, 'lock_busy')
    } finally {
      await lock.query(
        "SELECT pg_advisory_unlock(hashtext('youngo-email-delivery'))",
      )
      lock.release()
    }
    for (let n = 0; n < 20; n++)
      await saveSubscription({
        accountId: id,
        subscription: {
          endpoint: `https://fcm.googleapis.com/${id}/${n}`,
          keys: {},
        },
      })
    await assert.rejects(
      saveSubscription({
        accountId: id,
        subscription: {
          endpoint: `https://fcm.googleapis.com/${id}/extra`,
          keys: {},
        },
      }),
      { code: 'push_subscription_limit' },
    )
    await saveSubscription({
      accountId: id,
      subscription: {
        endpoint: `https://fcm.googleapis.com/${id}/0`,
        keys: {},
      },
    })
  },
)
