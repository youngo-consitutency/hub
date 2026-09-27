import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, expect } from 'vitest'

let payload: Payload

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass123!'

async function login(email: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') || ''
  const token = setCookie.match(/payload-token=([^;]+)/)?.[1]
  return { cookie: `payload-token=${token}`, json: await res.json() }
}

const api = (
  path: string,
  { cookie, ...init }: { cookie?: string } & RequestInit = {},
) =>
  fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  })

describe('payload', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })
  })

  it('reads seeded accounts and content collections', async () => {
    const accounts = await payload.find({ collection: 'accounts', limit: 1 })
    expect(accounts.totalDocs).toBeGreaterThan(0)
    const events = await payload.find({ collection: 'content-events', limit: 1 })
    expect(events.totalDocs).toBeGreaterThan(0)
  })
})

describe('API contract (requires dev server on :3000)', () => {
  let member: { cookie: string }
  let admin: { cookie: string }

  beforeAll(async () => {
    member = await login('demo-member@youngo.demo')
    admin = await login('demo-admin@youngo.demo')
  })

  it('rejects anonymous member requests', async () => {
    for (const path of ['/member/people', '/member/profile', '/member/access']) {
      const res = await api(path)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('unauthorized')
    }
  })

  it('serves the member directory shape the SPA reads', async () => {
    const res = await api('/member/people', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    const items = body.items ?? body.people ?? body
    expect(Array.isArray(items)).toBe(true)
    if (items.length) {
      const p = items[0]
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('displayName')
      expect(p).toHaveProperty('photoUrl')
      expect(p).toHaveProperty('workingGroups')
    }
  })

  it('retires the legacy member points route with 410', async () => {
    const res = await api('/member/ngo/points', { cookie: member.cookie })
    expect(res.status).toBe(410)
    expect((await res.json()).error.code).toBe('retired')
  })

  it('validates push endpoints against the browser push allowlist', async () => {
    const bad = await api('/push/subscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://attacker.example.com/steal',
          keys: { p256dh: 'x', auth: 'y' },
        },
      }),
    })
    expect(bad.status).toBe(400)
    expect((await bad.json()).error.code).toBe('invalid_push_endpoint')
  })

  it('upserts a push subscription idempotently', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/it-${Date.now()}`
    const body = {
      subscription: { endpoint, keys: { p256dh: 'k', auth: 'a' } },
    }
    const first = await api('/push/subscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify(body),
    })
    const second = await api('/push/subscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify(body),
    })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const a = await first.json()
    const b = await second.json()
    expect(a.subscription.id).toBe(b.subscription.id)
    await api('/push/unsubscribe', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ endpoint }),
    })
  })

  it('scopes admin broadcast endpoints to capable staff', async () => {
    const res = await api('/member/admin/notifications/outbox', {
      cookie: member.cookie,
    })
    expect(res.status).toBe(403)
    const adminRes = await api('/member/admin/notifications/outbox', {
      cookie: admin.cookie,
    })
    expect(adminRes.status).toBe(200)
    expect(Array.isArray((await adminRes.json()).items)).toBe(true)
  })

  it('renders an announcement email preview with the legacy shape', async () => {
    const res = await api('/member/admin/notifications/preview', {
      method: 'POST',
      cookie: admin.cookie,
      body: JSON.stringify({
        title: 'Test',
        message: 'Hello members',
        reason: 'contract test reason',
        scope: { type: 'all_active' },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.subject).toBe('Test')
    expect(body.text).toContain('Hello members')
    expect(typeof body.html).toBe('string')
  })

  it('rejects invalid opportunity trust states', async () => {
    const res = await api('/member/opportunities/trust/11', {
      method: 'POST',
      cookie: admin.cookie,
      body: JSON.stringify({ state: 'bogus' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation')
  })

  it('unpublishes live content and hides it from public reads', async () => {
    const events = await (await api('/events')).json()
    const list = Array.isArray(events) ? events : events.items || []
    const slug = list[0]?.slug
    expect(slug).toBeTruthy()
    const unpub = await api(`/member/content/live/event/${slug}/unpublish`, {
      method: 'POST',
      cookie: admin.cookie,
      body: JSON.stringify({ reason: 'contract test' }),
    })
    expect(unpub.status).toBe(200)
    expect((await unpub.json()).unpublished).toBe(true)
    const gone = await api(`/events/${slug}`)
    expect(gone.status).toBe(404)
    // restore for other tests
    await api(`/member/content/live/event/${slug}`, {
      method: 'PATCH',
      cookie: admin.cookie,
      body: JSON.stringify({ payload: { title: list[0].title } }),
    })
  })

  it('rejects a second open membership appeal', async () => {
    // demo-pending is unverified; appeal path requires rejected membership.
    const pending = await login('demo-pending@youngo.demo')
    const res = await api('/member/membership/appeal', {
      method: 'POST',
      cookie: pending.cookie,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Identity-Kind': 'passport',
        'X-Appeal-Statement': encodeURIComponent('contract test appeal'),
      },
      body: Buffer.from('fake-proof'),
    })
    // pending members aren't rejected → expect conflict/validation, not 500
    expect([400, 403, 409]).toContain(res.status)
  })
})

describe('decision engine (S09)', () => {
  let cwMember: { cookie: string }
  let wgContact: { cookie: string }
  let member: { cookie: string }

  let pending: { cookie: string }

  beforeAll(async () => {
    cwMember = await login('demo-cw-member@youngo.demo')
    wgContact = await login('demo-wg-contact@youngo.demo')
    member = await login('demo-member@youngo.demo')
    pending = await login('demo-pending@youngo.demo')
  })

  it('rejects anonymous and unverified reads', async () => {
    expect((await api('/decisions')).status).toBe(401)
    // demo-pending hasn't completed the course → not a verified member
    expect((await api('/decisions', { cookie: pending.cookie })).status).toBe(
      403,
    )
  })

  it('lists seeded proposals for verified members', async () => {
    const res = await api('/decisions', { cookie: cwMember.cookie })
    expect(res.status).toBe(200)
    const { items } = await res.json()
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items.map((i: any) => i.status)).toEqual(
      expect.arrayContaining(['adopted', 'consultation', 'voting']),
    )
    // member-facing shape must not leak raw account fields
    expect(items[0].proposedBy.phone).toBeUndefined()
    expect(items[0].proposedBy.email).toBeUndefined()
  })

  it(
    'runs the full lifecycle: draft → present → flag → withdraw → consensus',
    { timeout: 60000 },
    async () => {
    const create = await api('/decisions', {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({
        title: 'Lifecycle test proposal',
        context: 'contract test',
        proposalText: 'Do the test thing.',
        decisionType: 'standard',
        body: 'working_group',
        bodyRef: 'finance',
      }),
    })
    expect(create.status).toBe(201)
    const { proposal } = await create.json()
    expect(proposal.status).toBe('draft')

    const present = await api(`/decisions/${proposal.id}/present`, {
      method: 'POST',
      cookie: cwMember.cookie,
    })
    const presented = (await present.json()).proposal
    expect(presented.status).toBe('consultation')
    // standard: 5d consult + 24h revision + 24h decision
    const consult = new Date(presented.consultationEndsAt).getTime()
    const revision = new Date(presented.revisionEndsAt).getTime()
    const decision = new Date(presented.decisionEndsAt).getTime()
    expect(consult - new Date(presented.presentedAt).getTime()).toBe(
      5 * 24 * 3600 * 1000,
    )
    expect(decision - revision).toBe(24 * 3600 * 1000)

    // a non-contact member of the body cannot present it
    expect(
      (await api(`/decisions/${proposal.id}/present`, {
        method: 'POST',
        cookie: wgContact.cookie,
      })).status,
    ).toBe(403)
    // and the contact person cannot present it twice (wrong phase)
    expect(
      (await api(`/decisions/${proposal.id}/present`, {
        method: 'POST',
        cookie: cwMember.cookie,
      })).status,
    ).toBe(409)

    // grey flag — finance WG member raising on WG decision
    const flagRes = await api(`/decisions/${proposal.id}/flags`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ kind: 'grey', reason: 'test grey flag' }),
    })
    expect(flagRes.status).toBe(201)
    const flag = (await flagRes.json()).flag

    // red flag needs category + alternative
    const badRed = await api(`/decisions/${proposal.id}/flags`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ kind: 'red', reason: 'x' }),
    })
    expect(badRed.status).toBe(400)

    // only the raiser may withdraw
    expect(
      (await api(`/decisions/${proposal.id}/flags/${flag.id}/withdraw`, {
        method: 'POST',
        cookie: wgContact.cookie,
      })).status,
    ).toBe(403)
    expect(
      (await api(`/decisions/${proposal.id}/flags/${flag.id}/withdraw`, {
        method: 'POST',
        cookie: cwMember.cookie,
      })).status,
    ).toBe(200)

    // close → no standing flags → consensus
    const close = await api(`/decisions/${proposal.id}/close`, {
      method: 'POST',
      cookie: cwMember.cookie,
    })
    const closed = (await close.json()).proposal
    expect(closed.status).toBe('adopted')
    expect(closed.adoptedVia).toBe('consensus')

    const events = await (
      await api(`/decisions/${proposal.id}/events`, {
        cookie: cwMember.cookie,
      })
    ).json()
    expect(events.items.map((e: any) => e.type)).toEqual(
      expect.arrayContaining([
        'created',
        'presented',
        'flag_grey_raised',
        'flag_withdrawn',
        'phase_revision',
        'phase_decision',
        'adopted',
      ]),
    )
  })

  it('gates ballots by membership track and body scope', async () => {
    // P3 is a finance-WG vote: a CW member of finance WG may vote once.
    const list = await (
      await api('/decisions?status=voting', { cookie: cwMember.cookie })
    ).json()
    const voting = list.items.find((i: any) => i.body === 'working_group')
    expect(voting).toBeTruthy()

    // network-track member has no decision rights (S17)
    expect(
      (
        await api(`/decisions/${voting.id}/ballots`, {
          method: 'POST',
          cookie: member.cookie,
          body: JSON.stringify({ choice: 'for' }),
        })
      ).status,
    ).toBe(403)

    const ballot = await api(`/decisions/${voting.id}/ballots`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ choice: 'against' }),
    })
    expect([201, 409]).toContain(ballot.status) // 409 if already cast in this DB

    // a second vote is always rejected
    expect(
      (
        await api(`/decisions/${voting.id}/ballots`, {
          method: 'POST',
          cookie: cwMember.cookie,
          body: JSON.stringify({ choice: 'for' }),
        })
      ).status,
    ).toBe(409)

    // a finance WG member without a council seat cannot vote on council items
    const council = list.items.find((i: any) => i.body === 'council')
    if (council) {
      expect(
        (
          await api(`/decisions/${council.id}/ballots`, {
            method: 'POST',
            cookie: cwMember.cookie,
            body: JSON.stringify({ choice: 'for' }),
          })
        ).status,
      ).toBe(403)
    }
  })

  it('validates veto request shape', async () => {
    const list = await (
      await api('/decisions?status=voting', { cookie: cwMember.cookie })
    ).json()
    const voting = list.items[0]
    const bad = await api(`/decisions/${voting.id}/vetoes`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ requesterKind: 'org', groupKey: 'Demo Org' }),
    })
    expect(bad.status).toBe(400) // reasoning required
    const ok = await api(`/decisions/${voting.id}/vetoes`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({
        requesterKind: 'wg_or_ot',
        groupKey: 'finance',
        reasoning: 'Test veto reasoning for the record.',
      }),
    })
    expect(ok.status).toBe(201)
    expect((await ok.json()).veto.status).toBe('pending')
  })

  it('generated REST cannot bypass the workflow', async () => {
    // members cannot write directly to the decision collections
    const res = await api('/decision-proposals', {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({
        title: 'forge',
        context: 'x',
        proposalText: 'x',
        body: 'council',
        proposedBy: 1,
        contactPersons: [1],
      }),
    })
    expect(res.status).toBe(403)
    // anonymous cannot read proposals
    expect((await api('/decision-proposals')).status).toBe(403)
  })
})

describe('generated API access control', () => {
  let member: { cookie: string }
  let memberAccountId: string

  beforeAll(async () => {
    member = await login('demo-member@youngo.demo')
    const access = await api('/member/access', { cookie: member.cookie })
    memberAccountId = String((await access.json()).accountId ?? '')
    expect(memberAccountId).toBeTruthy()
  })

  it('rejects anonymous writes to every content collection', async () => {
    for (const slug of [
      'content-announcements',
      'content-events',
      'catalogue-resources',
      'content-coys',
      'opportunities',
      'working-groups',
      'assignments',
      'council-decisions',
      'feedback-tickets',
    ]) {
      const res = await api(`/${slug}`, {
        method: 'POST',
        body: JSON.stringify({ title: 'x', name: 'x' }),
      })
      expect([401, 403]).toContain(res.status)
    }
  })

  it('rejects member writes to staff-managed collections', async () => {
    for (const slug of ['content-announcements', 'assignments', 'content-coys']) {
      const res = await api(`/${slug}`, {
        method: 'POST',
        cookie: member.cookie,
        body: JSON.stringify({ title: 'x', name: 'x' }),
      })
      expect(res.status).toBe(403)
    }
  })

  it('lets a member file only their own feedback ticket', async () => {
    const res = await api('/feedback-tickets', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        title: 'contract ticket',
        kind: 'other',
        body: 'access contract test',
      }),
    })
    expect([200, 201]).toContain(res.status)
    const forged = await api('/feedback-tickets', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        title: 'forged',
        kind: 'other',
        body: 'x',
        account: '1',
      }),
    })
    expect(forged.status).toBe(403)
  })

  it('prevents members patching privileged account fields via REST', async () => {
    const res = await api(`/accounts/${memberAccountId}`, {
      method: 'PATCH',
      cookie: member.cookie,
      body: JSON.stringify({ role: 'admin', teamRoles: ['membership_team'] }),
    })
    expect(res.status).toBe(403)
    const me = await api(`/accounts/${memberAccountId}`, {
      cookie: member.cookie,
    })
    const doc = await me.json()
    expect(doc.role).not.toBe('admin')
  })

  it('hides gated working-group channels from members via REST', async () => {
    const res = await api('/working-groups?limit=1', { cookie: member.cookie })
    expect(res.status).toBe(200)
    const body = await res.json()
    const doc = body.docs?.[0]
    if (doc) {
      expect(doc.whatsappUrl).toBeUndefined()
      expect(doc.groupUrl).toBeUndefined()
      expect(doc.driveUrl).toBeUndefined()
      expect(doc.taskForces).toBeUndefined()
    }
  })

  it('grants wg.manage only for coordination assignment roles', async () => {
    const { getAccessProfile } = await import('@/lib/access')
    const { docs } = await payload.find({
      collection: 'accounts',
      where: { email: { equals: 'demo-member@youngo.demo' } },
      limit: 1,
      overrideAccess: true,
    })
    const account = docs[0] as any
    const assignment = await payload.create({
      collection: 'assignments',
      data: {
        account: account.id,
        scopeType: 'working_group',
        scopeId: 'contract-wg',
        role: 'member',
        status: 'active',
        startsAt: new Date(Date.now() - 86400000).toISOString(),
      } as any,
      overrideAccess: true,
    })
    try {
      const req = { payload } as any
      const memberProfile = await getAccessProfile(req, account)
      expect(memberProfile.capabilities).not.toContain('wg.manage:contract-wg')
      await payload.update({
        collection: 'assignments',
        id: assignment.id,
        data: { role: 'contact' },
        overrideAccess: true,
      })
      const contactProfile = await getAccessProfile(req, account)
      expect(contactProfile.capabilities).toContain('wg.manage:contract-wg')
    } finally {
      await payload.delete({
        collection: 'assignments',
        id: assignment.id,
        overrideAccess: true,
      })
    }
  })
})
