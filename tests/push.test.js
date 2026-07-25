import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data',
)
const storePath = path.join(dataDir, 'push-subscriptions.json')

const {
  saveSubscription,
  deleteSubscription,
  listSubscriptionsForAccounts,
  listAllSubscriptions,
  pruneEndpoints,
  toWebPushSubscription,
} = await import('../server/lib/pushStore.js')

function clean() {
  if (existsSync(storePath)) rmSync(storePath)
}

const ACCOUNT_A = 'aaaaaaaa-0000-4000-8000-000000000001'
const ACCOUNT_B = 'bbbbbbbb-0000-4000-8000-000000000002'

function sub(endpoint) {
  return {
    endpoint,
    keys: { p256dh: 'key-' + endpoint, auth: 'auth-' + endpoint },
  }
}

describe('push subscription store', () => {
  before(clean)
  after(clean)

  it('saves a subscription and finds it by account', async () => {
    await saveSubscription({
      accountId: ACCOUNT_A,
      subscription: sub('https://push.example/a1'),
    })
    const rows = await listSubscriptionsForAccounts([ACCOUNT_A])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].endpoint, 'https://push.example/a1')
    assert.equal(rows[0].keys.auth, 'auth-https://push.example/a1')
  })

  it('is idempotent for the same account and endpoint', async () => {
    await saveSubscription({
      accountId: ACCOUNT_A,
      subscription: sub('https://push.example/a1'),
    })
    const rows = await listSubscriptionsForAccounts([ACCOUNT_A])
    assert.equal(
      rows.length,
      1,
      'resubscribing must not duplicate the endpoint',
    )
  })

  it('keeps one row per device', async () => {
    await saveSubscription({
      accountId: ACCOUNT_A,
      subscription: sub('https://push.example/a2'),
    })
    const rows = await listSubscriptionsForAccounts([ACCOUNT_A])
    assert.equal(rows.length, 2)
  })

  it('does not leak subscriptions between accounts', async () => {
    await saveSubscription({
      accountId: ACCOUNT_B,
      subscription: sub('https://push.example/b1'),
    })
    const a = await listSubscriptionsForAccounts([ACCOUNT_A])
    const b = await listSubscriptionsForAccounts([ACCOUNT_B])
    assert.equal(a.length, 2)
    assert.equal(b.length, 1)
    assert.ok(!a.some((r) => r.endpoint === 'https://push.example/b1'))
  })

  it('moves a shared device endpoint to the account currently using it', async () => {
    const endpoint = 'https://push.example/shared-device'
    await saveSubscription({
      accountId: ACCOUNT_A,
      subscription: sub(endpoint),
    })
    await saveSubscription({
      accountId: ACCOUNT_B,
      subscription: sub(endpoint),
    })
    const a = await listSubscriptionsForAccounts([ACCOUNT_A])
    const b = await listSubscriptionsForAccounts([ACCOUNT_B])
    assert.ok(!a.some((row) => row.endpoint === endpoint))
    assert.equal(b.filter((row) => row.endpoint === endpoint).length, 1)
    await deleteSubscription({ accountId: ACCOUNT_B, endpoint })
  })

  it('rejects a subscription with no endpoint', async () => {
    await assert.rejects(() =>
      saveSubscription({ accountId: ACCOUNT_A, subscription: {} }),
    )
  })

  it('deletes a single endpoint without touching the others', async () => {
    const removed = await deleteSubscription({
      accountId: ACCOUNT_A,
      endpoint: 'https://push.example/a1',
    })
    assert.equal(removed, 1)
    const rows = await listSubscriptionsForAccounts([ACCOUNT_A])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].endpoint, 'https://push.example/a2')
  })

  it('deletes every endpoint for an account when none is named', async () => {
    await deleteSubscription({ accountId: ACCOUNT_A })
    assert.equal((await listSubscriptionsForAccounts([ACCOUNT_A])).length, 0)
    assert.equal(
      (await listSubscriptionsForAccounts([ACCOUNT_B])).length,
      1,
      'other accounts must be untouched',
    )
  })

  it('prunes endpoints the push service reports as gone', async () => {
    await saveSubscription({
      accountId: ACCOUNT_A,
      subscription: sub('https://push.example/dead'),
    })
    const pruned = await pruneEndpoints(['https://push.example/dead'])
    assert.equal(pruned, 1)
    assert.equal((await listSubscriptionsForAccounts([ACCOUNT_A])).length, 0)
  })

  it('survives a restart — the store is on disk, not in memory', async () => {
    await saveSubscription({
      accountId: ACCOUNT_B,
      subscription: sub('https://push.example/b2'),
    })
    const fresh = await import(
      '../server/lib/pushStore.js?reload=' + Date.now()
    )
    const rows = await fresh.listSubscriptionsForAccounts([ACCOUNT_B])
    assert.equal(
      rows.length,
      2,
      'a freshly loaded module must still see stored subscriptions',
    )
  })

  it('returns every subscription for a broadcast', async () => {
    const all = await listAllSubscriptions()
    assert.equal(all.length, 2)
  })

  it('shapes a stored row back into what web-push expects', async () => {
    const [row] = await listSubscriptionsForAccounts([ACCOUNT_B])
    const shaped = toWebPushSubscription(row)
    assert.ok(shaped.endpoint)
    assert.ok(shaped.keys)
    assert.equal(
      Object.keys(shaped).length,
      2,
      'web-push takes endpoint and keys only',
    )
  })
})
