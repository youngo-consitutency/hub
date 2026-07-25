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
})
