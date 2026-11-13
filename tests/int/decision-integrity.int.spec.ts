import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { isUniqueViolation } from '../../src/lib/pg'
import { testPayload } from './provision'
import { api, session, BASE } from './helpers'
import { expireVote, expireWindows, jsonBody, makeVotingProposal } from './decisionFixtures'

// Decision-integrity regressions: who may propose, no early close, one ballot
// per council seat, writes that can't slip past a closing transition, child
// ownership, snap deadlines, the bridge tally and the cron sweep.

const slug = () => `it${Math.random().toString(36).slice(2, 8)}`
const pool = async () => ((await testPayload()).db as AnyValue).pool

function standard(scope: { body: string; bodyRef?: string }, extra: AnyValue = {}) {
  return jsonBody({
    title: `Integrity ${Date.now()}`,
    context: 'contract test',
    proposalText: 'Do the test thing.',
    decisionType: 'standard',
    ...scope,
    ...extra,
  })
}

async function createAndPresent(cookie: string, scope: { body: string; bodyRef?: string }) {
  const created = await api('/decisions', { method: 'POST', cookie, body: standard(scope) })
  expect(created.status).toBe(201)
  const { proposal } = await created.json()
  const present = await api(`/decisions/${proposal.id}/present`, { method: 'POST', cookie })
  expect(present.status).toBe(200)
  return proposal as AnyValue
}

describe('who may propose, and no early close (H3)', () => {
  let outsider: { cookie: string; account: AnyValue }
  let insider: { cookie: string }
  let network: { cookie: string }
  const WG = slug()

  beforeAll(async () => {
    insider = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'member' },
    })
    outsider = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: slug(), role: 'member' },
    })
    network = await session({})
  })

  it('refuses proposals to a body the proposer does not sit in', async () => {
    const scope = { body: 'working_group', bodyRef: WG }
    expect(
      (await api('/decisions', { method: 'POST', cookie: outsider.cookie, body: standard(scope) }))
        .status,
    ).toBe(403)
    expect(
      (await api('/decisions', { method: 'POST', cookie: network.cookie, body: standard(scope) }))
        .status,
    ).toBe(403)
    expect(
      (
        await api('/decisions', {
          method: 'POST',
          cookie: outsider.cookie,
          body: standard({ body: 'council' }),
        })
      ).status,
    ).toBe(403)
    expect(
      (await api('/decisions', { method: 'POST', cookie: insider.cookie, body: standard(scope) }))
        .status,
    ).toBe(201)
  })

  it('refuses contact persons from outside the body', async () => {
    const scope = { body: 'working_group', bodyRef: WG }
    const res = await api('/decisions', {
      method: 'POST',
      cookie: insider.cookie,
      body: standard(scope, { contactPersons: [outsider.account.id] }),
    })
    expect(res.status).toBe(400)
  })

  it('offers the proposer no way to shorten the statutory windows', async () => {
    const proposal = await createAndPresent(insider.cookie, { body: 'working_group', bodyRef: WG })
    const close = await api(`/decisions/${proposal.id}/close`, {
      method: 'POST',
      cookie: insider.cookie,
    })
    expect(close.status).toBe(404)
    const read = await api(`/decisions/${proposal.id}`, { cookie: insider.cookie })
    expect((await read.json()).proposal.status).toBe('consultation')
  })
})

describe('one ballot per council seat (H4)', () => {
  const SEAT = slug()
  let a: { cookie: string; account: AnyValue }
  let b: { cookie: string; account: AnyValue }
  let sub: { cookie: string; account: AnyValue }
  let fp1: { cookie: string }
  let fp2: { cookie: string }

  beforeAll(async () => {
    const seat = [{ role: 'wg.contact_point', scopeType: 'working_group', scopeId: SEAT }]
    a = await session({ membershipTrack: 'constituency_work', records: seat })
    b = await session({ membershipTrack: 'constituency_work', records: seat })
    sub = await session({ membershipTrack: 'constituency_work' })
    const fpRecord = [{ role: 'focal_point', scopeType: 'platform', scopeId: 'platform' }]
    fp1 = await session({ membershipTrack: 'constituency_work', records: fpRecord })
    fp2 = await session({ membershipTrack: 'constituency_work', records: fpRecord })
  })

  const vote = (cookie: string, id: number, choice = 'for') =>
    api(`/decisions/${id}/ballots`, { method: 'POST', cookie, body: jsonBody({ choice }) })

  it('lets a shared seat vote once and refuses its other holders', { timeout: 90000 }, async () => {
    const voting = await makeVotingProposal(a, a, { body: 'council' })
    expect((await vote(a.cookie, voting.id)).status).toBe(201)
    const second = await vote(b.cookie, voting.id)
    expect(second.status).toBe(409)
    expect((await second.json()).error.code).toBe('already_voted')
  })

  it('treats a substitute as the principal, never an extra vote', { timeout: 90000 }, async () => {
    const principal = await session({ membershipTrack: 'constituency_work' })
    const { grantAuthority } = await import('@/lib/authorityService')
    const req = { payload: await testPayload(), headers: new Headers() } as AnyValue
    const record = await grantAuthority(req, {
      account: principal.account.id,
      role: 'wg.contact_point',
      scopeType: 'working_group',
      scopeId: slug(),
    })
    await grantAuthority(req, {
      account: sub.account.id,
      role: 'council.substitute',
      scopeType: 'platform',
      scopeId: 'platform',
      substituteFor: (record as AnyValue).id,
    })
    const voting = await makeVotingProposal(principal, principal, { body: 'council' })
    expect((await vote(principal.cookie, voting.id)).status).toBe(201)
    expect((await vote(sub.cookie, voting.id)).status).toBe(409)
  })

  it('still counts the two personal focal point seats separately', { timeout: 90000 }, async () => {
    const voting = await makeVotingProposal(fp1, fp1, { body: 'council' })
    expect((await vote(fp1.cookie, voting.id)).status).toBe(201)
    expect((await vote(fp2.cookie, voting.id)).status).toBe(201)
  })

  it(
    'enforces the seat in the database, not only in the endpoint',
    { timeout: 90000 },
    async () => {
      const payload = await testPayload()
      const voting = await makeVotingProposal(a, a, { body: 'council' })
      const row = (account: number) => ({
        collection: 'decision-ballots' as const,
        data: {
          proposal: voting.id,
          account,
          seat: `wg:${SEAT}`,
          choice: 'for',
          castAt: new Date().toISOString(),
        } as AnyValue,
        overrideAccess: true,
      })
      await payload.create(row(a.account.id))
      const error = await payload.create(row(b.account.id)).catch((e: unknown) => e)
      expect(isUniqueViolation(error, 'decision-ballots', 'decision_ballots')).toBe(true)
    },
  )
})

describe('writes cannot slip past a closing transition (finding 3)', () => {
  let contact: { cookie: string }
  let voter: { cookie: string }
  const WG = slug()

  beforeAll(async () => {
    contact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'contact' },
    })
    voter = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'member' },
    })
  })

  // holds the row lock the way an in-flight closer does, then lets the
  // request run into it and finishes the transition underneath it
  async function raceAgainstCloser(
    id: number,
    finalStatus: string,
    request: () => Promise<Response>,
  ) {
    const client = await (await pool()).connect()
    try {
      await client.query('BEGIN')
      await client.query('UPDATE decision_proposals SET status=status WHERE id=$1', [id])
      const inFlight = request()
      const settled = await Promise.race([
        inFlight.then(() => 'settled'),
        new Promise((r) => setTimeout(() => r('blocked'), 1500)),
      ])
      await client.query('UPDATE decision_proposals SET status=$2 WHERE id=$1', [id, finalStatus])
      await client.query('COMMIT')
      return { settled, res: await inFlight }
    } finally {
      client.release()
    }
  }

  it('refuses a flag that lands after the outcome', { timeout: 60000 }, async () => {
    const proposal = await createAndPresent(contact.cookie, { body: 'working_group', bodyRef: WG })
    await (
      await pool()
    ).query("UPDATE decision_proposals SET status='decision' WHERE id=$1", [proposal.id])
    const { settled, res } = await raceAgainstCloser(proposal.id, 'adopted', () =>
      api(`/decisions/${proposal.id}/flags`, {
        method: 'POST',
        cookie: voter.cookie,
        body: jsonBody({ kind: 'grey', reason: 'late' }),
      }),
    )
    expect(settled).toBe('blocked')
    expect(res.status).toBe(409)
    const { rows } = await (
      await pool()
    ).query('SELECT count(*)::int AS n FROM decision_flags WHERE proposal_id=$1', [proposal.id])
    expect(rows[0].n).toBe(0)
  })

  it('refuses a ballot that lands after the tally', { timeout: 90000 }, async () => {
    const voting = await makeVotingProposal(contact, voter, { body: 'working_group', bodyRef: WG })
    const { settled, res } = await raceAgainstCloser(voting.id, 'rejected', () =>
      api(`/decisions/${voting.id}/ballots`, {
        method: 'POST',
        cookie: voter.cookie,
        body: jsonBody({ choice: 'for' }),
      }),
    )
    expect(settled).toBe('blocked')
    expect(res.status).toBe(409)
    const { rows } = await (
      await pool()
    ).query('SELECT count(*)::int AS n FROM decision_ballots WHERE proposal_id=$1', [voting.id])
    expect(rows[0].n).toBe(0)
  })
})

describe('child rows answer only under their own proposal (finding 4)', () => {
  let contact: { cookie: string }
  let member: { cookie: string }
  let coordinator: { cookie: string }
  const WG = slug()

  beforeAll(async () => {
    contact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'contact' },
    })
    member = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'member' },
    })
    coordinator = await session({
      membershipTrack: 'constituency_work',
      records: [{ role: 'gct.coordinator', scopeType: 'team', scopeId: 'gct' }],
    })
  })

  it('404s a flag addressed through another proposal', { timeout: 60000 }, async () => {
    const scope = { body: 'working_group', bodyRef: WG }
    const one = await createAndPresent(contact.cookie, scope)
    const other = await createAndPresent(contact.cookie, scope)
    const flag = await api(`/decisions/${one.id}/flags`, {
      method: 'POST',
      cookie: member.cookie,
      body: jsonBody({ kind: 'grey', reason: 'x' }),
    })
    const flagId = (await flag.json()).flag.id
    for (const action of ['respond', 'withdraw']) {
      const res = await api(`/decisions/${other.id}/flags/${flagId}/${action}`, {
        method: 'POST',
        cookie: action === 'respond' ? contact.cookie : member.cookie,
        body: jsonBody({ responseNote: 'x' }),
      })
      expect(res.status, action).toBe(404)
    }
    const { rows } = await (
      await pool()
    ).query('SELECT status FROM decision_flags WHERE id=$1', [flagId])
    expect(rows[0].status).toBe('open')
  })

  it('404s a veto confirmed through another proposal', { timeout: 90000 }, async () => {
    const scope = { body: 'working_group', bodyRef: WG }
    const voting = await makeVotingProposal(contact, member, scope)
    const other = await createAndPresent(contact.cookie, scope)
    const veto = await api(`/decisions/${voting.id}/vetoes`, {
      method: 'POST',
      cookie: member.cookie,
      body: jsonBody({
        requesterKind: 'wg_or_ot',
        groupKey: WG,
        reasoning: 'Reasoning for the record.',
      }),
    })
    const vetoId = (await veto.json()).veto.id
    const res = await api(`/decisions/${other.id}/vetoes/${vetoId}/confirm`, {
      method: 'POST',
      cookie: coordinator.cookie,
    })
    expect(res.status).toBe(404)
    const { rows } = await (
      await pool()
    ).query('SELECT status FROM decision_vetoes WHERE id=$1', [vetoId])
    expect(rows[0].status).toBe('pending')
  })
})

describe('snap deadlines (finding 5)', () => {
  let contact: { cookie: string }
  const WG = slug()

  beforeAll(async () => {
    contact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'contact' },
    })
  })

  const snap = (deadline: string) =>
    jsonBody({
      title: 'Snap',
      context: 'x',
      proposalText: 'x',
      decisionType: 'snap',
      snapJustification: 'urgent',
      snapDeadline: deadline,
      body: 'working_group',
      bodyRef: WG,
    })

  it('refuses a snap deadline already in the past', async () => {
    const res = await api('/decisions', {
      method: 'POST',
      cookie: contact.cookie,
      body: snap(new Date(Date.now() - 3600000).toISOString()),
    })
    expect(res.status).toBe(400)
  })

  it('answers presenting after the deadline with 409, not 500', async () => {
    const created = await api('/decisions', {
      method: 'POST',
      cookie: contact.cookie,
      body: snap(new Date(Date.now() + 3600000).toISOString()),
    })
    const { proposal } = await created.json()
    await (
      await pool()
    ).query("UPDATE decision_proposals SET snap_deadline=now() - interval '1 hour' WHERE id=$1", [
      proposal.id,
    ])
    const res = await api(`/decisions/${proposal.id}/present`, {
      method: 'POST',
      cookie: contact.cookie,
    })
    expect(res.status).toBe(409)
  })
})

describe('platform bridge decides from stored ballots (finding 6)', () => {
  const BODY = `it-body-${Math.random().toString(36).slice(2, 8)}`
  let coordinator: { cookie: string }
  let id: string
  let s09Id: number

  beforeAll(async () => {
    await (
      await pool()
    ).query(
      `INSERT INTO platform_bodies (id, name, kind) VALUES ($1, $2, 'working_group') ON CONFLICT DO NOTHING`,
      [BODY, `Bridge integrity ${BODY}`],
    )
    coordinator = await session({
      membershipTrack: 'constituency_work',
      body: { slug: BODY, role: 'contact_point' },
    })
  })

  // a vote-phase proposal with no deadline, the shape a manual tally needed
  async function openVoteProposal() {
    const created = await api('/platform/decisions', {
      method: 'POST',
      cookie: coordinator.cookie,
      body: jsonBody({
        bodyId: BODY,
        title: 'Bridge integrity',
        proposal: 'Adopt the thing.',
        process: 'standard',
        policyVersion: 'S09-current',
      }),
    })
    expect(created.status).toBe(201)
    id = (await created.json()).id
    const { rows } = await (
      await pool()
    ).query('SELECT s09_proposal_id FROM platform_decisions WHERE id=$1', [id])
    s09Id = rows[0].s09_proposal_id
    await (
      await pool()
    ).query(
      "UPDATE decision_proposals SET status='voting', eligible_voter_count=10, voting_ends_at=NULL WHERE id=$1",
      [s09Id],
    )
  }

  const detail = async () =>
    (await (await api(`/platform/decisions/${id}`, { cookie: coordinator.cookie })).json()).decision
  const transition = async (body: AnyValue) =>
    api(`/platform/decisions/${id}/transition`, {
      method: 'POST',
      cookie: coordinator.cookie,
      body: jsonBody({ version: (await detail()).version, ...body }),
    })

  it('ignores client-typed vote counts', { timeout: 60000 }, async () => {
    await openVoteProposal()
    const res = await transition({
      stage: 'adopted',
      reason: 'Typed tally',
      evidence: 'Typed by the facilitator',
      electorateSize: 10,
      votesFor: 10,
      votesAgainst: 0,
    })
    expect(res.status).toBe(409)
    expect((await detail()).stage).toBe('voting')
  })

  it('stops a vote only through confirmed veto requests', { timeout: 60000 }, async () => {
    await openVoteProposal()
    const res = await transition({
      stage: 'withdrawn',
      outcomeBasis: 'formal_veto',
      reason: 'Typed veto',
      vetoOrganisations: 25,
      vetoGlobalSouth: 0,
      vetoBodies: 0,
    })
    expect(res.status).toBe(409)
    expect((await detail()).stage).toBe('voting')
  })

  it('treats an addressed red flag as standing, like the closer', { timeout: 60000 }, async () => {
    await openVoteProposal()
    await (
      await pool()
    ).query("UPDATE decision_proposals SET status='decision', decision_ends_at=NULL WHERE id=$1", [
      s09Id,
    ])
    const payload = await testPayload()
    await payload.create({
      collection: 'decision-flags',
      data: {
        proposal: s09Id,
        kind: 'red',
        rationaleCategory: 'mission_misalignment',
        reason: 'x',
        alternative: 'y',
        raisedBy: (await payload.find({ collection: 'accounts', limit: 1, overrideAccess: true }))
          .docs[0].id,
        status: 'addressed',
        raisedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    const res = await transition({
      stage: 'adopted',
      reason: 'Consensus',
      evidence: 'Minutes',
    })
    expect(res.status).toBe(409)
    expect((await detail()).stage).toBe('decision')
  })
})

describe('cron sweep (finding 7)', () => {
  const WG = slug()
  let contact: { cookie: string }

  beforeAll(async () => {
    contact = await session({
      membershipTrack: 'constituency_work',
      wg: { slug: WG, role: 'contact' },
    })
  })

  it('fails closed without the CRON_SECRET bearer', async () => {
    expect((await fetch(`${BASE}/api/cron/decisions-sweep`)).status).toBe(401)
    const wrong = await fetch(`${BASE}/api/cron/decisions-sweep`, {
      headers: { Authorization: 'Bearer not-the-secret' },
    })
    expect(wrong.status).toBe(401)
  })

  it(
    'advances overdue proposals without any read, and is idempotent',
    { timeout: 60000 },
    async () => {
      const proposal = await createAndPresent(contact.cookie, {
        body: 'working_group',
        bodyRef: WG,
      })
      await expireWindows(proposal.id)
      await expireVote(proposal.id)
      const { sweepDueDecisions } = await import('@/lib/decisionRuntime')
      const req = { payload: await testPayload(), headers: new Headers() } as AnyValue
      const first = await sweepDueDecisions(req)
      expect(first.failed).toBe(0)
      const status = async () =>
        (
          await (
            await pool()
          ).query('SELECT status FROM decision_proposals WHERE id=$1', [proposal.id])
        ).rows[0].status
      expect(await status()).toBe('adopted')
      const second = await sweepDueDecisions(req)
      expect(second.failed).toBe(0)
      expect(await status()).toBe('adopted')
      const { rows } = await (
        await pool()
      ).query(
        "SELECT count(*)::int AS n FROM decision_events WHERE proposal_id=$1 AND type='adopted'",
        [proposal.id],
      )
      expect(rows[0].n).toBe(1)
    },
  )
})
