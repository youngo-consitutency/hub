import type { PayloadRequest } from 'payload'
import {
  appointmentKey,
  deriveAuthority,
  resolveAppointmentRole,
  supersededAssignmentIds,
  supersessionKeys,
  type AuthorityRow,
} from './appointments'
import { isCwActive } from './accounts'

// Derives the capability model from *appointments*: time-bounded, scoped,
// evidenced records in the `appointments` collection. `account.role` carries
// only technical administration and entity kind — it never creates
// constituency authority on its own (a title without an appointment grants
// nothing). Legacy `assignments` rows are still honoured through the
// explicit migration map in lib/appointments.ts until the migration runs;
// unmapped rows are denied and reported, never widened.
export interface AccessProfile {
  teamRoles: string[]
  wgAssignments: { wgSlug: string; role: string }[]
  negotiationAssignments: { scopeType: string; scopeId: string; role: string }[]
  /** Council seat keys currently held (e.g. 'wg:finance', 'org:12'). */
  councilSeats: string[]
  /** Platform-body scopes the account participates in (assignments or
   *  appointment rows with scopeType 'body'). */
  bodyScopes: string[]
  /** Resolved current appointments, for workspace display and auditing. */
  appointments: {
    id: number
    role: string
    scopeType: string
    scopeId: string
    councilSeat: string | null
    endsAt: string | null
    substitute: boolean
  }[]
  /** Active-window records that matched no appointment mapping — denied. */
  unmappedAssignments: number
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
  appointments: [],
  unmappedAssignments: 0,
  capabilities: [],
  manageAllWgs: false,
}

export async function getAccessProfile(req: PayloadRequest, account: any): Promise<AccessProfile> {
  if (!account) return EMPTY

  const cw = isCwActive(account)

  // Canonical appointments (ALL statuses — a canonical record supersedes its
  // legacy source permanently, so ended appointments are needed to build the
  // supersession set) plus the active legacy ledger rows.
  const [appts, legacyRows] = await Promise.all([
    req.payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id } },
      limit: 1000,
      overrideAccess: true,
    }),
    req.payload.find({
      collection: 'assignments',
      where: { account: { equals: account.id }, status: { equals: 'active' } },
      limit: 1000,
      overrideAccess: true,
    }),
  ])

  // Supersession is persistent: once a mandate lives in `appointments`,
  // revoking or expiring it cannot resurrect the untouched legacy row.
  // Two links apply — the immutable migration-source identity (a legacy row
  // stays superseded even after its appointment's role/scope was edited)
  // and the current authority tuple (a fresh grant covers the same-scope
  // legacy row while any canonical record exists for it).
  const superseded = supersessionKeys(appts.docs as any[] as AuthorityRow[])
  const supersededSources = supersededAssignmentIds(appts.docs as any[] as AuthorityRow[])
  const rows: AuthorityRow[] = [
    ...(appts.docs as any[] as AuthorityRow[]),
    ...(legacyRows.docs as any[] as AuthorityRow[]).filter((r) => {
      if (supersededSources.has(String(r.id))) return false
      const roleKey = resolveAppointmentRole(r)
      return !roleKey || !superseded.has(appointmentKey(roleKey, r.scopeType, r.scopeId))
    }),
  ]

  const derived = deriveAuthority(rows, {
    cw,
    baseCapabilities: ['hub.read', 'intelligence.query', 'intelligence.writeback.propose'],
  })
  if (derived.unmapped) {
    console.warn(
      `[appointments] ${derived.unmapped} unmapped record(s) for account ${account.id} — denied until the migration map covers them`,
    )
  }

  const capabilities = new Set(derived.capabilities)
  if (account.role === 'admin') {
    for (const cap of ADMIN_CAPABILITIES) capabilities.add(cap)
  }
  // A `focal_point` account title grants nothing by itself — Council voting
  // and coordination require an evidenced `focal_point` appointment (S11).
  // Legitimate mandates migrate through the evidenced backfill; revoking the
  // appointment removes the authority even when the title remains.

  const councilSeats = new Set(derived.councilSeats)
  return {
    teamRoles: derived.teamRoles,
    wgAssignments: derived.wgAssignments,
    negotiationAssignments: derived.negotiationAssignments,
    councilSeats: [...councilSeats],
    bodyScopes: derived.bodyScopes,
    appointments: derived.appointments,
    unmappedAssignments: derived.unmapped,
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
