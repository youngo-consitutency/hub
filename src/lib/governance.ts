import crypto from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { getAccessProfile, hasCapability } from './access'

// Shared S10/S24 helpers. Secret ballots are keyed by voter credentials
// (HMAC'd tokens) and never reference an account — server-trust secrecy.
// Facilitation and selection authority come from authority records
// (team.election_facilitation / selection.manage) — never from a bare
// account title.

export async function isFacilitator(req: PayloadRequest, account: any) {
  const access = await getAccessProfile(req, account)
  return hasCapability(access, 'election.facilitate')
}

export async function isSelector(req: PayloadRequest, account: any) {
  const access = await getAccessProfile(req, account)
  return hasCapability(access, 'selection.manage')
}

export const accountRef = (a: any) =>
  a == null
    ? null
    : { id: typeof a === 'object' ? a.id : a, name: typeof a === 'object' ? a.name : undefined }

// Voter credentials are HMAC'd under PAYLOAD_SECRET (required at boot).
export const tokenHash = (electionId: number | string, token: string) =>
  crypto
    .createHmac('sha256', process.env.PAYLOAD_SECRET!)
    .update(`${electionId}:${token}`)
    .digest('hex')

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
