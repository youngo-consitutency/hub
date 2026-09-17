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
import { createAccount, createSession } from '../server/lib/accounts.js'
import { POLICY_VERSION } from '../src/content/membershipPolicy.js'
import { PRIVACY_VERSION, CONSENT_STATEMENT } from '../shared/privacyNotice.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../data')
const files = ['hub-accounts.json', 'hub-sessions.json'].map((name) =>
  path.join(dataDir, name),
)

function sandbox(t) {
  const backups = new Map(
    files.map((file) => [
      file,
      existsSync(file) ? readFileSync(file, 'utf8') : null,
    ]),
  )
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(path.join(dataDir, 'hub-accounts.json'), '[]')
  writeFileSync(path.join(dataDir, 'hub-sessions.json'), '[]')
  t.after(() => {
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })
}

async function withApp(run) {
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  try {
    await run(origin)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

test('signed-in members can replace their password and keep this session', async (t) => {
  sandbox(t)
  const created = await createAccount({
    email: 'cp-change@example.org',
    password: 'YoungoHub2026Cp!',
    firstName: 'Gael',
    lastName: 'Bizet',
    name: 'Gael Bizet',
    entityType: 'individual',
    membershipTrack: 'constituency_work',
    phone: '+254 700 200 100',
    gender: 'Prefer not to say',
    ageBand: '18_35',
    dateOfBirth: '2000-01-15',
    minorityGroups: [],
    region: 'Africa',
    nationality: 'Kenyan',
    country: 'Kenya',
    motivation: 'Test',
    under18: false,
    acceptCodeOfConduct: true,
    acceptDataProtection: true,
    acceptPrinciples: true,
    acceptCoiPolicy: true,
    privacyConsent: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    privacyConsentAt: '2026-09-15T00:00:00.000Z',
    privacyConsentStatement: CONSENT_STATEMENT,
    membershipPolicyVersion: POLICY_VERSION,
    memberOfAccreditedNgo: false,
    memberStatus: 'verified',
    role: 'wg_contact',
    wgInterests: ['adaptation'],
    mustChangePassword: true,
  })
  assert.equal(created.mustChangePassword, true)
  const session = await createSession(created.id)

  await withApp(async (origin) => {
    const refused = await fetch(`${origin}/api/auth/change-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'YoungoHub2026Cp!',
        password: 'MyOwnPass123',
        passwordConfirm: 'MyOwnPass123',
      }),
    })
    assert.equal(refused.status, 401)

    const wrong = await fetch(`${origin}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': session.token,
      },
      body: JSON.stringify({
        currentPassword: 'not-the-password',
        password: 'MyOwnPass123',
        passwordConfirm: 'MyOwnPass123',
      }),
    })
    assert.equal(wrong.status, 400)
    assert.equal((await wrong.json()).error.fields.currentPassword.length > 0, true)

    const same = await fetch(`${origin}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': session.token,
      },
      body: JSON.stringify({
        currentPassword: 'YoungoHub2026Cp!',
        password: 'YoungoHub2026Cp!',
        passwordConfirm: 'YoungoHub2026Cp!',
      }),
    })
    assert.equal(same.status, 400)

    const changed = await fetch(`${origin}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': session.token,
      },
      body: JSON.stringify({
        currentPassword: 'YoungoHub2026Cp!',
        password: 'MyOwnPass123',
        passwordConfirm: 'MyOwnPass123',
      }),
    })
    assert.equal(changed.status, 200)
    const body = await changed.json()
    assert.equal(body.account.mustChangePassword, false)

    const stillSignedIn = await fetch(`${origin}/api/auth/me`, {
      headers: { 'x-session-token': session.token },
    })
    assert.equal(stillSignedIn.status, 200)

    const oldLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'cp-change@example.org',
        password: 'YoungoHub2026Cp!',
      }),
    })
    assert.equal(oldLogin.status, 401)

    const newLogin = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'cp-change@example.org',
        password: 'MyOwnPass123',
      }),
    })
    assert.equal(newLogin.status, 200)
  })
})
