import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { getAccessProfile, hasCapability } from './access'
import type { AccountLike } from './domain'
import { isCwActive, isVerifiedAccount } from './accountStatus'
import { requirePgPool } from './pg'

// Shared S10/S24 helpers: votes are cast on belenios, the hub decides
// eligibility and records the result.

export async function isFacilitator(req: PayloadRequest, account: AccountLike) {
  const access = await getAccessProfile(req, account)
  return hasCapability(access, 'election.facilitate')
}

export async function isSelector(req: PayloadRequest, account: AccountLike) {
  const access = await getAccessProfile(req, account)
  return hasCapability(access, 'selection.manage')
}

interface EligibleVoter {
  id: number
  email: string
  kind: 'individual' | 'organisation'
}

// everyone who may vote: the same verified + active constituency work rule
// that requireCwMember enforces on every decision endpoint
export async function eligibleVoters(): Promise<EligibleVoter[]> {
  // no database means no registry: fail loudly, never export an empty list
  const { rows } = await requirePgPool().query(
    `SELECT id, email, entity_type, member_status, hub_access_status, membership_track,
            constituency_work_status, membership_status
       FROM accounts
      WHERE membership_track = 'constituency_work' AND email IS NOT NULL
      ORDER BY id`,
  )
  return rows
    .filter((row) => isVerifiedAccount(row) && isCwActive(row))
    .map((row) => ({
      id: row.id,
      email: row.email,
      kind: row.entity_type === 'organization' ? 'organisation' : 'individual',
    }))
}

// One `address,login` line per voter; the login carries the voter kind so
// belenios can count individuals and organisations apart, and no names leave the hub.
export const beleniosVoterList = (voters: EligibleVoter[]) =>
  voters.map((voter) => `${voter.email},hub-${voter.kind}-${voter.id}`).join('\n') +
  (voters.length ? '\n' : '')

export async function loadElection(req: PayloadRequest, id: string | number) {
  return req.payload
    .findByID({ collection: 'elections', id: Number(id), overrideAccess: true })
    .catch(() => {
      throw fail.notFound('Election not found.')
    })
}

export async function loadSelection(req: PayloadRequest, id: string | number) {
  return req.payload
    .findByID({ collection: 'selections', id: Number(id), overrideAccess: true })
    .catch(() => {
      throw fail.notFound('Selection not found.')
    })
}
