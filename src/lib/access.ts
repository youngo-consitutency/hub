import type { PayloadRequest } from 'payload'
import { deriveAuthority, type AuthorityRow } from './authority'
import { isCwActive } from './accountStatus'
import type { AccountLike } from './domain'

// Derives the capability model from `authority-records`: time-bounded,
// scoped, evidenced records — mandates and participation share one store.
// `account.role` carries only technical administration and entity kind — it
// never creates constituency authority on its own (a title without a record
// grants nothing). Rows whose recorded role maps to no registry role are
// denied and reported, never widened.
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

// Only coordination responsibilities carry wg.manage. Ordinary group
// membership is an affiliation, not a management mandate [S25]. Kept for
// callers that still look at legacy wgAssignments roles.
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

  const derived = deriveAuthority(docs as any[] as AuthorityRow[], {
    cw,
    baseCapabilities: ['hub.read', 'intelligence.query', 'intelligence.writeback.propose'],
  })
  if (derived.unmapped) {
    console.warn(
      `[authority] ${derived.unmapped} unmapped record(s) for account ${account.id} — denied until the role map covers them`,
    )
  }

  const capabilities = new Set(derived.capabilities)
  // Every capability comes from an evidenced record — account titles grant
  // nothing on their own.

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

export function canManageWg(
  access: Pick<AccessProfile, 'capabilities' | 'manageAllWgs'> | null | undefined,
  wgSlug: string,
): boolean {
  return Boolean(access?.manageAllWgs) || hasCapability(access, `wg.manage:${wgSlug}`)
}
