import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.js'
import { createSession } from '../server/lib/accounts.js'
import { validateRuntimeConfig } from '../server/lib/config.js'
import {
  emailConfigured,
  resetEmailTransportForTests,
  sendTemplatedEmail,
} from '../server/lib/emailTransport.js'
import { renderEmailTemplate } from '../server/lib/emailTemplates.js'
import {
  claimDueNotifications,
  deliveryDecision,
  enqueueNotification,
  getNotificationPreferences,
  markNotificationSent,
  setEmailPreference,
  updateNotificationPreferences,
} from '../server/lib/notificationStore.js'
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../server/lib/unsubscribe.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../data')
const files = [
  'hub-accounts.json',
  'hub-sessions.json',
  'notification-preferences.json',
  'notification-settings.json',
  'notification-outbox.json',
  'notification-attempts.json',
  'email-suppressions.json',
  'email-verification-tokens.json',
  'governance-audit.json',
].map((name) => path.join(dataDir, name))

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
    email_verified_at: '2026-08-30T00:00:00.000Z',
    role: 'member',
    team_roles: [],
    wg_interests: [],
    course_passed_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function fixtureSandbox(t, accounts) {
  const backups = new Map(
    files.map((file) => [
      file,
      existsSync(file) ? readFileSync(file, 'utf8') : null,
    ]),
  )
  mkdirSync(dataDir, { recursive: true })
  for (const file of files) writeFileSync(file, '[]')
  writeFileSync(
    path.join(dataDir, 'hub-accounts.json'),
    JSON.stringify(accounts),
  )
  t.after(() => {
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })
}

test('optional email defaults off and delivery rechecks preferences and caps', async (t) => {
  fixtureSandbox(t, [account('email-member')])

  const defaults = await getNotificationPreferences('email-member')
  assert.deepEqual(defaults.email, {
    digest: false,
    deadline: false,
    announcement: false,
  })

  await updateNotificationPreferences('email-member', {
    timezone: 'UTC',
    digestDay: 1,
    digestHourUtc: 6,
    email: { digest: true, deadline: true, announcement: false },
  })
  const first = await enqueueNotification({
    accountId: 'email-member',
    category: 'digest',
    templateKey: 'digest',
    deduplicationKey: 'digest:email-member:2026-08-30',
    payload: { title: 'Digest', message: 'A governed update.' },
  })
  const duplicate = await enqueueNotification({
    accountId: 'email-member',
    category: 'digest',
    templateKey: 'digest',
    deduplicationKey: 'digest:email-member:2026-08-30',
    payload: { title: 'Digest', message: 'A governed update.' },
  })
  assert.equal(first.created, true)
  assert.equal(duplicate.created, false)

  const [claimed] = await claimDueNotifications()
  assert.equal((await deliveryDecision(claimed)).allowed, true)
  await markNotificationSent(claimed, '<provider-id@example.org>')

  const second = await enqueueNotification({
    accountId: 'email-member',
    category: 'digest',
    templateKey: 'digest',
    deduplicationKey: 'digest:email-member:2026-09-01',
    payload: { title: 'Digest two', message: 'Another update.' },
  })
  assert.equal(
    (await deliveryDecision(second.item)).reason,
    'category_frequency_cap',
  )
})

test('notification payloads reject nested credentials and account contacts', async (t) => {
  fixtureSandbox(t, [account('payload-member')])
  await assert.rejects(
    enqueueNotification({
      accountId: 'payload-member',
      category: 'announcement',
      templateKey: 'announcement',
      deduplicationKey: 'unsafe-payload',
      payload: { metadata: { guardianEmail: 'private@example.org' } },
    }),
    /forbidden key/i,
  )
})

test('the queue claims at most one message per account at a time', async (t) => {
  fixtureSandbox(t, [account('queue-a'), account('queue-b')])
  for (const [member, suffix] of [
    ['queue-a', 'one'],
    ['queue-a', 'two'],
    ['queue-b', 'one'],
  ]) {
    await enqueueNotification({
      accountId: member,
      category: 'announcement',
      templateKey: 'announcement',
      deduplicationKey: `announcement:${member}:${suffix}`,
      payload: { title: suffix, message: 'Safe queue item.' },
    })
  }
  const claimed = await claimDueNotifications({ limit: 10 })
  assert.equal(claimed.length, 2)
  assert.equal(new Set(claimed.map((item) => item.accountId)).size, 2)
})

test('unsubscribe tokens are category-bound and reject tampering', () => {
  const env = { EMAIL_UNSUBSCRIBE_SECRET: 'a-long-test-secret' }
  const token = createUnsubscribeToken('member-1', 'deadline', env)
  assert.deepEqual(verifyUnsubscribeToken(token, env), {
    accountId: 'member-1',
    category: 'deadline',
  })
  assert.equal(verifyUnsubscribeToken(`${token}x`, env), null)
})

test('templates escape member-controlled text and include the visible unsubscribe', async () => {
  const rendered = await renderEmailTemplate(
    'announcement',
    {
      title: '<script>alert(1)</script>',
      message: '<img src=x onerror=alert(1)>',
      actionUrl: 'https://hub.example.org/',
    },
    { unsubscribeUrl: 'https://hub.example.org/unsubscribe' },
  )
  assert.doesNotMatch(rendered.html, /<script>/)
  assert.doesNotMatch(rendered.html, /<img src=x/)
  assert.doesNotMatch(rendered.subject, /[\r\n]/)
  assert.match(rendered.html, /Unsubscribe from this category/)
  assert.match(rendered.text, /unsubscribe/i)
})

test('Nodemailer submits multipart mail and one-click headers to SMTP', async (t) => {
  let received = ''
  const server = net.createServer((socket) => {
    let buffer = ''
    let dataMode = false
    socket.write('220 localhost test smtp\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      if (dataMode) {
        const end = buffer.indexOf('\r\n.\r\n')
        if (end < 0) return
        received += buffer.slice(0, end)
        buffer = buffer.slice(end + 5)
        dataMode = false
        socket.write('250 2.0.0 queued\r\n')
      }
      while (!dataMode) {
        const end = buffer.indexOf('\r\n')
        if (end < 0) return
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        if (/^EHLO/i.test(line))
          socket.write('250-localhost\r\n250 PIPELINING\r\n')
        else if (/^DATA/i.test(line)) {
          dataMode = true
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
        } else if (/^QUIT/i.test(line)) {
          socket.write('221 bye\r\n')
          socket.end()
        } else socket.write('250 ok\r\n')
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    resetEmailTransportForTests()
    await new Promise((resolve) => server.close(resolve))
  })
  const port = server.address().port
  await sendTemplatedEmail({
    to: 'recipient@example.org',
    templateKey: 'announcement',
    data: { title: 'Test update', message: 'The body.' },
    unsubscribeUrl: 'https://hub.example.org/unsubscribe',
    env: {
      NODE_ENV: 'test',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(port),
      EMAIL_FROM: 'YOUNGO Hub <updates@example.org>',
    },
  })
  assert.match(received, /multipart\/alternative/i)
  assert.match(received, /List-Unsubscribe:/i)
  assert.match(received, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/i)
})

test('member settings and governed broadcasts enforce source-side authorization', async (t) => {
  const previousWebhookSecret = process.env.EMAIL_WEBHOOK_SECRET
  const previousSmtpHost = process.env.SMTP_HOST
  const previousEmailFrom = process.env.EMAIL_FROM
  process.env.EMAIL_WEBHOOK_SECRET = 'test-webhook-secret'
  process.env.SMTP_HOST = 'smtp.example.org'
  process.env.EMAIL_FROM = 'YOUNGO Hub <updates@example.org>'
  t.after(() => {
    if (previousWebhookSecret == null) delete process.env.EMAIL_WEBHOOK_SECRET
    else process.env.EMAIL_WEBHOOK_SECRET = previousWebhookSecret
    if (previousSmtpHost == null) delete process.env.SMTP_HOST
    else process.env.SMTP_HOST = previousSmtpHost
    if (previousEmailFrom == null) delete process.env.EMAIL_FROM
    else process.env.EMAIL_FROM = previousEmailFrom
  })
  fixtureSandbox(t, [
    account('mail-member'),
    account('mail-unverified', { email_verified_at: null }),
    account('mail-admin', { role: 'admin' }),
  ])
  await setEmailPreference('mail-member', 'announcement', true)
  const member = await createSession('mail-member')
  const unverified = await createSession('mail-unverified')
  const admin = await createSession('mail-admin')
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  )
  const origin = `http://127.0.0.1:${server.address().port}`
  const call = (pathname, token, options = {}) =>
    fetch(`${origin}${pathname}`, {
      method: options.method || 'GET',
      headers: {
        'content-type': 'application/json',
        'x-session-token': token,
        ...(options.headers || {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

  const defaults = await call(
    '/api/member/notifications/preferences',
    member.token,
  )
  assert.equal(defaults.status, 200)
  assert.equal((await defaults.json()).email.announcement, true)

  const enableUnverified = await call(
    '/api/member/notifications/preferences',
    unverified.token,
    {
      method: 'PATCH',
      body: {
        timezone: 'UTC',
        digestDay: 1,
        digestHourUtc: 6,
        email: { digest: true },
      },
    },
  )
  assert.equal(enableUnverified.status, 409)

  const broadcast = {
    title: 'Plenary update',
    message: 'The plenary starts at 14:00 UTC.',
    reason: 'Schedule changed after the room booking update.',
    scope: { type: 'all_active', ids: [] },
  }
  const denied = await call(
    '/api/member/admin/notifications/send',
    member.token,
    { method: 'POST', body: broadcast },
  )
  assert.equal(denied.status, 403)

  const accepted = await call(
    '/api/member/admin/notifications/send',
    admin.token,
    {
      method: 'POST',
      headers: { 'x-idempotency-key': 'plenary-2026-08-30' },
      body: broadcast,
    },
  )
  assert.equal(accepted.status, 202)
  assert.deepEqual(await accepted.json(), {
    ok: true,
    campaignId: 'plenary-2026-08-30',
    eligible: 1,
    queued: 1,
  })

  const repeated = await call(
    '/api/member/admin/notifications/send',
    admin.token,
    {
      method: 'POST',
      headers: { 'x-idempotency-key': 'plenary-2026-08-30' },
      body: broadcast,
    },
  )
  assert.equal((await repeated.json()).queued, 0)

  const outbox = await call(
    '/api/member/admin/notifications/outbox',
    admin.token,
  )
  const serialized = JSON.stringify(await outbox.json())
  assert.doesNotMatch(serialized, /mail-member@example\.org/)
  assert.doesNotMatch(serialized, /mail-unverified@example\.org/)

  const webhook = await fetch(`${origin}/api/notifications/provider-events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-email-webhook-secret': 'test-webhook-secret',
    },
    body: JSON.stringify({
      event: 'hard_bounce',
      email: 'mail-member@example.org',
      providerEventId: 'provider-event-1',
    }),
  })
  assert.equal(webhook.status, 202)
  const afterBounce = await enqueueNotification({
    accountId: 'mail-member',
    category: 'announcement',
    templateKey: 'announcement',
    deduplicationKey: 'announcement:after-bounce:mail-member',
    payload: { title: 'After bounce', message: 'Must not send.' },
  })
  assert.equal(
    (await deliveryDecision(afterBounce.item)).reason,
    'address_suppressed',
  )
  assert.doesNotMatch(
    readFileSync(path.join(dataDir, 'email-suppressions.json'), 'utf8'),
    /mail-member@example\.org/,
  )
})

test('production email rollout requires signing and webhook secrets', () => {
  assert.equal(
    emailConfigured({
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.example.org',
      EMAIL_FROM: 'updates@example.org',
    }),
    false,
  )
  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/test',
        APP_ORIGIN: 'https://hub.example.org',
        EMAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.org',
        EMAIL_FROM: 'updates@example.org',
      }),
    /EMAIL_UNSUBSCRIBE_SECRET, EMAIL_WEBHOOK_SECRET/,
  )
  assert.throws(
    () =>
      validateRuntimeConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://localhost/test',
        APP_ORIGIN: 'https://hub.example.org',
        EMAIL_ENABLED: 'true',
        SMTP_HOST: 'smtp.example.org',
        EMAIL_FROM: 'updates@example.org',
        EMAIL_UNSUBSCRIBE_SECRET: 'unsubscribe-secret',
        EMAIL_WEBHOOK_SECRET: 'webhook-secret',
        EMAIL_MAX_PER_SECOND: 'not-a-number',
      }),
    /EMAIL_MAX_PER_SECOND/,
  )
})
