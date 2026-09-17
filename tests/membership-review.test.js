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
import { createSession } from '../server/lib/accounts.js'
import {
  extractPublicLinks,
  membershipReviewAccount,
} from '../server/lib/membershipReview.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data',
)
const files = [
  'hub-accounts.json',
  'hub-sessions.json',
  'member-profiles.json',
  'governance-audit.json',
].map((name) => path.join(dataDir, name))

function account(id, overrides = {}) {
  return {
    id,
    email: `${id}@example.org`,
    password_hash: 'hash',
    password_salt: 'salt',
    name: id,
    first_name: id,
    entity_type: 'individual',
    membership_track: 'network',
    country: 'Kenya',
    member_status: 'verified',
    hub_access_status: 'active',
    membership_status: 'active',
    role: 'member',
    team_roles: [],
    wg_interests: ['ace'],
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

async function listen(t) {
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  )
  return `http://127.0.0.1:${server.address().port}`
}

test('extractPublicLinks keeps only http(s) destinations', () => {
  const links = extractPublicLinks(
    'https://example.org/youth',
    'instagram.com/youthorg also see https://example.org/youth',
  )
  assert.deepEqual(
    links.map((link) => link.host),
    ['example.org', 'instagram.com'],
  )
})

test('membershipReviewAccount includes every registration answer', () => {
  const review = membershipReviewAccount(
    account('full-applicant', {
      first_name: 'Amina',
      last_name: 'Okello',
      name: 'Amina Okello',
      phone: '+254700000001',
      gender: 'Other',
      gender_other: 'Agender',
      date_of_birth: new Date('2001-04-12T00:00:00.000Z'),
      age_band: '18_35',
      region: 'Africa',
      nationality: 'Kenyan',
      minority_groups: ['Women', 'Other'],
      minority_other: 'Rural youth',
      member_of_accredited_ngo: false,
      accept_code_of_conduct: true,
      accept_data_protection: true,
      accept_principles: true,
      accept_coi_policy: true,
      privacy_consent: true,
      privacy_notice_version: '2026-07',
      guardian_name: null,
      under_18: false,
      motivation: 'Join ACE after COY.',
    }),
  )
  assert.equal(review.application.dateOfBirth, '2001-04-12')
  assert.equal(review.application.gender, 'Other')
  assert.equal(review.application.genderOther, 'Agender')
  assert.equal(review.application.countryOfResidence, 'Kenya')
  assert.equal(review.application.minorityIdentity, true)
  assert.deepEqual(review.application.minorityGroups, ['Women', 'Other'])
  assert.equal(review.application.minorityOther, 'Rural youth')
  assert.equal(review.application.memberOfAccreditedNgo, false)
  assert.equal(review.application.acceptCoiPolicy, true)
  assert.equal(review.application.privacyConsent, true)
  assert.equal(review.dateOfBirth, undefined)
})

test('Membership Team overview includes full registration answers', async (t) => {
  fixtureSandbox(t, [
    account('membership-reviewer', { team_roles: ['membership_team'] }),
    account('applicant', {
      membership_status: 'course_passed',
      hub_access_status: 'active',
      first_name: 'Amina',
      last_name: 'Okello',
      name: 'Amina Okello',
      phone: '+254700000001',
      gender: 'Female',
      date_of_birth: '2001-04-12',
      age_band: '18_35',
      region: 'Africa',
      nationality: 'Kenyan',
      minority_groups: ['Indigenous peoples'],
      member_of_accredited_ngo: false,
      accept_code_of_conduct: true,
      privacy_consent: true,
      motivation: 'I want to join the ACE working group after COY.',
      org_website: 'https://youth.example.org',
      org_social: 'https://www.instagram.com/youthorg',
    }),
    account('outsider'),
  ])

  const reviewer = await createSession('membership-reviewer')
  const applicant = await createSession('applicant')
  const outsider = await createSession('outsider')
  const origin = await listen(t)
  const headers = (token) => ({
    'content-type': 'application/json',
    'x-session-token': token,
  })

  const denied = await fetch(`${origin}/api/member/team/membership/overview`, {
    headers: headers(outsider.token),
  })
  assert.equal(denied.status, 403)

  const overview = await fetch(
    `${origin}/api/member/team/membership/overview`,
    {
      headers: headers(reviewer.token),
    },
  )
  assert.equal(overview.status, 200)
  const body = await overview.json()
  const row = body.items.find((item) => item.id === 'applicant')
  assert.equal(row.application.motivation.includes('ACE working group'), true)
  assert.equal(row.application.dateOfBirth, '2001-04-12')
  assert.equal(row.application.gender, 'Female')
  assert.equal(row.application.firstName, 'Amina')
  assert.equal(row.application.countryOfResidence, 'Kenya')
  assert.deepEqual(row.application.minorityGroups, ['Indigenous peoples'])
  assert.equal(row.application.memberOfAccreditedNgo, false)
  assert.equal(row.application.acceptCodeOfConduct, true)
  assert.equal(
    row.application.links.some((link) => link.host === 'instagram.com'),
    true,
  )

  const me = await fetch(`${origin}/api/auth/me`, {
    headers: { 'x-session-token': applicant.token },
  })
  const meBody = await me.json()
  assert.equal(meBody.account.application, undefined)
  assert.equal(meBody.account.motivation, undefined)
  assert.equal(meBody.account.dateOfBirth, undefined)
  assert.equal(meBody.account.minorityGroups, undefined)
})
