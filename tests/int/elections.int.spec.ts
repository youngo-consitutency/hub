import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { getPgPool } from '../../src/lib/pg'
import { api, session } from './helpers'

// the snapshot isn't in the api view, so read it straight from the row
const counts = async (id: number) => {
  const { rows } = await getPgPool()!.query(
    'SELECT eligible_individual_count::int AS i, eligible_org_count::int AS o, status FROM elections WHERE id=$1',
    [id],
  )
  return rows[0]
}

describe('elections (S10) and selections (S24)', () => {
  let facilitator: { cookie: string }
  let cwMember: { cookie: string; account: AnyValue }
  let wgContact: { cookie: string }
  let wgLead: { cookie: string }
  let voter1: { cookie: string; account: AnyValue }
  let voter2: { cookie: string; account: AnyValue }
  let member: { cookie: string; account: AnyValue }
  let pending: { cookie: string; account: AnyValue }

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
    'runs an election: nominate → screen → belenios ballot → voter list → recorded result',
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

      // voting needs a belenios link and an exported voter list first
      const advance = () =>
        api(`/governance/elections/${election.id}/advance`, {
          method: 'POST',
          cookie: facilitator.cookie,
        })
      const early = await advance()
      expect(early.status).toBe(409)
      expect((await early.json()).error.code).toBe('ballot_missing')
      const setBallot = (cookie: string, url: string) =>
        api(`/governance/elections/${election.id}/ballot`, {
          method: 'PUT',
          cookie,
          body: JSON.stringify({ url }),
        })
      const ballotUrl = 'https://vote.belenios.example/elections/abc123/'
      expect((await setBallot(cwMember.cookie, ballotUrl)).status).toBe(403)
      expect((await setBallot(facilitator.cookie, 'http://insecure.example/')).status).toBe(400)
      const linked = await setBallot(facilitator.cookie, ballotUrl)
      expect(linked.status).toBe(200)
      expect((await linked.json()).election.ballotUrl).toBe(ballotUrl)
      const noVoters = await advance()
      expect(noVoters.status).toBe(409)
      expect((await noVoters.json()).error.code).toBe('voters_missing')

      // the voter list holds active constituency work members only, kind in the login
      const exportVoters = (cookie: string) =>
        api(`/governance/elections/${election.id}/voters`, { cookie })
      expect((await exportVoters(cwMember.cookie)).status).toBe(403)
      const voters = await exportVoters(facilitator.cookie)
      expect(voters.status).toBe(200)
      expect(voters.headers.get('content-type')).toMatch(/text\/plain/)
      const lines = (await voters.text()).trim().split('\n')
      const logins = lines.map((line) => line.split(',')[1])
      for (const voter of [voter1, voter2, cwMember]) {
        expect(logins).toContain(`hub-individual-${voter.account.id}`)
      }
      for (const outsider of [member, pending]) {
        expect(logins.some((login) => login.endsWith(`-${outsider.account.id}`))).toBe(false)
      }
      expect(
        lines.every((line) => /^[^,\s]+@[^,\s]+,hub-(individual|organisation)-\d+$/.test(line)),
      ).toBe(true)

      const voting = await advance()
      expect(voting.status).toBe(200)
      const opened = (await voting.json()).election
      expect(opened.status).toBe('voting')
      // once voting opens the link is fixed and the list can't change
      expect((await setBallot(facilitator.cookie, `${ballotUrl}other`)).status).toBe(409)
      expect((await exportVoters(facilitator.cookie)).status).toBe(409)

      // the hub no longer runs its own ballot box
      expect(
        (
          await api(`/governance/elections/${election.id}/credential`, {
            method: 'POST',
            cookie: voter1.cookie,
          })
        ).status,
      ).toBe(404)

      // record what belenios published; malformed or incomplete results are refused
      const record = (cookie: string, body: AnyValue) =>
        api(`/governance/elections/${election.id}/result`, {
          method: 'POST',
          cookie,
          body: JSON.stringify(body),
        })
      const result = {
        archiveUrl: `${ballotUrl}archive`,
        ballotsCast: { individuals: 3, organisations: 0 },
        races: { seat: { elected: [candA.id] } },
      }
      expect((await record(cwMember.cookie, result)).status).toBe(403)
      for (const bad of [
        { ...result, races: { seat: { elected: [999999] } } },
        { ...result, races: { seat: { elected: candA.id } } },
        { ...result, races: {} },
        { ...result, races: { ...result.races, ghost: { elected: [candA.id] } } },
        { ...result, ballotsCast: { individuals: null, organisations: 0 } },
      ]) {
        expect((await record(facilitator.cookie, bad)).status).toBe(400)
      }
      // turnout can't exceed the exported electorate, for either kind
      for (const [kind, ballotsCast] of [
        ['individuals', { individuals: 1_000_000, organisations: 0 }],
        ['organisations', { individuals: 3, organisations: 1_000_000 }],
      ] as const) {
        const over = await record(facilitator.cookie, { ...result, ballotsCast })
        expect(over.status).toBe(400)
        expect((await over.json()).error.fields[kind]).toMatch(/More ballots than eligible/)
      }
      const recorded = await record(facilitator.cookie, result)
      expect(recorded.status).toBe(200)
      const done = (await recorded.json()).election
      expect(done.status).toBe('completed')
      expect(done.result.source).toBe('belenios')
      expect(done.result.races.seat.elected.map((c: AnyValue) => c.id)).toEqual([candA.id])
      expect(done.result.races.seat.elected.map((c: AnyValue) => c.id)).not.toContain(candB.id)
      expect(done.result.ballotsCast.individuals).toBe(3)
    },
  )

  it('restarts a failed election on a fresh ballot', { timeout: 60000 }, async () => {
    const create = await api('/governance/elections', {
      method: 'POST',
      cookie: facilitator.cookie,
      body: JSON.stringify({
        title: `Restart election ${Date.now()}`,
        kind: 'other',
        races: [{ slug: 'seat', label: 'Seat' }],
        quorumIndividuals: 1000,
        quorumOrganisations: 0,
      }),
    })
    const { election } = await create.json()
    const call = (path: string, init: AnyValue = {}) =>
      api(`/governance/elections/${election.id}${path}`, { cookie: facilitator.cookie, ...init })
    await call('/advance', { method: 'POST' })
    const nom = await api(`/governance/elections/${election.id}/candidates`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ race: 'seat', statement: 'Restart candidate' }),
    })
    const cand = (await nom.json()).candidate
    await call(`/candidates/${cand.id}/screen`, {
      method: 'POST',
      body: JSON.stringify({ status: 'screened_in' }),
    })
    await call('/ballot', {
      method: 'PUT',
      body: JSON.stringify({ url: 'https://vote.belenios.example/elections/first/' }),
    })
    await call('/voters')
    await call('/advance', { method: 'POST' })
    // quorum of 1000 can't be met, so the election restarts
    const failed = await call('/result', {
      method: 'POST',
      body: JSON.stringify({
        archiveUrl: 'https://vote.belenios.example/elections/first/archive',
        ballotsCast: { individuals: 2, organisations: 0 },
        races: { seat: { elected: [cand.id] } },
      }),
    })
    const restart = (await failed.json()).election
    expect(restart.status).toBe('restart_required')
    // a failed vote never publishes winners, even if some were submitted
    expect(restart.result.races.seat.elected).toEqual([])
    expect(restart.votingOpensAt).toBeTruthy()
    const reopened = await call('/advance', { method: 'POST' })
    const again = (await reopened.json()).election
    expect(again.status).toBe('nominations')
    expect(again.ballotUrl).toBeNull()
    // the old voting window goes with the spent ballot
    expect(again.votingOpensAt).toBeNull()
    expect(again.votingCloseAt).toBeNull()
    // the spent ballot can't be reused: voting needs a new link
    const stale = await call('/advance', { method: 'POST' })
    expect((await stale.json()).error.code).toBe('ballot_missing')
  })

  it('keeps the voter snapshot fixed once voting opens, even under a race', async () => {
    const create = await api('/governance/elections', {
      method: 'POST',
      cookie: facilitator.cookie,
      body: JSON.stringify({
        title: `Race election ${Date.now()}`,
        kind: 'other',
        races: [{ slug: 'seat', label: 'Seat' }],
      }),
    })
    const { election } = await create.json()
    const call = (path: string, init: AnyValue = {}) =>
      api(`/governance/elections/${election.id}${path}`, { cookie: facilitator.cookie, ...init })
    await call('/advance', { method: 'POST' })
    // voting needs a screened-in candidate in every race
    const nominee = await api(`/governance/elections/${election.id}/candidates`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ race: 'seat', statement: 'Ballot filler' }),
    })
    await call(`/candidates/${(await nominee.json()).candidate.id}/screen`, {
      method: 'POST',
      body: JSON.stringify({ status: 'screened_in' }),
    })
    await call('/ballot', {
      method: 'PUT',
      body: JSON.stringify({ url: 'https://vote.belenios.example/elections/race/' }),
    })
    expect((await call('/voters')).status).toBe(200)
    // sentinel so we can tell whether the racing export wrote
    await getPgPool()!.query(
      'UPDATE elections SET eligible_individual_count=-7, eligible_org_count=-7 WHERE id=$1',
      [election.id],
    )
    const [exported, advanced] = await Promise.all([
      call('/voters'),
      call('/advance', { method: 'POST' }),
    ])
    expect(advanced.status).toBe(200)
    const row = await counts(election.id)
    expect(row.status).toBe('voting')
    if (exported.status === 200) expect(row.i).not.toBe(-7)
    else {
      expect(exported.status).toBe(409)
      expect(row).toMatchObject({ i: -7, o: -7 })
    }
    // after voting opened the export is refused and the snapshot stays put
    const late = await call('/voters')
    expect(late.status).toBe(409)
    expect(await counts(election.id)).toEqual(row)
  })

  it('accepts a quorum-failed result with no winners and restarts', async () => {
    const create = await api('/governance/elections', {
      method: 'POST',
      cookie: facilitator.cookie,
      body: JSON.stringify({
        title: `No-quorum election ${Date.now()}`,
        kind: 'other',
        races: [{ slug: 'seat', label: 'Seat' }],
        quorumIndividuals: 1000,
        quorumOrganisations: 0,
      }),
    })
    const { election } = await create.json()
    const call = (path: string, init: AnyValue = {}) =>
      api(`/governance/elections/${election.id}${path}`, { cookie: facilitator.cookie, ...init })
    await call('/advance', { method: 'POST' })
    // voting needs a screened-in candidate in every race
    const nominee = await api(`/governance/elections/${election.id}/candidates`, {
      method: 'POST',
      cookie: cwMember.cookie,
      body: JSON.stringify({ race: 'seat', statement: 'Ballot filler' }),
    })
    await call(`/candidates/${(await nominee.json()).candidate.id}/screen`, {
      method: 'POST',
      body: JSON.stringify({ status: 'screened_in' }),
    })
    await call('/ballot', {
      method: 'PUT',
      body: JSON.stringify({ url: 'https://vote.belenios.example/elections/noquorum/' }),
    })
    await call('/voters')
    await call('/advance', { method: 'POST' })
    const result = (races: AnyValue) =>
      call('/result', {
        method: 'POST',
        body: JSON.stringify({
          archiveUrl: 'https://vote.belenios.example/elections/noquorum/archive',
          ballotsCast: { individuals: 2, organisations: 0 },
          races,
        }),
      })
    // submitted ids still have to be screened in, quorum or not
    expect((await result({ seat: { elected: [999999] } })).status).toBe(400)
    const res = await result({ seat: { elected: [] } })
    expect(res.status).toBe(200)
    const done = (await res.json()).election
    expect(done.status).toBe('restart_required')
    expect(done.result.races.seat.elected).toEqual([])
  })

  it('freezes screening at voting and records one result under a double submit', async () => {
    const open = async (label: string) => {
      const create = await api('/governance/elections', {
        method: 'POST',
        cookie: facilitator.cookie,
        body: JSON.stringify({
          title: `${label} election ${Date.now()}`,
          kind: 'other',
          races: [{ slug: 'seat', label: 'Seat' }],
          quorumIndividuals: 1,
          quorumOrganisations: 0,
        }),
      })
      const { election } = await create.json()
      const call = (path: string, init: AnyValue = {}) =>
        api(`/governance/elections/${election.id}${path}`, { cookie: facilitator.cookie, ...init })
      await call('/advance', { method: 'POST' })
      return call
    }
    const call = await open('Freeze')
    const other = await open('Other')
    const nom = await call('/candidates', {
      method: 'POST',
      cookie: voter1.cookie,
      body: JSON.stringify({ race: 'seat', statement: 'Freeze candidate' }),
    })
    const cand = (await nom.json()).candidate
    const screen = (via: typeof call) =>
      via(`/candidates/${cand.id}/screen`, {
        method: 'POST',
        body: JSON.stringify({ status: 'screened_in' }),
      })
    // a candidate can't be screened through another election's route
    expect((await screen(other)).status).toBe(404)
    expect((await screen(call)).status).toBe(200)
    await call('/ballot', {
      method: 'PUT',
      body: JSON.stringify({ url: 'https://vote.belenios.example/elections/freeze/' }),
    })
    await call('/voters')
    await call('/advance', { method: 'POST' })
    // the ballot list is fixed once voting opens
    expect((await screen(call)).status).toBe(409)
    const submit = () =>
      call('/result', {
        method: 'POST',
        body: JSON.stringify({
          archiveUrl: 'https://vote.belenios.example/elections/freeze/archive',
          ballotsCast: { individuals: 1, organisations: 0 },
          races: { seat: { elected: [cand.id] } },
        }),
      })
    const statuses = (await Promise.all([submit(), submit()])).map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409])
  })

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
