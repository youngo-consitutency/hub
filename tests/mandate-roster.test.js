import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadMandateRoster,
  mandatesForEmail,
  plannedMandateActions,
} from '../server/lib/mandateRoster.js'
import { WORKING_GROUP_SLUGS } from '../shared/workingGroups.js'

test('2026 roster emails are unique people with at least one mandate', () => {
  const roster = loadMandateRoster()
  assert.equal(roster.source.year, 2026)
  assert.ok(roster.mandates.length >= 40)
  for (const item of roster.mandates) {
    assert.match(item.email, /@/)
    assert.ok(item.name)
    assert.ok(['focal_point', 'wg_contact'].includes(item.kind))
    if (item.kind === 'wg_contact') {
      assert.ok(
        WORKING_GROUP_SLUGS.has(item.wgSlug),
        `unknown wg slug ${item.wgSlug}`,
      )
    }
  }
})

test('roster lookup is case-insensitive and supports dual mandates', () => {
  const adaptation = mandatesForEmail('GaelBizet@gmail.com')
  assert.equal(adaptation.length, 1)
  assert.equal(adaptation[0].wgSlug, 'adaptation')

  const dual = mandatesForEmail('dogukanejderr@gmail.com')
  assert.deepEqual(dual.map((item) => item.wgSlug).sort(), [
    'human-rights',
    'peace-and-security',
  ])

  const anirudh = mandatesForEmail('anirudhjanagam.official@gmail.com')
  assert.deepEqual(anirudh.map((item) => item.wgSlug).sort(), ['ach', 'coy'])

  assert.equal(mandatesForEmail('nobody@example.org').length, 0)
})

test('mandate is pending until the inbox is confirmed', () => {
  const plan = plannedMandateActions({
    email: 'zipporah.n@unmgcy.org',
    role: 'member',
    membership_status: 'registered',
  })
  assert.equal(plan.matched, true)
  assert.equal(plan.fields, null)
  assert.equal(plan.claims[0].status, 'pending_email')
})

test('confirmed roster email plans CP role and WG assignment', () => {
  const plan = plannedMandateActions({
    email: 'gaelbizet@gmail.com',
    role: 'member',
    membership_status: 'registered',
    email_verified_at: '2026-09-15T00:00:00.000Z',
  })
  assert.equal(plan.matched, true)
  assert.equal(plan.fields.role, 'wg_contact')
  assert.equal(plan.fields.verified_by, 'mandate_roster_2026')
  assert.deepEqual(plan.wgAssignments, [
    { wgSlug: 'adaptation', role: 'contact', status: 'active' },
  ])
})

test('focal-point emails take the constituency role', () => {
  const plan = plannedMandateActions({
    email: 'megimarku.climate@gmail.com',
    role: 'member',
    emailVerifiedAt: '2026-09-15T00:00:00.000Z',
  })
  assert.equal(plan.fields.role, 'focal_point')
  assert.equal(plan.wgAssignments.length, 0)
})

test('terminated accounts are not self-verified', () => {
  const plan = plannedMandateActions({
    email: 'saikat.das16192@gmail.com',
    role: 'member',
    membership_status: 'terminated',
    email_verified_at: '2026-09-15T00:00:00.000Z',
  })
  assert.equal(plan.fields, null)
  assert.equal(plan.blocked, 'terminated')
  assert.equal(plan.claims[0].status, 'blocked')
})

test('admin and organisation admin roles are not overwritten', () => {
  const admin = plannedMandateActions({
    email: 'dimpleasopa19@gmail.com',
    role: 'admin',
    email_verified_at: '2026-09-15T00:00:00.000Z',
  })
  assert.equal(admin.fields.role, 'admin')
  assert.equal(admin.wgAssignments[0].wgSlug, 'energy')
})
