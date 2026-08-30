import test from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import webPush from 'web-push'

// The push router reads its VAPID configuration once, at import time, so the
// keys have to exist before the module graph is pulled in.
const keys = webPush.generateVAPIDKeys()
process.env.VAPID_PUBLIC_KEY = keys.publicKey
process.env.VAPID_PRIVATE_KEY = keys.privateKey
process.env.VAPID_SUBJECT = 'mailto:test@example.org'

const { createApp } = await import('../server/app.js')
const { createSession } = await import('../server/lib/accounts.js')

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data',
)
const accountsPath = path.join(dataDir, 'hub-accounts.json')
const sessionsPath = path.join(dataDir, 'hub-sessions.json')
const subscriptionsPath = path.join(dataDir, 'push-subscriptions.json')

function account(id, overrides = {}) {
  return {
    id,
    email: `${id}@example.org`,
    password_hash: 'hash',
    password_salt: 'salt',
    name: id,
    entity_type: 'individual',
    membership_track: 'network',
    country: 'Kenya',
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    role: 'member',
    team_roles: [],
    wg_interests: [],
    course_passed_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function withServer(t, run) {
  const files = [accountsPath, sessionsPath, subscriptionsPath]
  const backups = new Map(
    files.map((file) => [
      file,
      existsSync(file) ? readFileSync(file, 'utf8') : null,
    ]),
  )
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    accountsPath,
    JSON.stringify([
      account('push-member'),
      account('push-admin', { role: 'admin' }),
    ]),
  )
  writeFileSync(sessionsPath, '[]')
  writeFileSync(subscriptionsPath, '[]')

  const member = await createSession('push-member')
  const admin = await createSession('push-admin')
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`

  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })

  const call = (pathname, { token, method = 'GET', body } = {}) =>
    fetch(`${origin}${pathname}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { 'x-session-token': token } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  await run({ call, member: member.token, admin: admin.token })
}

test('the notification settings a member needs are reachable without staff rights', async (t) => {
  await withServer(t, async ({ call, member }) => {
    // The settings card asks for the key first to decide whether push is
    // configured for this deployment at all.
    const key = await call('/api/push/vapid-key')
    assert.equal(key.status, 200)
    assert.equal((await key.json()).publicKey, process.env.VAPID_PUBLIC_KEY)

    const status = await call('/api/push/status', { token: member })
    assert.equal(status.status, 200)
    assert.deepEqual(await status.json(), {
      configured: true,
      subscribed: false,
      subscriptions: [],
    })

    const subscribed = await call('/api/push/subscribe', {
      token: member,
      method: 'POST',
      body: {
        subscription: {
          endpoint: 'https://push.example/member-device',
          keys: { p256dh: 'p', auth: 'a' },
        },
      },
    })
    assert.equal(subscribed.status, 200)

    const after = await call('/api/push/status', { token: member })
    assert.equal((await after.json()).subscribed, true)

    // An ordinary member may confirm alerts reach their own device. It only
    // ever targets their own subscriptions, so no staff role is involved.
    const test = await call('/api/push/test', { token: member, method: 'POST' })
    assert.equal(
      test.status,
      200,
      'a member must be able to test their own device',
    )
    // The stored endpoint is a stub host, so the send itself cannot land; what
    // matters here is that the route accepted it and targeted one device.
    assert.equal((await test.json()).total, 1)
  })
})

test('admins can see who has device alerts without reading endpoints', async (t) => {
  await withServer(t, async ({ call, member, admin }) => {
    const asMember = await call('/api/push/admin/summary', { token: member })
    assert.equal(asMember.status, 403)

    const empty = await call('/api/push/admin/summary', { token: admin })
    assert.equal(empty.status, 200)
    assert.deepEqual(await empty.json(), {
      configured: true,
      accounts: 0,
      devices: 0,
    })

    await call('/api/push/subscribe', {
      token: member,
      method: 'POST',
      body: {
        subscription: {
          endpoint: 'https://push.example/member-device',
          keys: { p256dh: 'p', auth: 'a' },
        },
      },
    })

    const summary = await call('/api/push/admin/summary', { token: admin })
    assert.deepEqual(await summary.json(), {
      configured: true,
      accounts: 1,
      devices: 1,
    })

    const listed = await call('/api/push/admin/subscribers', { token: admin })
    assert.equal(listed.status, 200)
    const payload = await listed.json()
    assert.equal(payload.items.length, 1)
    assert.equal(payload.items[0].email, 'push-member@example.org')
    assert.equal(payload.items[0].devices, 1)
    assert.equal(
      JSON.stringify(payload).includes('https://push.example'),
      false,
    )
    assert.equal(JSON.stringify(payload).includes('"p"'), false)
  })
})

test('broadcasting to other members stays admin-only', async (t) => {
  await withServer(t, async ({ call, member, admin }) => {
    const body = { userIds: 'all', title: 'Plenary moved', body: 'Room 3.' }

    const asMember = await call('/api/push/send', {
      token: member,
      method: 'POST',
      body,
    })
    assert.equal(asMember.status, 403)

    const anonymous = await call('/api/push/send', { method: 'POST', body })
    assert.equal(anonymous.status, 401)

    // The admin passes the guard; with no subscriptions stored the route
    // reports that rather than a permission problem.
    const asAdmin = await call('/api/push/send', {
      token: admin,
      method: 'POST',
      body,
    })
    assert.equal(asAdmin.status, 404)
    assert.equal((await asAdmin.json()).error.code, 'no_subscriptions')
  })
})
