import type { PayloadRequest } from 'payload'
import { deriveAuthority, type AuthorityRow } from './authority'
import { isCwActive } from './accountStatus'
import type { AccountLike, Doc } from './domain'

// Derives the capability model from `authority-records`. `account.role` is
// technical only — titles grant nothing. Unmapped roles deny, never widen.
export interface AccessProfile {
  teamRoles: string[]
  wgAssignments: { wgSlug: string; role: string }[]
  negotiationAssignments: { scopeType: string; scopeId: string; role: string }[]
  /** Council seat keys currently held (e.g. 'wg:finance', 'org:12'). */
  councilSeats: string[]
  /** Platform-body scopes the account participates in. */
  bodyScopes: string[]
  /** Resolved current records, for workspace display and auditing. */
  records: {
    id: number
    role: string
    scopeType: string
    scopeId: string
    councilSeat: string | null
    endsAt: string | null
    substitute: boolean
  }[]
  /** Active-window records that matched no role mapping — denied. */
  unmappedRecords: number
  capabilities: string[]
  manageAllWgs: boolean
  isFocalPoint?: boolean
  isMandateHolder?: boolean
  accountId?: number
}

// Only coordination records carry wg.manage — membership is affiliation,
// not a mandate [S25]. Kept for legacy wgAssignments callers.
export const WG_COORDINATION_ROLES = new Set(['contact', 'lead', 'coordinator', 'contact_point'])

const EMPTY: AccessProfile = {
  teamRoles: [],
  wgAssignments: [],
  negotiationAssignments: [],
  councilSeats: [],
  bodyScopes: [],
  records: [],
  unmappedRecords: 0,
  capabilities: [],
  manageAllWgs: false,
}

export async function getAccessProfile(
  req: PayloadRequest,
  account: AccountLike | null | undefined,
): Promise<AccessProfile> {
  if (!account) return EMPTY

  const cw = isCwActive(account)

  const { docs } = await req.payload.find({
    collection: 'authority-records',
    where: {
      and: [{ account: { equals: account.id } }, { status: { equals: 'active' } }],
    },
    pagination: false,
    overrideAccess: true,
  })

  const derived = deriveAuthority(docs as Doc[] as AuthorityRow[], {
    cw,
    baseCapabilities: ['hub.read', 'intelligence.query', 'intelligence.writeback.propose'],
  })
  if (derived.unmapped) {
    console.warn(
      `[authority] ${derived.unmapped} unmapped record(s) for account ${account.id} — denied until the role map covers them`,
    )
  }

  const capabilities = new Set(derived.capabilities)
  // Every capability comes from an evidenced record.

  const councilSeats = new Set(derived.councilSeats)
  return {
    teamRoles: derived.teamRoles,
    wgAssignments: derived.wgAssignments,
    negotiationAssignments: derived.negotiationAssignments,
    councilSeats: [...councilSeats],
    bodyScopes: derived.bodyScopes,
    records: derived.records,
    unmappedRecords: derived.unmapped,
    capabilities: [...capabilities],
    manageAllWgs: capabilities.has('wg.manage_all'),
    isFocalPoint: councilSeats.has('focal_point'),
    isMandateHolder: capabilities.has('intelligence.contacts.read'),
    accountId: account.id,
  }
}

export function hasCapability(
  access: Pick<AccessProfile, 'capabilities'> | null | undefined,
  capability: string,
): boolean {
  return Boolean(access?.capabilities?.includes(capability))
}

export function hasTeamRole(
  access: Pick<AccessProfile, 'teamRoles'> | null | undefined,
  teamRole: string,
): boolean {
  return Boolean(access?.teamRoles?.includes(teamRole))
}

export function canManageWg(
  access: Pick<AccessProfile, 'capabilities' | 'manageAllWgs'> | null | undefined,
  wgSlug: string,
): boolean {
  return Boolean(access?.manageAllWgs) || hasCapability(access, `wg.manage:${wgSlug}`)
}
