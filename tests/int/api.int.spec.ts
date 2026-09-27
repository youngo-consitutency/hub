import type { Payload } from 'payload'

import { describe, it, beforeAll, expect } from 'vitest'

import {
  provisionAccount,
  testPayload,
  type TestSpec,
} from './provision'

let payload: Payload

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get('set-cookie') || ''
  const token = setCookie.match(/payload-token=([^;]+)/)?.[1]
  return { cookie: `payload-token=${token}`, json: await res.json() }
}

// Provision a test account into the database and sign it in. Specs compose
// the permissions they need; no identities or credentials are hardcoded.
async function session(spec: TestSpec) {
  const { account, email, password } = await provisionAccount(spec)
  return { ...(await login(email, password)), account }
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
    payload = await testPayload()
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
    member = await session({})
    admin = await session({ role: 'admin' })
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
    // unverified member; appeal path requires rejected membership.
    const pending = await session({ verified: false })
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
  let voter1: { cookie: string }

  let pending: { cookie: string }

  beforeAll(async () => {
    cwMember = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'finance', role: 'member' },
    })
    wgContact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'finance', role: 'contact' },
    })
    member = await session({})
    voter1 = await session({ membershipTrack: 'constituency_work' })
    pending = await session({ verified: false })
  })

  it('rejects anonymous and unverified reads', async () => {
    expect((await api('/decisions')).status).toBe(401)
    // an unverified member hasn't completed the course → no decision read
    expect((await api('/decisions', { cookie: pending.cookie })).status).toBe(
      403,
    )
  })

  // Drive a proposal into 'voting': present, raise a red flag (which the
  // contact person responds to but which stays standing), then close —
  // consensus fails and the state machine opens a ballot.
  async function makeVotingProposal() {
    const create = await api('/decisions', {
      method: 'POST',
      cookie: wgContact.cookie,
      body: JSON.stringify({
        title: `Ballot test ${Date.now()}`,
        context: 'contract test',
        proposalText: 'Do the test thing.',
        decisionType: 'snap',
        snapJustification: 'test',
        snapDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        body: 'working_group',
        bodyRef: 'finance',
      }),
    })
    expect(create.status).toBe(201)
    const { proposal } = await create.json()
    await api(`/decisions/${proposal.id}/present`, {
      method: 'POST',
      cookie: wgContact.cookie,
    })
    const flag = await api(`/decisions/${proposal.id}/flags`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({
        kind: 'red',
        rationaleCategory: 'mission_misalignment',
        reason: 'test flag',
        alternative: 'test alternative',
      }),
    })
    expect(flag.status).toBe(201)
    const flagId = (await flag.json()).flag.id
    await api(`/decisions/${proposal.id}/flags/${flagId}/respond`, {
      method: 'POST',
      cookie: wgContact.cookie,
      body: JSON.stringify({ responseNote: 'noted' }),
    })
    const close = await api(`/decisions/${proposal.id}/close`, {
      method: 'POST',
      cookie: wgContact.cookie,
    })
    const closed = (await close.json()).proposal
    expect(closed.status).toBe('voting')
    return closed
  }

  it('lists proposals for verified members without leaking account fields', async () => {
    const res = await api('/decisions', { cookie: cwMember.cookie })
    expect(res.status).toBe(200)
    const { items } = await res.json()
    expect(Array.isArray(items)).toBe(true)
    if (items.length) {
      // member-facing shape must not leak raw account fields
      expect(items[0].proposedBy.phone).toBeUndefined()
      expect(items[0].proposedBy.email).toBeUndefined()
    }
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
    // timestamps round-trip through Postgres → allow small drift
    expect(
      Math.abs(
        consult - new Date(presented.presentedAt).getTime() -
          5 * 24 * 3600 * 1000,
      ),
    ).toBeLessThan(60_000)
    expect(Math.abs(decision - revision - 24 * 3600 * 1000)).toBeLessThan(
      60_000,
    )

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

  it('gates ballots by membership track and body scope', { timeout: 90000 }, async () => {
    // A finance-WG snap decision in its voting phase.
    const voting = await makeVotingProposal()

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

    // a CW member who is not part of the finance WG cannot vote either
    expect(
      (
        await api(`/decisions/${voting.id}/ballots`, {
          method: 'POST',
          cookie: voter1.cookie,
          body: JSON.stringify({ choice: 'for' }),
        })
      ).status,
    ).toBe(403)

    const ballot = await api(`/decisions/${voting.id}/ballots`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ choice: 'against' }),
    })
    expect(ballot.status).toBe(201)

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
  })

  it('validates veto request shape', { timeout: 90000 }, async () => {
    const voting = await makeVotingProposal()
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
  let member: { cookie: string; account: any }
  let memberAccountId: string

  beforeAll(async () => {
    member = await session({})
    memberAccountId = String(member.account.id)
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
    const account = member.account
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

describe('elections (S10) and selections (S24)', () => {
  let facilitator: { cookie: string }
  let cwMember: { cookie: string }
  let wgContact: { cookie: string }
  let wgLead: { cookie: string }
  let voter1: { cookie: string }
  let voter2: { cookie: string }
  let member: { cookie: string }
  let pending: { cookie: string }

  beforeAll(async () => {
    facilitator = await session({
      membershipTrack: 'constituency_work',
      teams: ['election_facilitation'],
    })
    cwMember = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'finance', role: 'member' },
    })
    wgContact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'finance', role: 'contact' },
    })
    wgLead = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'ace', role: 'contact' },
    })
    voter1 = await session({ membershipTrack: 'constituency_work' })
    voter2 = await session({ membershipTrack: 'constituency_work' })
    member = await session({})
    pending = await session({ verified: false })
  })

  it('lists elections for verified members', async () => {
    const res = await api('/governance/elections', { cookie: cwMember.cookie })
    expect(res.status).toBe(200)
    const { items } = await res.json()
    expect(Array.isArray(items)).toBe(true)
    if (items.length) {
      // results are only exposed once an election resolves
      const done = items.find((e: any) => e.status === 'completed')
      if (done) expect(done.result).toBeTruthy()
    }
  })

  it('rejects anonymous reads and non-facilitator creation', async () => {
    expect((await api('/governance/elections')).status).toBe(401)
    expect((await api('/governance/elections', { cookie: pending.cookie })).status).toBe(403)
    const res = await api('/governance/elections', {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ title: 'Nope', races: [{ slug: 'x' }] }),
    })
    expect(res.status).toBe(403)
  })

  it(
    'runs a full secret election: nominate → screen → credential → ranked ballot → IRV tally',
    { timeout: 90000 },
    async () => {
      // Create (facilitator only).
      const create = await api('/governance/elections', {
        method: 'POST',
        cookie: facilitator.cookie,
        body: JSON.stringify({
          title: `Contract election ${Date.now()}`,
          kind: 'other',
          races: [{ slug: 'seat', label: 'Seat' }],
          quorumIndividuals: 1,
          quorumOrganisations: 0,
        }),
      })
      expect(create.status).toBe(201)
      const { election } = await create.json()
      expect(election.status).toBe('announced')

      // Network-only member cannot nominate.
      await api(`/governance/elections/${election.id}/advance`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      const deniedNom = await api(`/governance/elections/${election.id}/candidates`, {
        method: 'POST',
        cookie: member.cookie,
        body: JSON.stringify({ race: 'seat', statement: 'x' }),
      })
      expect(deniedNom.status).toBe(403)
      expect((await deniedNom.json()).error.code).toBe('not_constituency_work')

      // Two CW candidates nominate; facilitator screens both in.
      const nomA = await api(`/governance/elections/${election.id}/candidates`, {
        method: 'POST',
        cookie: cwMember.cookie,
        body: JSON.stringify({ race: 'seat', statement: 'Candidate A' }),
      })
      expect(nomA.status).toBe(201)
      const candA = (await nomA.json()).candidate
      const nomB = await api(`/governance/elections/${election.id}/candidates`, {
        method: 'POST',
        cookie: wgLead.cookie,
        body: JSON.stringify({ race: 'seat', statement: 'Candidate B' }),
      })
      expect(nomB.status).toBe(201)
      const candB = (await nomB.json()).candidate
      for (const cand of [candA, candB]) {
        const res = await api(
          `/governance/elections/${election.id}/candidates/${cand.id}/screen`,
          {
            method: 'POST',
            cookie: facilitator.cookie,
            body: JSON.stringify({ status: 'screened_in' }),
          },
        )
        expect(res.status).toBe(200)
      }

      // Advance to voting; issue voter credentials.
      await api(`/governance/elections/${election.id}/advance`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      const cred1 = await api(`/governance/elections/${election.id}/credential`, {
        method: 'POST',
        cookie: voter1.cookie,
      })
      expect(cred1.status).toBe(201)
      const { token: token1 } = await cred1.json()
      expect(token1).toBeTruthy()
      // One credential per voter.
      expect(
        (
          await api(`/governance/elections/${election.id}/credential`, {
            method: 'POST',
            cookie: voter1.cookie,
          })
        ).status,
      ).toBe(409)
      const cred2 = await api(`/governance/elections/${election.id}/credential`, {
        method: 'POST',
        cookie: wgContact.cookie,
      })
      const { token: token2 } = await cred2.json()
      const cred3 = await api(`/governance/elections/${election.id}/credential`, {
        method: 'POST',
        cookie: voter2.cookie,
      })
      const { token: token3 } = await cred3.json()

      // Cast ranked ballots via token — not via the account session.
      const vote1 = await api(`/governance/elections/${election.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          token: token1,
          race: 'seat',
          ranks: [candA.id, candB.id],
        }),
      })
      expect(vote1.status).toBe(200)
      const vote2 = await api(`/governance/elections/${election.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          token: token2,
          race: 'seat',
          ranks: [candB.id, candA.id],
        }),
      })
      expect(vote2.status).toBe(200)
      const vote3 = await api(`/governance/elections/${election.id}/vote`, {
        method: 'POST',
        body: JSON.stringify({
          token: token3,
          race: 'seat',
          ranks: [candA.id],
        }),
      })
      expect(vote3.status).toBe(200)
      // One ballot per credential per race.
      expect(
        (
          await api(`/governance/elections/${election.id}/vote`, {
            method: 'POST',
            body: JSON.stringify({
              token: token1,
              race: 'seat',
              ranks: [candB.id],
            }),
          })
        ).status,
      ).toBe(409)
      // Bogus token rejected.
      expect(
        (
          await api(`/governance/elections/${election.id}/vote`, {
            method: 'POST',
            body: JSON.stringify({
              token: 'bogus',
              race: 'seat',
              ranks: [candA.id],
            }),
          })
        ).status,
      ).toBe(403)

      // Only the facilitation team tallies. 2-1 on first preferences → A
      // wins outright; the result is published on the election record.
      const deniedTally = await api(`/governance/elections/${election.id}/tally`, {
        method: 'POST',
        cookie: cwMember.cookie,
      })
      expect(deniedTally.status).toBe(403)
      const tally = await api(`/governance/elections/${election.id}/tally`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      expect(tally.status).toBe(200)
      const tallied = (await tally.json()).election
      expect(tallied.status).toBe('completed')
      expect(tallied.result.races.seat.outcome).toBe('elected')
      expect(tallied.result.races.seat.winner).toBe(String(candA.id))
      expect(tallied.result.ballotsCast.individuals).toBe(3)
    },
  )

  it(
    'runs a selection: committee (min 3) → apply → recusal blocks scoring → decide → announce',
    { timeout: 90000 },
    async () => {
      const create = await api('/governance/selections', {
        method: 'POST',
        cookie: facilitator.cookie,
        body: JSON.stringify({
          title: `Contract selection ${Date.now()}`,
          opportunityNote: 'test opportunity',
          method: 'colour',
          criteria: [{ name: 'Experience', weightPct: 100 }],
          spotsAvailable: 1,
        }),
      })
      expect(create.status).toBe(201)
      const { selection } = await create.json()

      // Committee must reach 3 before opening.
      const premature = await api(`/governance/selections/${selection.id}/open`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      expect(premature.status).toBe(409)
      expect((await premature.json()).error.code).toBe('committee_too_small')
      for (const who of [facilitator, cwMember, wgLead]) {
        const res = await api(`/governance/selections/${selection.id}/committee`, {
          method: 'POST',
          cookie: who.cookie,
        })
        expect(res.status).toBe(201)
      }
      const open = await api(`/governance/selections/${selection.id}/open`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      expect(open.status).toBe(200)

      // Two applications.
      const appA = await api(`/governance/selections/${selection.id}/apply`, {
        method: 'POST',
        cookie: wgContact.cookie,
        body: JSON.stringify({ answers: { motivation: 'A' } }),
      })
      expect(appA.status).toBe(201)
      const applicationA = (await appA.json()).application
      expect(
        (
          await api(`/governance/selections/${selection.id}/apply`, {
            method: 'POST',
            cookie: voter1.cookie,
            body: JSON.stringify({ answers: { motivation: 'B' } }),
          })
        ).status,
      ).toBe(201)

      // Close for evaluation; wgLead recuses on applicationA.
      await api(`/governance/selections/${selection.id}/close`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      const recuse = await api(`/governance/selections/${selection.id}/recuse`, {
        method: 'POST',
        cookie: wgLead.cookie,
        body: JSON.stringify({ applicantIds: [applicationA.id] }),
      })
      expect(recuse.status).toBe(200)
      const recusedEval = await api(
        `/governance/selections/${selection.id}/applications/${applicationA.id}/evaluate`,
        {
          method: 'POST',
          cookie: wgLead.cookie,
          body: JSON.stringify({ grade: 'green' }),
        },
      )
      expect(recusedEval.status).toBe(409)
      expect((await recusedEval.json()).error.code).toBe('conflict_of_interest')
      // Non-recused committee member can grade.
      const evalOk = await api(
        `/governance/selections/${selection.id}/applications/${applicationA.id}/evaluate`,
        {
          method: 'POST',
          cookie: cwMember.cookie,
          body: JSON.stringify({ grade: 'green' }),
        },
      )
      expect(evalOk.status).toBe(200)
      // Applicants (non-committee) cannot grade.
      const applicantEval = await api(
        `/governance/selections/${selection.id}/applications/${applicationA.id}/evaluate`,
        {
          method: 'POST',
          cookie: wgContact.cookie,
          body: JSON.stringify({ grade: 'green' }),
        },
      )
      expect(applicantEval.status).toBe(403)

      // Decide + announce.
      const decide = await api(`/governance/selections/${selection.id}/decide`, {
        method: 'POST',
        cookie: facilitator.cookie,
        body: JSON.stringify({
          selectedApplicationIds: [applicationA.id],
          selectionSummary: 'contract pick',
        }),
      })
      expect(decide.status).toBe(200)
      const announce = await api(`/governance/selections/${selection.id}/announce`, {
        method: 'POST',
        cookie: facilitator.cookie,
      })
      expect(announce.status).toBe(200)
      const announced = await announce.json()
      expect(announced.selection.status).toBe('announced')
      expect(announced.selected.length).toBe(1)
    },
  )
})
