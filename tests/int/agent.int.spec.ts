import type { Payload } from 'payload'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { describe, it, beforeAll, expect } from 'vitest'

import { decideEligibility, hashKey, mintSecret, whoamiView } from '../../src/lib/agentKeys'
import { provisionAccount, testPayload } from './provision'
import { BASE, api } from './helpers'

const GATEWAY_TOKEN = process.env.HUB_AGENT_GATEWAY_TOKEN || ''
const ready = {
  id: 7,
  hubAccessStatus: 'active',
  membershipStatus: 'active',
  emailVerifiedAt: '2026-01-01',
}

describe('agent key rules', () => {
  it('mints a prefixed secret and stores only its hash', () => {
    const { secret, prefix, tokenHash } = mintSecret()
    expect(secret.startsWith('yk_live_')).toBe(true)
    expect(prefix).toBe(secret.slice(0, 14))
    expect(tokenHash).toBe(hashKey(secret))
    expect(tokenHash).not.toContain(secret)
  })

  it('derives the connector role from capabilities', () => {
    const contact = decideEligibility(ready, { capabilities: ['wg.manage:ace'] })
    expect(contact).toMatchObject({ ok: true, connectorRole: 'contact_point', wgSlugs: ['ace'] })
    expect(contact.tools).toContain('add_wg_activity')
    expect(decideEligibility(ready, { capabilities: [], isFocalPoint: true }).tools).toEqual([
      'whoami',
      'constituency_status',
    ])
    // accounts.manage alone is not an operator: the deployment allowlist is also required
    expect(decideEligibility(ready, { capabilities: ['accounts.manage'] }).gate).toBe('no_mandate')
  })

  it('closes the gate on email, membership, password and service accounts', () => {
    const caps = { capabilities: ['wg.manage:ace'] }
    expect(decideEligibility({ ...ready, emailVerifiedAt: null }, caps).gate).toBe('pending_email')
    expect(decideEligibility({ ...ready, membershipStatus: 'expired' }, caps).gate).toBe(
      'membership_blocked',
    )
    expect(decideEligibility({ ...ready, mustChangePassword: true }, caps).gate).toBe(
      'password_change_required',
    )
    expect(decideEligibility({ ...ready, accountKind: 'service' }, caps).gate).toBe(
      'service_account',
    )
  })

  it('answers whoami without private fields', () => {
    const view = whoamiView(
      { id: 7, name: 'A', email: 'a@x.test', phone: '1' },
      decideEligibility(ready, { capabilities: ['wg.manage:ace'] }),
      (slug: string) => slug,
    )
    expect(Object.keys(view).sort()).toEqual([
      'accountId',
      'connectorRole',
      'displayName',
      'groups',
      'tools',
    ])
  })
})

async function signIn(spec: object) {
  const { account, email, password } = await provisionAccount(spec)
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const token = (res.headers.get('set-cookie') || '').match(/payload-token=([^;]+)/)?.[1]
  return { account, password, cookie: `payload-token=${token}` }
}

describe.skipIf(!GATEWAY_TOKEN)('agent gateway', () => {
  let payload: Payload
  let wg: string
  let contact: Awaited<ReturnType<typeof signIn>>
  let key: string
  const call = (tool: string, args: object = {}, secret = key, token = GATEWAY_TOKEN) =>
    fetch(`${BASE}/api/agent/v1/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Youngo-Key': secret,
      },
      body: JSON.stringify({ tool, arguments: args }),
    })

  beforeAll(async () => {
    payload = await testPayload()
    const options = await payload.find({
      collection: 'content-documents',
      where: { slug: { equals: 'content-options' } },
      limit: 1,
      overrideAccess: true,
    })
    if (!options.docs[0])
      await payload.create({
        collection: 'content-documents',
        data: {
          slug: 'content-options',
          title: 'Content options',
          body: { wgActivityKinds: [{ value: 'call', label: 'Call' }] },
        },
        overrideAccess: true,
      })
    wg = `it-wg-${randomBytes(4).toString('hex')}`
    await payload.create({
      collection: 'working-groups',
      data: { slug: wg, name: 'IT agent group' },
      overrideAccess: true,
    })
    contact = await signIn({
      membershipTrack: 'constituency_work',
      wg: { slug: wg, role: 'contact' },
    })
  })

  it('keeps keys from members without a mandate', async () => {
    const member = await signIn({})
    const state = await (await api('/member/agent', { cookie: member.cookie })).json()
    expect(state).toMatchObject({ eligible: false, gate: 'no_mandate', keys: [] })
    const res = await api('/member/agent/keys', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ currentPassword: member.password }),
    })
    expect(res.status).toBe(403)
  })

  it('mints a key after the password check and stores only its hash', async () => {
    const wrong = await api('/member/agent/keys', {
      method: 'POST',
      cookie: contact.cookie,
      body: JSON.stringify({ currentPassword: 'not-the-password' }),
    })
    expect(wrong.status).toBe(400)
    const res = await api('/member/agent/keys', {
      method: 'POST',
      cookie: contact.cookie,
      body: JSON.stringify({ currentPassword: contact.password }),
    })
    expect(res.status).toBe(201)
    key = (await res.json()).key
    const stored = await payload.find({
      collection: 'agent-keys',
      where: { account: { equals: contact.account.id } },
      overrideAccess: true,
    })
    expect(stored.docs[0].tokenHash).toBe(hashKey(key))
    expect(JSON.stringify(stored.docs)).not.toContain(key)
    // an agent key is not a Hub session
    expect(
      (await api('/auth/me', { headers: { Authorization: `Bearer ${key}` } })).status,
    ).not.toBe(200)
  })

  it('checks the service token, then the key, then the tool', async () => {
    expect((await call('whoami', {}, key, 'wrong')).status).toBe(401)
    expect((await call('whoami', {}, 'yk_live_nope')).status).toBe(401)
    const tools = await (await call('describe_tools')).json()
    expect(tools.tools).toContain('list_wg_joiners')
    expect((await call('no_such_tool')).status).toBe(404)
    expect((await call('mandate_gaps')).status).toBe(403)
    const me = await (await call('whoami')).json()
    expect(me).toMatchObject({ accountId: contact.account.id, connectorRole: 'contact_point' })
    // test accounts are named after their address, so check the fields, not the text
    expect(Object.keys(me).sort()).toEqual([
      'accountId',
      'connectorRole',
      'displayName',
      'groups',
      'tools',
    ])
  })

  it('scopes group tools and replays idempotent writes', async () => {
    expect((await call('list_wg_joiners', { wgSlug: 'ace' })).status).toBe(403)
    const joiners = await (await call('list_wg_joiners', { wgSlug: wg })).json()
    for (const joiner of joiners.joiners)
      expect(Object.keys(joiner).sort()).toEqual(['displayName', 'joinedAt', 'roleInWg', 'status'])

    const args = {
      wgSlug: wg,
      kind: 'call',
      title: 'Agent-scheduled call',
      idempotencyKey: 'it-agent-0001',
    }
    const first = await (await call('add_wg_activity', args)).json()
    const again = await (await call('add_wg_activity', args)).json()
    expect(again.activity.id).toBe(first.activity.id)
    const conflict = await call('add_wg_activity', { ...args, title: 'Something else' })
    expect(conflict.status).toBe(409)
    const log = await payload.find({
      collection: 'audit-log',
      where: {
        action: { equals: 'wg.activity_created' },
        targetId: { equals: String(first.activity.id) },
      },
      overrideAccess: true,
    })
    expect((log.docs[0]?.after as { agentKeyId?: number } | undefined)?.agentKeyId).toBeTruthy()
  })

  it('serves the same tool list through mcp-youngo', async () => {
    const port = 18000 + Math.floor(Math.random() * 1000)
    const server = spawn('node', ['mcp-youngo/server.mjs'], {
      env: {
        ...process.env,
        PORT: String(port),
        HUB_ORIGIN: BASE,
        HUB_AGENT_GATEWAY_TOKEN: GATEWAY_TOKEN,
      },
      stdio: 'ignore',
    })
    try {
      for (let i = 0; i < 40; i += 1) {
        if (
          await fetch(`http://127.0.0.1:${port}/healthz`).then(
            (r) => r.ok,
            () => false,
          )
        )
          break
        await new Promise((r) => setTimeout(r, 250))
      }
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
      const text = JSON.stringify(await res.json())
      const names = JSON.parse(text).result.tools.map((t: { name: string }) => t.name)
      expect(names).toEqual((await (await call('describe_tools')).json()).tools)
      expect(text).not.toContain(GATEWAY_TOKEN)
    } finally {
      server.kill()
    }
  })

  it('stops working after revocation and after a password change', async () => {
    const keys = await (await api('/member/agent', { cookie: contact.cookie })).json()
    const revoke = await api(`/member/agent/keys/${keys.keys[0].id}/revoke`, {
      method: 'POST',
      cookie: contact.cookie,
      body: JSON.stringify({ currentPassword: contact.password }),
    })
    expect(revoke.status).toBe(200)
    expect((await call('whoami')).status).toBe(401)

    const fresh = await (
      await api('/member/agent/keys', {
        method: 'POST',
        cookie: contact.cookie,
        body: JSON.stringify({ currentPassword: contact.password }),
      })
    ).json()
    expect((await call('whoami', {}, fresh.key)).status).toBe(200)
    const next = `N!${randomBytes(12).toString('base64url')}`
    const changed = await api('/auth/change-password', {
      method: 'POST',
      cookie: contact.cookie,
      body: JSON.stringify({
        currentPassword: contact.password,
        password: next,
        passwordConfirm: next,
      }),
    })
    expect(changed.status).toBe(200)
    expect((await call('whoami', {}, fresh.key)).status).toBe(401)
  })
})
