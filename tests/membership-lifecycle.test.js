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
import { createApp } from '../server/app.js'
import { createSession, getSessionAccount } from '../server/lib/accounts.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data',
)
const accountsPath = path.join(dataDir, 'hub-accounts.json')
const sessionsPath = path.join(dataDir, 'hub-sessions.json')
const auditPath = path.join(dataDir, 'governance-audit.json')

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

test('offboarding suspends Hub access, revokes sessions, and protects platform staff', async (t) => {
  const backups = new Map([
    [
      accountsPath,
      existsSync(accountsPath) ? readFileSync(accountsPath, 'utf8') : null,
    ],
    [
      sessionsPath,
      existsSync(sessionsPath) ? readFileSync(sessionsPath, 'utf8') : null,
    ],
    [auditPath, existsSync(auditPath) ? readFileSync(auditPath, 'utf8') : null],
  ])
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    accountsPath,
    JSON.stringify(
      [
        account('membership-reviewer', { team_roles: ['membership_team'] }),
        account('departing-member'),
        account('platform-admin', { role: 'admin' }),
      ],
      null,
      2,
    ),
  )
  writeFileSync(sessionsPath, '[]')

  const reviewerSession = await createSession('membership-reviewer')
  const departingSession = await createSession('departing-member')
  const adminSession = await createSession('platform-admin')
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

  for (const role of ['contact', 'lead']) {
    const result = await fetch(
      `${origin}/api/member/cp/ace/members/departing-member/role`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': adminSession.token,
        },
        body: JSON.stringify({ role, status: 'active' }),
      },
    )
    assert.equal(
      result.status,
      400,
      'The membership queue cannot bypass evidenced appointments.',
    )
  }
  const terminated = await fetch(
    `${origin}/api/member/team/membership/accounts/departing-member/status`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-session-token': reviewerSession.token,
      },
      body: JSON.stringify({
        status: 'terminated',
        reason: 'Membership policy decision',
      }),
    },
  )
  assert.equal(terminated.status, 200)
  const terminatedBody = await terminated.json()
  assert.equal(terminatedBody.account.membershipStatus, 'terminated')
  assert.equal(terminatedBody.account.hubAccessStatus, 'suspended')
  assert.equal(terminatedBody.account.isVerified, false)
  assert.equal(await getSessionAccount(departingSession.token), null)

  const protectedStaff = await fetch(
    `${origin}/api/member/team/membership/accounts/platform-admin/status`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-session-token': reviewerSession.token,
      },
      body: JSON.stringify({
        status: 'terminated',
        reason: 'Should not be allowed',
      }),
    },
  )
  assert.equal(protectedStaff.status, 403)
  assert.equal((await protectedStaff.json()).error.code, 'forbidden')

  const filteredAccounts = await fetch(
    `${origin}/api/member/admin/accounts?search=departing&pageSize=1`,
    { headers: { 'x-session-token': adminSession.token } },
  )
  assert.equal(filteredAccounts.status, 200)
  const filteredBody = await filteredAccounts.json()
  assert.equal(filteredBody.total, 1)
  assert.equal(filteredBody.pageSize, 1)
  assert.equal(filteredBody.items[0].id, 'departing-member')

  const unexplainedRoleChange = await fetch(
    `${origin}/api/member/admin/accounts/membership-reviewer/role`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': adminSession.token,
      },
      body: JSON.stringify({ role: 'focal_point' }),
    },
  )
  assert.equal(unexplainedRoleChange.status, 400)
  assert.equal((await unexplainedRoleChange.json()).error.code, 'validation')

  const selfSuspend = await fetch(
    `${origin}/api/member/admin/accounts/platform-admin/status`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-session-token': adminSession.token,
      },
      body: JSON.stringify({
        status: 'terminated',
        reason: 'Testing protected self suspension',
      }),
    },
  )
  assert.equal(selfSuspend.status, 400)
  assert.equal((await selfSuspend.json()).error.code, 'self_suspend')
})

test('membership gates cover new logins, retained sessions, course completion and retakes', async (t) => {
  const { authenticate, accountCanSignIn } =
    await import('../server/lib/accounts.js')
  const { completeCourse } = await import('../server/lib/lifecycle.js')
  const { hashPassword } = await import('../server/lib/password.js')
  const backups = new Map(
    [accountsPath, sessionsPath].map((p) => [
      p,
      existsSync(p) ? readFileSync(p) : null,
    ]),
  )
  t.after(() => {
    for (const [p, data] of backups) {
      if (data) writeFileSync(p, data)
      else rmSync(p, { force: true })
    }
  })
  const { salt, hash } = await hashPassword('Correct Horse Battery Staple 7!')
  const base = account('gate', { password_salt: salt, password_hash: hash })
  for (const blocked of [
    { hub_access_status: 'suspended' },
    { membership_status: 'terminated' },
    { membership_status: 'expired' },
  ]) {
    for (const role of ['member', 'admin', 'focal_point']) {
      writeFileSync(accountsPath, JSON.stringify([{ ...base, role }]))
      writeFileSync(sessionsPath, '[]')
      const old = await createSession(base.id)
      const legacy = {
        token: 'legacy-token',
        account_id: base.id,
        expires_at: '2099-01-01',
      }
      const sessions = JSON.parse(readFileSync(sessionsPath))
      writeFileSync(sessionsPath, JSON.stringify([...sessions, legacy]))
      writeFileSync(
        accountsPath,
        JSON.stringify([{ ...base, role, ...blocked }]),
      )
      assert.equal(
        await authenticate(base.email, 'Correct Horse Battery Staple 7!'),
        null,
      )
      assert.equal(await createSession(base.id), null)
      assert.equal(await getSessionAccount(old.token), null)
      assert.equal(await getSessionAccount(legacy.token), null)
      assert.equal(await completeCourse(base.id, { score: 10 }), null)
      assert.deepEqual(JSON.parse(readFileSync(accountsPath))[0], {
        ...base,
        role,
        ...blocked,
      })
    }
  }
  assert.equal(accountCanSignIn({ hubAccessStatus: 'suspended' }), false)
  assert.equal(accountCanSignIn({ membershipStatus: 'terminated' }), false)
  for (const track of ['network', 'constituency_work']) {
    writeFileSync(
      accountsPath,
      JSON.stringify([
        {
          ...base,
          member_status: 'pending_course',
          hub_access_status: 'pending_course',
          membership_status: 'registered',
          membership_track: track,
          course_passed_at: null,
        },
      ]),
    )
    assert.ok(await authenticate(base.email, 'Correct Horse Battery Staple 7!'))
    const session = await createSession(base.id)
    assert.ok(await getSessionAccount(session.token))
    const updated = await completeCourse(base.id, { score: 10 })
    assert.equal(
      updated.membershipStatus,
      track === 'network' ? 'course_passed' : 'awaiting_onboarding',
    )
  }
  for (const status of ['active', 'renewal_due', 'awaiting_onboarding']) {
    writeFileSync(
      accountsPath,
      JSON.stringify([{ ...base, membership_status: status }]),
    )
    assert.equal(
      (await completeCourse(base.id, { score: 10 })).membershipStatus,
      status,
    )
  }
})

test('malformed cookies do not crash asynchronous member routes', async (t) => {
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  for (const cookie of ['%ZZ', '%', '%E0%A4']) {
    const result = await fetch(`${origin}/api/member/access`, {
      headers: { cookie: `youngo_session=${cookie}` },
    })
    assert.equal(result.status, 401)
  }
  assert.equal((await fetch(`${origin}/healthz`)).status, 200)
})

test('access refresh preserves organisation seats and reflects revocation', async (t) => {
  const seatsPath = path.join(dataDir, 'ngo-seats.json')
  const backups = new Map(
    [accountsPath, sessionsPath, seatsPath].map((file) => [
      file,
      existsSync(file) ? readFileSync(file, 'utf8') : null,
    ]),
  )
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve))
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(accountsPath, JSON.stringify([account('demo-representative')]))
  writeFileSync(sessionsPath, '[]')
  const seat = {
    org_account_id: 'demo-organisation',
    member_account_id: 'demo-representative',
    seat_role: 'representative',
    status: 'active',
  }
  writeFileSync(seatsPath, JSON.stringify([seat]))
  const session = await createSession('demo-representative')
  await new Promise((resolve) => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const headers = { cookie: `youngo_session=${session.token}` }
  const response = await fetch(`${origin}/api/member/access`, { headers })
  assert.equal(response.status, 200)
  const access = await response.json()
  assert.deepEqual(access.ngo, {
    orgAccountId: 'demo-organisation',
    seatRole: 'representative',
  })
  assert.equal(access.isAdmin, false)
  writeFileSync(seatsPath, JSON.stringify([{ ...seat, status: 'revoked' }]))
  const revoked = await fetch(`${origin}/api/member/access`, { headers })
  assert.equal((await revoked.json()).ngo, null)
})
