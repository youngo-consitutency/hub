import type { PayloadRequest } from 'payload'
import { deriveAuthority, type AuthorityRow } from './authority'
import { isCwActive } from './accounts'

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
  accountId?: string
}

// Only coordination responsibilities carry wg.manage. Ordinary group
// membership is an affiliation, not a management mandate [S25]. Kept for
// callers that still look at legacy wgAssignments roles.
export const WG_COORDINATION_ROLES = new Set(['contact', 'lead', 'coordinator', 'contact_point'])

// Technical administration: system-level capabilities a platform
// administrator holds by virtue of the `admin` account role. Deliberately
// excludes constituency authority — no Council vote, no team review powers,
// no confidential case access, no selector/facilitator rights.
const ADMIN_CAPABILITIES = [
  'platform.manage',
  'accounts.manage',
  'audit.read',
  'notifications.send',
  'ngo.manage_all',
  'intelligence.operations.read',
  'intelligence.writeback.approve',
  'intelligence.writeback.apply',
]

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

/** Load an account's active authority-records and derive its capability profile. */
export async function getAccessProfile(req: PayloadRequest, account: any): Promise<AccessProfile> {
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
  if (account.role === 'admin') {
    for (const cap of ADMIN_CAPABILITIES) capabilities.add(cap)
  }
  // A `focal_point` account title grants nothing by itself — Council voting
  // and coordination require an evidenced `focal_point` record (S11).
  // Legitimate mandates carry verifiable provenance; revoking the record
  // removes the authority even when the title remains.

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

export function hasCapability(access: any, capability: string) {
  return Boolean(access?.capabilities?.includes(capability))
}

export function canManageWg(access: any, wgSlug: string) {
  return access?.manageAllWgs || hasCapability(access, `wg.manage:${wgSlug}`)
}
