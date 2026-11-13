import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { api, session } from './helpers'

describe('elections hardening (S10)', () => {
  let facilitator: { cookie: string }
  let candidate: { cookie: string }

  beforeAll(async () => {
    facilitator = await session({
      membershipTrack: 'constituency_work',
      teams: ['election_facilitation'],
    })
    candidate = await session({ membershipTrack: 'constituency_work' })
  })

  const create = (body: AnyValue) =>
    api('/governance/elections', {
      method: 'POST',
      cookie: facilitator.cookie,
      body: JSON.stringify({ title: `Hardening ${Date.now()}`, kind: 'other', ...body }),
    })

  const drive = async (races: AnyValue[], quorumIndividuals = 1000) => {
    const res = await create({ races, quorumIndividuals, quorumOrganisations: 0 })
    expect(res.status).toBe(201)
    const { election } = await res.json()
    const call = (path: string, init: AnyValue = {}) =>
      api(`/governance/elections/${election.id}${path}`, { cookie: facilitator.cookie, ...init })
    return { election, call }
  }

  describe('input validation', () => {
    const bad = async (body: AnyValue, field: string) => {
      const res = await create(body)
      expect(res.status).toBe(400)
      const { error } = await res.json()
      expect(error.code).toBe('validation')
      expect(error.fields[field]).toBeTruthy()
    }
    const seat = [{ slug: 'seat' }]

    it('rejects a missing or blank title and strips markup', async () => {
      await bad({ title: '   ', races: seat }, 'title')
      await bad({ title: 42, races: seat }, 'title')
      const ok = await create({ title: '<b>Spring</b> vote', races: seat })
      expect(ok.status).toBe(201)
      expect((await ok.json()).election.title).toBe('Spring vote')
    })

    it('rejects a non-string description', async () => {
      await bad({ races: seat, description: { a: 1 } }, 'description')
    })

    it('rejects race slugs that are missing, empty, odd or duplicated', async () => {
      await bad({ races: [{ label: 'No slug' }] }, 'races.0.slug')
      await bad({ races: [{ slug: '' }] }, 'races.0.slug')
      await bad({ races: [{ slug: '   ' }] }, 'races.0.slug')
      await bad({ races: [{ slug: 'has space' }] }, 'races.0.slug')
      await bad({ races: [{ slug: '__proto__' }] }, 'races.0.slug')
      await bad({ races: [{ slug: 'seat' }, { slug: 'SEAT' }] }, 'races')
      await bad({ races: [] }, 'races')
      await bad({ races: 'seat' }, 'races')
    })

    it('rejects quorum values that are not non-negative integers', async () => {
      await bad({ races: seat, quorumIndividuals: -1 }, 'quorumIndividuals')
      await bad({ races: seat, quorumIndividuals: 1.5 }, 'quorumIndividuals')
      await bad({ races: seat, quorumOrganisations: '25' }, 'quorumOrganisations')
      await bad({ races: seat, quorumOrganisations: null }, 'quorumOrganisations')
    })

    it('still accepts zero quorum and applies defaults', async () => {
      const zero = await create({ races: seat, quorumIndividuals: 0, quorumOrganisations: 0 })
      expect(zero.status).toBe(201)
      const dflt = await create({ races: seat })
      const { election } = await dflt.json()
      expect(election.quorumIndividuals).toBe(100)
      expect(election.quorumOrganisations).toBe(25)
    })

    it('only accepts an https videoUrl on a candidacy', async () => {
      const { election, call } = await drive(seat)
      await call('/advance', { method: 'POST' })
      for (const videoUrl of ['javascript:alert(1)', 'http://example.com/v', 'nonsense']) {
        const res = await api(`/governance/elections/${election.id}/candidates`, {
          method: 'POST',
          cookie: candidate.cookie,
          body: JSON.stringify({ race: 'seat', statement: 'Me', videoUrl }),
        })
        expect(res.status).toBe(400)
        expect((await res.json()).error.fields.videoUrl).toBeTruthy()
      }
      const ok = await api(`/governance/elections/${election.id}/candidates`, {
        method: 'POST',
        cookie: candidate.cookie,
        body: JSON.stringify({ race: 'seat', statement: 'Me', videoUrl: 'https://example.com/v' }),
      })
      expect(ok.status).toBe(201)
    })
  })

  describe('candidacies and voting', () => {
    const prepare = async (call: AnyValue) => {
      await call('/ballot', {
        method: 'PUT',
        body: JSON.stringify({ url: 'https://vote.belenios.example/elections/h/' }),
      })
      await call('/voters')
    }

    it('will not open voting while a race has no screened-in candidate', async () => {
      const { election, call } = await drive([{ slug: 'a' }, { slug: 'b' }])
      await call('/advance', { method: 'POST' })
      const nom = await api(`/governance/elections/${election.id}/candidates`, {
        method: 'POST',
        cookie: candidate.cookie,
        body: JSON.stringify({ race: 'a', statement: 'Only race a' }),
      })
      const cand = (await nom.json()).candidate
      await call(`/candidates/${cand.id}/screen`, {
        method: 'POST',
        body: JSON.stringify({ status: 'screened_in' }),
      })
      await prepare(call)
      const res = await call('/advance', { method: 'POST' })
      expect(res.status).toBe(409)
      const { error } = await res.json()
      expect(error.code).toBe('race_without_candidate')
      expect(error.fields.b).toBeTruthy()
      expect(error.fields.a).toBeUndefined()
      const state = await call('', {})
      expect((await state.json()).election.status).toBe('nominations')
    })

    it('treats a restart as a new vote: candidacies go back to screening', async () => {
      const { election, call } = await drive([{ slug: 'seat' }])
      await call('/advance', { method: 'POST' })
      const nom = await api(`/governance/elections/${election.id}/candidates`, {
        method: 'POST',
        cookie: candidate.cookie,
        body: JSON.stringify({ race: 'seat', statement: 'Round one' }),
      })
      const cand = (await nom.json()).candidate
      await call(`/candidates/${cand.id}/screen`, {
        method: 'POST',
        body: JSON.stringify({ status: 'screened_in' }),
      })
      await prepare(call)
      expect((await call('/advance', { method: 'POST' })).status).toBe(200)
      const failed = await call('/result', {
        method: 'POST',
        body: JSON.stringify({
          archiveUrl: 'https://vote.belenios.example/elections/h/archive',
          ballotsCast: { individuals: 1, organisations: 0 },
          races: { seat: { elected: [] } },
        }),
      })
      expect((await failed.json()).election.status).toBe('restart_required')

      const reopened = await call('/advance', { method: 'POST' })
      expect((await reopened.json()).election.status).toBe('nominations')
      const after = (await (await call('', {})).json()).election
      // nobody is on the new ballot until the facilitators screen again
      expect(after.candidateCount).toBe(0)

      await prepare(call)
      const early = await call('/advance', { method: 'POST' })
      expect(early.status).toBe(409)
      expect((await early.json()).error.code).toBe('race_without_candidate')

      // the candidacy survives and can be screened in for the new round
      await call(`/candidates/${cand.id}/screen`, {
        method: 'POST',
        body: JSON.stringify({ status: 'screened_in' }),
      })
      expect((await call('/advance', { method: 'POST' })).status).toBe(200)
    })
  })
})
