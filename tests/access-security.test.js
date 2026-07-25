import test from 'node:test'
import assert from 'node:assert/strict'
import { getAccessProfile, hasCapability } from '../server/lib/access.js'
import { rateLimit, requestSecurity } from '../server/lib/security.js'
import { resolveOrgContext } from '../server/lib/lifecycle.js'

test('admin access is derived centrally', async () => {
  const access = await getAccessProfile({ id: 'test-admin', role: 'admin', teamRoles: [], wgInterests: [] })
  assert.equal(hasCapability(access, 'accounts.manage'), true)
  assert.equal(hasCapability(access, 'audit.read'), true)
  assert.deepEqual(new Set(access.teamRoles), new Set(['membership_team', 'gys_policy_team']))
})

test('team assignment produces its workflow capability', async () => {
  const access = await getAccessProfile({ id: 'test-team', role: 'member', teamRoles: ['gys_policy_team'], wgInterests: [] })
  assert.equal(hasCapability(access, 'gys.manage'), true)
  assert.equal(hasCapability(access, 'membership.review'), false)
})

test('organization registration alone does not grant owner permissions', async () => {
  const context = await resolveOrgContext({ id: 'org-1', role: 'member', entityType: 'organization' })
  assert.equal(context, null)
})

test('admin organization access requires an explicit scope', async () => {
  assert.equal(await resolveOrgContext({ id: 'admin-1', role: 'admin' }), null)
  assert.deepEqual(
    await resolveOrgContext({ id: 'admin-1', role: 'admin' }, 'org-1'),
    {
      orgAccountId: 'org-1',
      seatRole: 'owner',
      isAdmin: true,
      canManageRequests: true,
      canManageSeats: true,
    },
  )
})

test('security middleware adds request and browser hardening headers', () => {
  const headers = new Map()
  const req = { get: () => null }
  const res = { set: (name, value) => headers.set(name, value) }
  let called = false
  requestSecurity(req, res, () => { called = true })
  assert.equal(called, true)
  assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/)
  assert.ok(headers.get('X-Request-Id'))
})

test('rate limiter rejects requests after the configured threshold', () => {
  const middleware = rateLimit({ name: `test-${Date.now()}`, max: 1, windowMs: 60_000 })
  const req = { ip: '192.0.2.1' }
  let statusCode = null
  const res = { set: () => {}, status: (status) => { statusCode = status; return res }, json: (body) => body }
  let passes = 0
  middleware(req, res, () => { passes += 1 })
  middleware(req, res, () => { passes += 1 })
  assert.equal(passes, 1)
  assert.equal(statusCode, 429)
})
