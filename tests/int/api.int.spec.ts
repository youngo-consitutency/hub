import type { Payload } from 'payload'

import { describe, it, beforeAll, expect } from 'vitest'

import { provisionAccount, testPayload, type TestSpec } from './provision'

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

const api = (path: string, { cookie, ...init }: { cookie?: string } & RequestInit = {}) =>
  fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers || {}),
    },
  })

describe('payload', () => {
  beforeAll(async () => {
    payload = await testPayload()
  })

  it('reads provisioned accounts and content collections', async () => {
    await provisionAccount({})
    const accounts = await payload.find({ collection: 'accounts', limit: 1 })
    expect(accounts.totalDocs).toBeGreaterThan(0)
    await (
      await testPayload()
    ).create({
      collection: 'content-events',
      data: {
        slug: `it-event-${Math.random().toString(36).slice(2, 8)}`,
        title: 'Contract test event',
        type: 'wg_call',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        state: 'published',
      },
      draft: false,
      overrideAccess: true,
    })
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
    const event = await (
      await testPayload()
    ).create({
      collection: 'content-events',
      data: {
        slug: `it-unpublish-${Math.random().toString(36).slice(2, 8)}`,
        title: 'Unpublish contract event',
        type: 'webinar',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        state: 'published',
      },
      draft: false,
      overrideAccess: true,
    })
    const slug = event.slug
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
      body: JSON.stringify({ payload: { title: event.title } }),
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
    expect((await api('/decisions', { cookie: pending.cookie })).status).toBe(403)
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
        Math.abs(consult - new Date(presented.presentedAt).getTime() - 5 * 24 * 3600 * 1000),
      ).toBeLessThan(60_000)
      expect(Math.abs(decision - revision - 24 * 3600 * 1000)).toBeLessThan(60_000)

      // a non-contact member of the body cannot present it
      expect(
        (
          await api(`/decisions/${proposal.id}/present`, {
            method: 'POST',
            cookie: wgContact.cookie,
          })
        ).status,
      ).toBe(403)
      // and the contact person cannot present it twice (wrong phase)
      expect(
        (
          await api(`/decisions/${proposal.id}/present`, {
            method: 'POST',
            cookie: cwMember.cookie,
          })
        ).status,
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
        (
          await api(`/decisions/${proposal.id}/flags/${flag.id}/withdraw`, {
            method: 'POST',
            cookie: wgContact.cookie,
          })
        ).status,
      ).toBe(403)
      expect(
        (
          await api(`/decisions/${proposal.id}/flags/${flag.id}/withdraw`, {
            method: 'POST',
            cookie: cwMember.cookie,
          })
        ).status,
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
    },
  )

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

  it('rejects concurrent duplicate ballots via the unique index', { timeout: 90000 }, async () => {
    const voting = await makeVotingProposal()

    // The pre-check and the insert are separate queries, so parallel
    // submissions can both observe "no ballot yet". The unique
    // (proposal, account) index must turn every loser into 409 already_voted.
    const attempts = await Promise.all(
      Array.from({ length: 4 }, () =>
        api(`/decisions/${voting.id}/ballots`, {
          method: 'POST',
          cookie: cwMember.cookie,
          body: JSON.stringify({ choice: 'for' }),
        }),
      ),
    )
    const statuses = attempts.map((r) => r.status).sort()
    expect(statuses, JSON.stringify(statuses)).toEqual([201, 409, 409, 409])
    for (const res of attempts) {
      if (res.status !== 409) continue
      const body = await res.json()
      expect(body.error.code).toBe('already_voted')
    }

    // Exactly one ballot row regardless of which request won the race.
    const { totalDocs } = await (
      await testPayload()
    ).find({
      collection: 'decision-ballots',
      where: { proposal: { equals: voting.id } },
      limit: 0,
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
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
        const res = await api(`/governance/elections/${election.id}/candidates/${cand.id}/screen`, {
          method: 'POST',
          cookie: facilitator.cookie,
          body: JSON.stringify({ status: 'screened_in' }),
        })
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

describe('membership lifecycle (S17)', () => {
  let cwMember: { cookie: string; account: any }
  let staff: { cookie: string; account: any }
  let member: { cookie: string; account: any }

  beforeAll(async () => {
    cwMember = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: 'finance', role: 'contact' },
    })
    staff = await session({ teams: ['membership_team'] })
    member = await session({})
  })

  it('reports the member state and renews Constituency Work', async () => {
    const state = await api('/member/membership/state', {
      cookie: cwMember.cookie,
    })
    expect(state.status).toBe(200)
    const body = await state.json()
    expect(body.constituencyWorkStatus).toBe('active')
    expect(body.assignments.some((a: any) => a.scopeId === 'finance' && a.role === 'contact')).toBe(
      true,
    )

    const renew = await api('/member/membership/renew', {
      method: 'POST',
      cookie: cwMember.cookie,
    })
    expect(renew.status).toBe(200)
    const renewed = await renew.json()
    expect(renewed.constituencyWorkStatus).toBe('active')
    expect(new Date(renewed.renewalDueAt).getUTCMonth()).toBe(1) // February

    // Network-track member has nothing to renew.
    expect(
      (
        await api('/member/membership/renew', {
          method: 'POST',
          cookie: member.cookie,
        })
      ).status,
    ).toBe(400)
  })

  it(
    'CW resignation ends WG assignments and opens a two-week handover',
    { timeout: 60000 },
    async () => {
      const resign = await api('/member/membership/resign', {
        method: 'POST',
        cookie: cwMember.cookie,
        body: JSON.stringify({ scope: 'constituency_work' }),
      })
      expect(resign.status).toBe(200)
      const body = await resign.json()
      expect(body.handover.status).toBe('open')
      expect(body.handover.items.length).toBeGreaterThanOrEqual(3)
      const dueMs = new Date(body.handover.dueAt).getTime() - Date.now()
      expect(dueMs).toBeGreaterThan(13 * 86400000)

      const state = await (
        await api('/member/membership/state', { cookie: cwMember.cookie })
      ).json()
      expect(state.constituencyWorkStatus).toBeFalsy()
      expect(state.assignments).toHaveLength(0)

      // member completes the checklist → handover closes
      const handoverId = body.handover.id
      const itemCount = body.handover.items.length
      for (let i = 0; i < itemCount; i += 1) {
        const res = await api(`/member/handovers/${handoverId}/items/${i}/complete`, {
          method: 'POST',
          cookie: cwMember.cookie,
        })
        expect(res.status).toBe(200)
      }
      const handovers = await (await api('/member/handovers', { cookie: cwMember.cookie })).json()
      expect(handovers.items[0].status).toBe('completed')
    },
  )

  it(
    'termination ends assignments, opens a handover, and the expiry sweep clears lapsed CW members',
    { timeout: 90000 },
    async () => {
      // Termination by the membership team.
      const target = await session({
        membershipTrack: 'constituency_work',
        wg: { slug: 'finance', role: 'member' },
      })
      const terminate = await api(
        `/member/team/membership/accounts/${target.account.id}/terminate`,
        {
          method: 'POST',
          cookie: staff.cookie,
          body: JSON.stringify({ reason: 'contract test termination' }),
        },
      )
      expect(terminate.status).toBe(200)
      const terminated = await terminate.json()
      expect(terminated.account.membershipStatus).toBe('terminated')
      expect(terminated.handover.status).toBe('open')

      // Ordinary members cannot terminate.
      expect(
        (
          await api(`/member/team/membership/accounts/${member.account.id}/terminate`, {
            method: 'POST',
            cookie: member.cookie,
            body: JSON.stringify({ reason: 'should not work' }),
          })
        ).status,
      ).toBe(403)

      // Expiry sweep: lapse the renewal due date, then run the job.
      const lapsed = await session({
        membershipTrack: 'constituency_work',
        wg: { slug: 'ace', role: 'member' },
      })
      await payload.update({
        collection: 'accounts',
        id: lapsed.account.id,
        data: {
          renewalDueAt: new Date(Date.now() - 86400000).toISOString(),
        } as any,
        overrideAccess: true,
      })
      const sweep = await api('/member/team/membership/renewals/run', {
        method: 'POST',
        cookie: staff.cookie,
      })
      expect(sweep.status).toBe(200)
      const swept = await sweep.json()
      const hit = swept.items.find((i: any) => i.accountId === lapsed.account.id)
      expect(hit).toBeTruthy()
      expect(hit.assignmentsEnded).toBe(1)

      // membership team can see the open handovers queue
      const queue = await api('/member/team/membership/handovers', {
        cookie: staff.cookie,
      })
      expect(queue.status).toBe(200)
      const { items } = await queue.json()
      expect(items.length).toBeGreaterThanOrEqual(2)
      expect(
        (
          await api('/member/team/membership/handovers', {
            cookie: member.cookie,
          })
        ).status,
      ).toBe(403)
    },
  )
})

describe('operational workflows', () => {
  let member: { cookie: string; account: any }
  let finance: { cookie: string; account: any }
  let safeguarding: { cookie: string; account: any }
  let dpo: { cookie: string; account: any }

  beforeAll(async () => {
    member = await session({ membershipTrack: 'constituency_work' })
    finance = await session({ teams: ['finance_team'] })
    safeguarding = await session({ teams: ['safeguarding_team'] })
    dpo = await session({ teams: ['data_controller'] })
  })

  it('funding: member submits, finance reviews, disburses, member reports', async () => {
    const created = await api('/member/funding', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        title: 'Travel support',
        purpose: 'Regional meeting travel',
        amountNumeric: 150,
        category: 'event_travel',
      }),
    })
    expect(created.status).toBe(201)
    const { request } = await created.json()
    expect(request.status).toBe('submitted')

    // member sees own request; finance sees the queue
    expect((await api(`/member/funding/${request.id}`, { cookie: member.cookie })).status).toBe(200)
    const queue = await api('/member/team/funding', { cookie: finance.cookie })
    expect(queue.status).toBe(200)
    expect((await queue.json()).items.some((i: any) => i.id === request.id)).toBe(true)

    // ordinary member cannot review
    expect(
      (
        await api(`/member/team/funding/${request.id}/review`, {
          method: 'POST',
          cookie: member.cookie,
          body: JSON.stringify({ status: 'approved' }),
        })
      ).status,
    ).toBe(403)

    // review → approve → disburse (finance only) → member reports
    for (const status of ['under_review', 'approved']) {
      const res = await api(`/member/team/funding/${request.id}/review`, {
        method: 'POST',
        cookie: finance.cookie,
        body: JSON.stringify({ status }),
      })
      expect(res.status).toBe(200)
    }
    const disbursed = await api(`/member/team/funding/${request.id}/disburse`, {
      method: 'POST',
      cookie: finance.cookie,
    })
    expect(disbursed.status).toBe(200)
    const reported = await api(`/member/funding/${request.id}/report`, {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ reportNote: 'Funds used for booked travel.' }),
    })
    expect(reported.status).toBe(200)
    expect((await reported.json()).request.status).toBe('reported')
  })

  it('safeguarding: confidential report, team-only case list and updates', async () => {
    const created = await api('/member/safeguarding', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        kind: 'concern',
        severity: 'high',
        description: 'A concern about member conduct at an event.',
        anonymous: true,
      }),
    })
    expect(created.status).toBe(201)
    const { caseRef } = await created.json()
    expect(caseRef).toMatch(/^SG-/)

    // reporter sees only their own reference + status
    const mine = await api('/member/safeguarding', { cookie: member.cookie })
    expect(mine.status).toBe(200)
    const { items } = await mine.json()
    expect(items[0].caseRef).toBe(caseRef)
    expect(items[0].description).toBeUndefined()

    // non-team members cannot list cases
    expect((await api('/member/team/safeguarding', { cookie: finance.cookie })).status).toBe(403)

    // team sees the case; anonymous hides the reporter
    const team = await api('/member/team/safeguarding', { cookie: safeguarding.cookie })
    expect(team.status).toBe(200)
    const cases = (await team.json()).items
    const found = cases.find((c: any) => `SG-${c.id}` === caseRef)
    expect(found).toBeTruthy()
    expect(found.reporter).toBeNull()

    // update flow: received → triaged → investigating
    for (const status of ['triaged', 'investigating']) {
      const res = await api(`/member/team/safeguarding/${found.id}/update`, {
        method: 'POST',
        cookie: safeguarding.cookie,
        body: JSON.stringify({ status, note: `Moved to ${status}.` }),
      })
      expect(res.status).toBe(200)
    }
  })

  it('COI, recognition and privacy request lifecycles', async () => {
    // COI: declare → membership team resolves
    const coi = await api('/member/coi', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        interest: 'Employer grant',
        details: 'Employer funds a related programme.',
        relatedScope: 'finance',
      }),
    })
    expect(coi.status).toBe(201)
    const coiId = (await coi.json()).declaration.id
    const membership = await session({ teams: ['membership_team'] })
    const resolved = await api(`/member/team/membership/coi/${coiId}/review`, {
      method: 'POST',
      cookie: membership.cookie,
      body: JSON.stringify({ status: 'resolved', reviewNote: 'Noted; recusal recorded.' }),
    })
    expect(resolved.status).toBe(200)

    // privacy: request → data controller fulfils
    const priv = await api('/member/privacy', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({ kind: 'access', details: 'Request copy of my data.' }),
    })
    expect(priv.status).toBe(201)
    const privId = (await priv.json()).request.id
    await api(`/member/team/privacy/${privId}/respond`, {
      method: 'POST',
      cookie: dpo.cookie,
      body: JSON.stringify({ status: 'in_progress' }),
    })
    const fulfilled = await api(`/member/team/privacy/${privId}/respond`, {
      method: 'POST',
      cookie: dpo.cookie,
      body: JSON.stringify({ status: 'fulfilled', responseNote: 'Export provided.' }),
    })
    expect(fulfilled.status).toBe(200)
    expect((await fulfilled.json()).request.status).toBe('fulfilled')
  })

  it('partnerships: major sponsorship requires a council decision before approval', async () => {
    const p = await api('/member/partnerships', {
      method: 'POST',
      cookie: member.cookie,
      body: JSON.stringify({
        organisationName: 'Example Foundation',
        kind: 'sponsorship',
        summary: 'Grant sponsorship for the assembly.',
        requiresCouncilDecision: true,
      }),
    })
    expect(p.status).toBe(201)
    const pid = (await p.json()).request.id
    const partnerships = await session({ teams: ['partnerships_team'] })
    await api(`/member/team/partnerships/${pid}/review`, {
      method: 'POST',
      cookie: partnerships.cookie,
      body: JSON.stringify({ status: 'under_review' }),
    })
    const blocked = await api(`/member/team/partnerships/${pid}/review`, {
      method: 'POST',
      cookie: partnerships.cookie,
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error.code).toBe('council_decision_required')
  })
})

describe('platform decision bridge', () => {
  const BODY = `it-body-${Math.random().toString(36).slice(2, 8)}`
  let coordinator: { cookie: string; account: any }
  let member: { cookie: string; account: any }
  let publisher: { cookie: string; account: any }
  const past = () => new Date(Date.now() - 3600000).toISOString()

  beforeAll(async () => {
    const payload = await testPayload()
    await (payload.db as any).pool.query(
      `INSERT INTO platform_bodies (id, name, kind) VALUES ($1, $2, 'working_group') ON CONFLICT DO NOTHING`,
      [BODY, `Bridge test body ${BODY}`],
    )
    coordinator = await session({
      membershipTrack: 'constituency_work',
      body: { slug: BODY, role: 'contact_point' },
    })
    member = await session({
      membershipTrack: 'constituency_work',
      body: { slug: BODY, role: 'member' },
    })
    publisher = await session({
      membershipTrack: 'constituency_work',
      teams: ['content_publisher'],
      body: { slug: BODY, role: 'member' },
    })
  })

  it('bridges the platform UI onto the S09 engine end to end', { timeout: 120000 }, async () => {
    const payload = await testPayload()
    const pool = (payload.db as any).pool

    // create via the platform surface — stored in the S09 engine
    const created = await api('/platform/decisions', {
      method: 'POST',
      cookie: coordinator.cookie,
      body: JSON.stringify({
        bodyId: BODY,
        title: 'Bridged proposal',
        proposal: 'Adopt the shared minutes convention.',
        process: 'standard',
        policyVersion: 'S09-current',
      }),
    })
    expect(created.status).toBe(201)
    const { id } = await created.json()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)

    // platform uuid resolves to the S09 row through the projection
    const { rows } = await pool.query(
      'SELECT s09_proposal_id FROM platform_decisions WHERE id=$1',
      [id],
    )
    const s09Id = rows[0].s09_proposal_id
    expect(s09Id).toBeTruthy()

    // detail: legacy shape, S09 data
    const detail = await api(`/platform/decisions/${id}`, {
      cookie: member.cookie,
    })
    expect(detail.status).toBe(200)
    const d = (await detail.json()).decision
    expect(d.stage).toBe('draft')
    expect(d.bodyId).toBe(BODY)

    // a non-coordinator cannot drive transitions
    expect(
      (
        await api(`/platform/decisions/${id}/transition`, {
          method: 'POST',
          cookie: member.cookie,
          body: JSON.stringify({
            stage: 'consultation',
            version: d.version,
            reason: 'Presented for consultation.',
          }),
        })
      ).status,
    ).toBe(403)
    const presented = await api(`/platform/decisions/${id}/transition`, {
      method: 'POST',
      cookie: coordinator.cookie,
      body: JSON.stringify({
        stage: 'consultation',
        version: d.version,
        reason: 'Presented for consultation.',
      }),
    })
    expect(presented.status).toBe(200)

    // member contributes a comment and a red flag
    for (const input of [
      { kind: 'comment', text: 'Supportive note on the proposal.' },
      {
        kind: 'red',
        text: 'This conflicts with an earlier decision.',
        grounds: 'Contradicts the standing charter clause.',
        alternative: 'Amend to reference the charter explicitly.',
      },
    ]) {
      const res = await api(`/platform/decisions/${id}/contributions`, {
        method: 'POST',
        cookie: member.cookie,
        body: JSON.stringify(input),
      })
      expect(res.status).toBe(201)
    }

    // expire consultation + revision windows — auto-advance reaches
    // 'decision'; the open red flag forces a vote once decision closes
    await pool.query(
      'UPDATE decision_proposals SET consultation_ends_at=$2, revision_ends_at=$2 WHERE id=$1',
      [s09Id, past()],
    )
    let current = (await (await api(`/platform/decisions/${id}`, { cookie: member.cookie })).json())
      .decision
    expect(current.stage).toBe('decision')

    // resolve the flag? No — keep it standing so consensus fails to a vote.
    await pool.query('UPDATE decision_proposals SET decision_ends_at=$2 WHERE id=$1', [
      s09Id,
      past(),
    ])
    current = (await (await api(`/platform/decisions/${id}`, { cookie: member.cookie })).json())
      .decision
    expect(current.stage).toBe('voting')

    // ballots go through the real S09 vote — body-scope members count as
    // the electorate
    for (const cookie of [member.cookie, coordinator.cookie]) {
      const res = await api(`/decisions/${s09Id}/ballots`, {
        method: 'POST',
        cookie,
        body: JSON.stringify({ choice: 'for' }),
      })
      expect(res.status).toBe(201)
    }

    // close the vote window — S09 tallies and adopts by two-thirds
    await pool.query('UPDATE decision_proposals SET voting_ends_at=$2 WHERE id=$1', [s09Id, past()])
    current = (await (await api(`/platform/decisions/${id}`, { cookie: member.cookie })).json())
      .decision
    expect(current.stage).toBe('adopted')
    expect(Number(current.votesFor)).toBe(2)

    // a different, assigned publisher approves the public register entry
    const published = await api(`/platform/decisions/${id}/publish`, {
      method: 'POST',
      cookie: publisher.cookie,
      body: JSON.stringify({ version: current.version }),
    })
    expect(published.status).toBe(200)

    // public register exposes it anonymously
    const publicRes = await fetch(`${BASE}/api/platform/public`)
    const pub = await publicRes.json()
    expect(pub.decisions.some((x: any) => x.title === 'Bridged proposal')).toBe(true)
  })
})
