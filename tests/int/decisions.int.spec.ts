import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { testPayload } from './provision'
import { api, session } from './helpers'

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
    const create = await api('/decisions', {
      method: 'POST',
      cookie: wgContact.cookie,
      body: JSON.stringify({
        title: `Leak check ${Date.now()}`,
        context: 'contract test',
        proposalText: 'Check the listing shape.',
        decisionType: 'snap',
        snapJustification: 'test',
        snapDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
        body: 'working_group',
        bodyRef: 'finance',
      }),
    })
    expect(create.status).toBe(201)
    const res = await api('/decisions', { cookie: cwMember.cookie })
    expect(res.status).toBe(200)
    const { items } = await res.json()
    expect(items.length).toBeGreaterThan(0)
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
      expect(events.items.map((e: AnyValue) => e.type)).toEqual(
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
