/**
 * Decision-test fixtures. Windows are expired with direct SQL (the way the
 * platform and elections specs do) because there is deliberately no
 * production endpoint that closes a window early.
 */
import type { AnyValue } from '../../src/lib/domain'
import { expect } from 'vitest'

import { testPayload } from './provision'
import { api } from './helpers'

const pastIso = () => new Date(Date.now() - 1000).toISOString()

async function pool() {
  return ((await testPayload()).db as AnyValue).pool
}

// consultation, revision and decision deadlines all elapsed
export async function expireWindows(id: number) {
  await (
    await pool()
  ).query(
    'UPDATE decision_proposals SET consultation_ends_at=$2, revision_ends_at=$2, decision_ends_at=$2 WHERE id=$1',
    [id, pastIso()],
  )
}

export async function expireVote(id: number) {
  await (
    await pool()
  ).query('UPDATE decision_proposals SET voting_ends_at=$2 WHERE id=$1', [id, pastIso()])
}

export const jsonBody = (value: unknown) => JSON.stringify(value)

type Session = { cookie: string }

// A snap proposal in its voting phase: a standing red flag fails consensus
// once the windows elapse, and the next read opens the ballot.
export async function makeVotingProposal(
  contact: Session,
  flagger: Session,
  scope: { body: string; bodyRef?: string } = { body: 'working_group', bodyRef: 'finance' },
) {
  const create = await api('/decisions', {
    method: 'POST',
    cookie: contact.cookie,
    body: jsonBody({
      title: `Ballot test ${Date.now()}`,
      context: 'contract test',
      proposalText: 'Do the test thing.',
      decisionType: 'snap',
      snapJustification: 'test',
      snapDeadline: new Date(Date.now() + 2 * 86400000).toISOString(),
      ...scope,
    }),
  })
  expect(create.status).toBe(201)
  const { proposal } = await create.json()
  const present = await api(`/decisions/${proposal.id}/present`, {
    method: 'POST',
    cookie: contact.cookie,
  })
  expect(present.status).toBe(200)
  const flag = await api(`/decisions/${proposal.id}/flags`, {
    method: 'POST',
    cookie: flagger.cookie,
    body: jsonBody({
      kind: 'red',
      rationaleCategory: 'mission_misalignment',
      reason: 'test flag',
      alternative: 'test alternative',
    }),
  })
  expect(flag.status).toBe(201)
  await expireWindows(proposal.id)
  const read = await api(`/decisions/${proposal.id}`, { cookie: flagger.cookie })
  const voting = (await read.json()).proposal
  expect(voting.status).toBe('voting')
  return voting
}
