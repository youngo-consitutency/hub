import type { AnyValue } from '../../src/lib/domain'
import { describe, it, beforeAll, expect } from 'vitest'

import { api, session } from './helpers'
import { testPayload } from './provision'

type Who = { cookie: string; account: AnyValue }

describe('selections (S24)', () => {
  let team: Who
  let c1: Who
  let c2: Who
  let c3: Who
  let applicant: Who
  let applicant2: Who
  let plain: Who

  beforeAll(async () => {
    team = await session({ membershipTrack: 'constituency_work', teams: ['selection_team'] })
    c1 = await session({ membershipTrack: 'constituency_work' })
    c2 = await session({ membershipTrack: 'constituency_work' })
    c3 = await session({ membershipTrack: 'constituency_work' })
    applicant = await session({ membershipTrack: 'constituency_work' })
    applicant2 = await session({ membershipTrack: 'constituency_work' })
    plain = await session({})
  })

  const post = (id: number, path: string, who: Who, body?: AnyValue) =>
    api(`/governance/selections/${id}${path}`, {
      method: 'POST',
      cookie: who.cookie,
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

  const makeSelection = async (extra: AnyValue = {}) => {
    const res = await api('/governance/selections', {
      method: 'POST',
      cookie: team.cookie,
      body: JSON.stringify({
        title: `Selection ${Date.now()}`,
        opportunityNote: 'test opportunity',
        method: 'colour',
        spotsAvailable: 1,
        ...extra,
      }),
    })
    expect(res.status).toBe(201)
    return (await res.json()).selection as AnyValue
  }

  // committee of three, opened for applications
  const openSelection = async (extra: AnyValue = {}) => {
    const selection = await makeSelection(extra)
    for (const who of [c1, c2, c3])
      expect((await post(selection.id, '/committee', who)).status).toBe(201)
    expect((await post(selection.id, '/open', team)).status).toBe(200)
    return selection
  }

  const apply = async (id: number, who: Who) => {
    const res = await post(id, '/apply', who, { answers: { motivation: 'because' } })
    expect(res.status).toBe(201)
    return (await res.json()).application as AnyValue
  }

  const evaluating = async () => {
    const selection = await openSelection()
    const a = await apply(selection.id, applicant)
    const b = await apply(selection.id, applicant2)
    expect((await post(selection.id, '/close', team)).status).toBe(200)
    return { selection, a, b }
  }

  const grade = (id: number, aid: number, who: Who, body: AnyValue = { grade: 'green' }) =>
    post(id, `/applications/${aid}/evaluate`, who, body)

  it('runs the happy path: committee, apply, evaluate, decide, announce', async () => {
    const { selection, a, b } = await evaluating()
    expect((await grade(selection.id, a.id, c1)).status).toBe(200)
    expect((await grade(selection.id, a.id, c2, { grade: 'yellow' })).status).toBe(200)
    // regrading replaces the member's earlier grade
    expect((await grade(selection.id, a.id, c2, { grade: 'red' })).status).toBe(200)
    expect((await grade(selection.id, b.id, c3, { grade: 'orange' })).status).toBe(200)
    const decide = await post(selection.id, '/decide', team, {
      selectedApplicationIds: [a.id],
      selectionSummary: 'a wins',
    })
    expect(decide.status).toBe(200)
    expect((await decide.json()).selection.status).toBe('decided')
    const announce = await post(selection.id, '/announce', team)
    const out = await announce.json()
    expect(out.selection.status).toBe('announced')
    expect(out.selected.map((s: AnyValue) => s.id)).toEqual([a.id])
    // the announcement carries a public reference, not account records
    expect(JSON.stringify(out)).not.toMatch(/legacyPassword|dateOfBirth|"email"|"phone"/)
  })

  it('keeps non-verified members and non-selectors out', async () => {
    const selection = await makeSelection()
    expect((await post(selection.id, '/committee', plain)).status).toBe(403)
    expect((await post(selection.id, '/open', c1)).status).toBe(403)
  })

  describe('conflicts of interest', () => {
    it('lets neither a committee member apply nor an applicant join the committee', async () => {
      const selection = await makeSelection()
      expect((await post(selection.id, '/committee', c1)).status).toBe(201)
      expect((await post(selection.id, '/committee', c2)).status).toBe(201)
      expect((await post(selection.id, '/committee', c3)).status).toBe(201)
      expect((await post(selection.id, '/open', team)).status).toBe(200)
      // c1 sits on the committee, so may not apply to the same selection
      const own = await post(selection.id, '/apply', c1, { answers: { motivation: 'me' } })
      expect(own.status).toBe(409)
      expect((await own.json()).error.code).toBe('conflict_of_interest')
      // an applicant may not join while applications are open
      await apply(selection.id, applicant)
      const join = await post(selection.id, '/committee', applicant)
      expect(join.status).toBe(409)
      expect((await join.json()).error.code).toBe('conflict_of_interest')
    })

    it('blocks scoring your own application', async () => {
      const { selection } = await evaluating()
      // a membership that predates the check: seat plus application, written directly
      const payload = await testPayload()
      const mixed = await session({ membershipTrack: 'constituency_work' })
      await payload.create({
        collection: 'selection-committee',
        data: {
          selection: selection.id,
          account: mixed.account.id,
          joinedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      const own = await payload.create({
        collection: 'selection-applications',
        data: {
          selection: selection.id,
          account: mixed.account.id,
          answers: { motivation: 'me' },
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      const res = await grade(selection.id, own.id as number, mixed)
      expect(res.status).toBe(409)
      expect((await res.json()).error.code).toBe('conflict_of_interest')
    })

    it('rejects a recusal naming applications outside the selection', async () => {
      const { selection } = await evaluating()
      const other = await openSelection()
      const foreign = await apply(other.id, applicant)
      const res = await post(selection.id, '/recuse', c1, { applicantIds: [foreign.id] })
      expect(res.status).toBe(400)
    })
  })

  describe('evaluate', () => {
    it('refuses an application from another selection', async () => {
      const { selection } = await evaluating()
      const other = await openSelection()
      const foreign = await apply(other.id, applicant)
      const res = await grade(selection.id, foreign.id, c1)
      expect(res.status).toBe(404)
    })

    it('refuses an unknown application and bad grades', async () => {
      const { selection, a } = await evaluating()
      expect((await grade(selection.id, 999999999, c1)).status).toBe(404)
      expect((await grade(selection.id, a.id, c1, { grade: 'purple' })).status).toBe(400)
    })
  })

  describe('decide', () => {
    it('refuses applications that are not part of this selection', async () => {
      const { selection, a } = await evaluating()
      const other = await openSelection()
      const foreign = await apply(other.id, applicant)
      const res = await post(selection.id, '/decide', team, {
        selectedApplicationIds: [foreign.id],
      })
      expect(res.status).toBe(400)
      expect((await res.json()).error.fields.selectedApplicationIds).toBeTruthy()
      // nothing moved
      const view = await api(`/governance/selections/${selection.id}`, { cookie: c1.cookie })
      expect((await view.json()).selection.status).toBe('evaluating')
      expect(a.id).toBeTruthy()
    })

    it('records one decision under a double submit', async () => {
      const { selection, a, b } = await evaluating()
      const submit = (pick: AnyValue) =>
        post(selection.id, '/decide', team, { selectedApplicationIds: [pick.id] })
      const picks = [a, b]
      const results = await Promise.all(picks.map(submit))
      expect(results.map((r) => r.status).sort()).toEqual([200, 409])
      const winner = picks[results.findIndex((r) => r.status === 200)]
      const loser = picks.find((p) => p !== winner)!
      // the application statuses match the one decision that won
      const payload = await testPayload()
      const { docs } = await payload.find({
        collection: 'selection-applications',
        where: { selection: { equals: selection.id } },
        overrideAccess: true,
      })
      const statusOf = (app: AnyValue) => docs.find((d: AnyValue) => d.id === app.id)?.status
      expect(statusOf(winner)).toBe('selected')
      expect(statusOf(loser)).toBe('not_selected')
    })
  })

  describe('deadline', () => {
    it('stops applications once deadlineAt has passed', async () => {
      const selection = await openSelection()
      const payload = await testPayload()
      await payload.update({
        collection: 'selections',
        id: selection.id,
        data: { deadlineAt: new Date(Date.now() - 60_000).toISOString() },
        overrideAccess: true,
      })
      const res = await post(selection.id, '/apply', applicant, { answers: { motivation: 'late' } })
      expect(res.status).toBe(409)
      expect((await res.json()).error.code).toBe('deadline_passed')
    })
  })

  describe('response projections', () => {
    const leaks = /legacyPassword|dateOfBirth|"email"|"phone"|"hash"|"salt"/

    it('never returns account records from committee, recusal or evaluation', async () => {
      const selection = await makeSelection()
      const join = await post(selection.id, '/committee', c1)
      expect(join.status).toBe(201)
      const joined = await join.json()
      expect(JSON.stringify(joined)).not.toMatch(leaks)
      expect(joined.member.account).toEqual({
        id: c1.account.id,
        name: expect.any(String),
      })
      await post(selection.id, '/committee', c2)
      await post(selection.id, '/committee', c3)
      await post(selection.id, '/open', team)
      const a = await apply(selection.id, applicant)
      await post(selection.id, '/close', team)
      const recuse = await post(selection.id, '/recuse', c1, { applicantIds: [a.id] })
      expect(recuse.status).toBe(200)
      expect(JSON.stringify(await recuse.json())).not.toMatch(leaks)
      const scored = await grade(selection.id, a.id, c2)
      expect(scored.status).toBe(200)
      expect(JSON.stringify(await scored.json())).not.toMatch(leaks)
    })
  })
})
