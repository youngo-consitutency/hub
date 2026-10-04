import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { api, session } from './helpers'

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
      teams: ['election_facilitation', 'selection_team'],
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
    const create = await api('/governance/elections', {
      method: 'POST',
      cookie: facilitator.cookie,
      body: JSON.stringify({
        title: `Listing election ${Date.now()}`,
        kind: 'other',
        races: [{ slug: 'seat', label: 'Seat' }],
        quorumIndividuals: 1,
        quorumOrganisations: 0,
      }),
    })
    expect(create.status).toBe(201)
    const res = await api('/governance/elections', { cookie: cwMember.cookie })
    expect(res.status).toBe(200)
    const { items } = await res.json()
    expect(items.length).toBeGreaterThan(0)
    // results are only exposed once an election resolves
    const done = items.find((e: AnyValue) => e.status === 'completed')
    if (done) expect(done.result).toBeTruthy()
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
