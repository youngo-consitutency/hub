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
const files = [
  'hub-accounts.json',
  'hub-sessions.json',
  'cp-call-slots.json',
  'governance-audit.json',
].map((name) => path.join(dataDir, name))

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
  writeFileSync(path.join(dataDir, 'cp-call-slots.json'), '[]')
  t.after(() => {
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })
}

function person(email, role) {
  return {
    email,
    password: 'YoungoHub2026Cp!',
    firstName: email.split('@')[0],
    lastName: 'Test',
    name: email,
    entityType: 'individual',
    membershipTrack: 'constituency_work',
    phone: '+254 700 111 111',
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
    role,
    wgInterests: ['adaptation'],
  }
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

test('admins publish slots and contact points book them', async (t) => {
  sandbox(t)
  const host = await createAccount(person('host@example.org', 'admin'))
  const cp = await createAccount(person('cp@example.org', 'wg_contact'))
  const hostSession = await createSession(host.id)
  const cpSession = await createSession(cp.id)
  const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  const end = new Date(start.getTime() + 45 * 60 * 1000)

  await withApp(async (origin) => {
    const created = await fetch(`${origin}/api/member/admin/cp-calls`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-session-token': hostSession.token,
      },
      body: JSON.stringify({
        hostLabel: 'Genn',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      }),
    })
    assert.equal(created.status, 201)
    const slot = (await created.json()).slots[0]

    const listed = await fetch(`${origin}/api/member/cp-calls/slots`, {
      headers: { 'x-session-token': cpSession.token },
    })
    assert.equal(listed.status, 200)
    assert.equal((await listed.json()).slots.length, 1)

    const booked = await fetch(
      `${origin}/api/member/cp-calls/slots/${slot.id}/book`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': cpSession.token,
        },
        body: JSON.stringify({ wgSlug: 'adaptation' }),
      },
    )
    assert.equal(booked.status, 201)

    const again = await fetch(
      `${origin}/api/member/cp-calls/slots/${slot.id}/book`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-session-token': cpSession.token,
        },
        body: JSON.stringify({ wgSlug: 'adaptation' }),
      },
    )
    assert.equal(again.status, 409)
  })
})
