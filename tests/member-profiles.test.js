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
  validateMemberProfile,
  validatePhoto,
} from '../server/lib/memberProfiles.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data',
)
const files = [
  'hub-accounts.json',
  'hub-sessions.json',
  'member-profiles.json',
  'member-profile-photos.json',
  'wg-progress.json',
  'ngo-seats.json',
  'governance-audit.json',
]

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

test('profile validation bounds member-controlled fields and photo types', () => {
  const profile = validateMemberProfile({
    displayName: ' Ada Youth ',
    expertiseTags: ['Climate finance', 'climate finance', 'Facilitation'],
    directoryVisibility: 'members',
    showCountry: true,
  })
  assert.equal(profile.displayName, 'Ada Youth')
  assert.deepEqual(profile.expertiseTags, ['Climate finance', 'Facilitation'])
  assert.equal(profile.directoryVisibility, 'members')
  assert.throws(
    () =>
      validateMemberProfile({
        expertiseTags: Array.from({ length: 9 }, (_, index) => `tag-${index}`),
      }),
    (error) => error.code === 'validation',
  )
  assert.equal(
    validatePhoto(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'),
    'image/jpeg',
  )
  assert.throws(
    () => validatePhoto(Buffer.from('<svg/>'), 'image/png'),
    (error) => error.code === 'validation',
  )
})

test('member CRM keeps profiles private by default and joins governed relationships', async (t) => {
  const backups = new Map(
    files.map((name) => {
      const file = path.join(dataDir, name)
      return [file, existsSync(file) ? readFileSync(file, 'utf8') : null]
    }),
  )
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    path.join(dataDir, 'hub-accounts.json'),
    JSON.stringify(
      [
        account('viewer'),
        account('visible-member', {
          name: 'Visible Member',
          team_roles: ['content_editor', 'content_publisher'],
          email: 'visible@example.org',
          phone: '+254 700 000 000',
          wg_interests: ['finance'],
        }),
        account('private-member', { name: 'Private Member' }),
        account('private-cp', {
          name: 'Private CP',
          country: 'Ghana',
          region: 'Africa',
        }),
      ],
      null,
      2,
    ),
  )
  writeFileSync(path.join(dataDir, 'hub-sessions.json'), '[]')
  writeFileSync(
    path.join(dataDir, 'member-profiles.json'),
    JSON.stringify(
      [
        {
          account_id: 'visible-member',
          display_name: 'Climate Connector',
          headline: 'Facilitator',
          expertise_tags: ['Climate finance'],
          directory_visibility: 'members',
          show_country: true,
          show_organization: false,
          show_working_groups: true,
          show_roles: true,
          revision: 1,
          updated_at: '2026-08-24T00:00:00.000Z',
        },
        {
          account_id: 'private-member',
          directory_visibility: 'private',
          expertise_tags: [],
        },
        {
          account_id: 'private-cp',
          display_name: 'Quiet Contact',
          directory_visibility: 'private',
          expertise_tags: [],
        },
      ],
      null,
      2,
    ),
  )
  writeFileSync(path.join(dataDir, 'member-profile-photos.json'), '[]')
  writeFileSync(
    path.join(dataDir, 'wg-progress.json'),
    JSON.stringify([
      {
        account_id: 'visible-member',
        wg_slug: 'loss-and-damage',
        role_in_wg: 'contact',
        status: 'active',
        joined_at: '2026-01-01T00:00:00.000Z',
      },
      {
        account_id: 'private-cp',
        wg_slug: 'loss-and-damage',
        role_in_wg: 'contact',
        status: 'active',
        joined_at: '2026-01-01T00:00:00.000Z',
      },
    ]),
  )
  writeFileSync(path.join(dataDir, 'ngo-seats.json'), '[]')
  writeFileSync(path.join(dataDir, 'governance-audit.json'), '[]')

  const viewerSession = await createSession('viewer')
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const headers = { 'x-session-token': viewerSession.token }
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })

  const directory = await fetch(`${origin}/api/member/people`, { headers })
  assert.equal(directory.status, 200)
  const body = await directory.json()
  assert.equal(body.total, 1)
  assert.equal(body.items[0].displayName, 'Climate Connector')
  assert.equal(body.items[0].country, 'Kenya')
  assert.equal(body.items[0].email, undefined)
  assert.equal(body.items[0].phone, undefined)
  assert.deepEqual(
    body.items[0].teams,
    [],
    'Website permissions are not organisational teams',
  )
  assert.deepEqual(
    body.items[0].workingGroups.map((group) => [group.slug, group.role]),
    [
      ['loss-and-damage', 'contact'],
      ['finance', 'interested'],
    ],
  )

  const filtered = await fetch(
    `${origin}/api/member/people?workingGroup=loss-and-damage&tag=Climate%20finance`,
    { headers },
  ).then((response) => response.json())
  assert.equal(filtered.total, 1)

  const contactPoints = await fetch(
    `${origin}/api/member/people?workingGroup=loss-and-damage&workingGroupRole=manager`,
    { headers },
  ).then((response) => response.json())
  assert.equal(contactPoints.total, 2)
  const quiet = contactPoints.items.find(
    (item) => item.displayName === 'Quiet Contact',
  )
  assert.equal(quiet.country, 'Ghana')
  assert.equal(quiet.region, 'Africa')
  assert.equal(quiet.contactRole, 'Contact Point')
  assert.equal(quiet.bio, '')

  const participants = await fetch(
    `${origin}/api/member/people?workingGroup=loss-and-damage&workingGroupRole=participant`,
    { headers },
  ).then((response) => response.json())
  assert.equal(participants.total, 0)

  const privateProfile = await fetch(
    `${origin}/api/member/people/private-member`,
    { headers },
  )
  assert.equal(privateProfile.status, 404)

  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00])
  const uploaded = await fetch(`${origin}/api/member/profile/photo`, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'image/jpeg' },
    body: jpeg,
  })
  assert.equal(uploaded.status, 200)
  assert.equal((await uploaded.json()).profile.hasPhoto, true)

  const photo = await fetch(`${origin}/api/member/people/viewer/photo`, {
    headers,
  })
  assert.equal(photo.status, 200)
  assert.equal(photo.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), jpeg)

  const removed = await fetch(`${origin}/api/member/profile/photo`, {
    method: 'DELETE',
    headers,
  })
  assert.equal(removed.status, 200)
  assert.equal((await removed.json()).profile.hasPhoto, false)
})
