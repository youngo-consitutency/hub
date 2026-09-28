import crypto from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { fail } from './respond'
import { VERIFIED_PLATFORM_ROLES } from './accounts'
import { getAccessProfile } from './access'

// Shared S10/S24 helpers. Secret ballots are keyed by voter credentials
// (HMAC'd tokens) and never reference an account — server-trust secrecy.
// Facilitators are admins or members carrying the `election_facilitation` /
// `selection_team` assignment (team scope).

export async function isFacilitator(req: PayloadRequest, account: any) {
  if (account.role === 'admin') return true
  const access = await getAccessProfile(req, account)
  return access.teamRoles.some((r) =>
    ['election_facilitation', 'bottomlining', 'blt'].includes(r),
  )
}

export async function isSelector(req: PayloadRequest, account: any) {
  if (VERIFIED_PLATFORM_ROLES.has(account.role)) return true
  const access = await getAccessProfile(req, account)
  return access.teamRoles.some((r) =>
    ['selection_team', 'gct', 'election_facilitation'].includes(r),
  )
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
    .catch(() => { throw fail.notFound('Election not found.') })
}

export async function loadSelection(req: PayloadRequest, id: string | number) {
  return req.payload
    .findByID({ collection: 'selections', id: Number(id), overrideAccess: true })
    .catch(() => { throw fail.notFound('Selection not found.') })
}
