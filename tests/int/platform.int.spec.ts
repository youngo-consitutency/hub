import { describe, it, beforeAll, expect } from 'vitest'

import { testPayload } from './provision'
import { api, session, BASE } from './helpers'

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
