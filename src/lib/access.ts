import type { PayloadRequest } from 'payload'
import {
  APPOINTMENT_ROLES,
  appointmentCurrent,
  capabilitiesFor,
  councilSeatFor,
  resolveAppointmentRole,
  teamKeysFor,
  wgLegacyRoleFor,
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

interface RawRow {
  id: number
  appointmentRole?: string | null
  scopeType: string
  scopeId: string
  role?: string
  councilSeat?: string | null
  status: string
  startsAt?: any
  endsAt?: any
}

export async function getAccessProfile(req: PayloadRequest, account: any): Promise<AccessProfile> {
  if (!account) return EMPTY

  const teamRoles = new Set<string>()
  const wgAssignments: { wgSlug: string; role: string }[] = []
  const negotiationAssignments: {
    scopeType: string
    scopeId: string
    role: string
  }[] = []
  const councilSeats = new Set<string>()
  const bodyScopes = new Set<string>()
  const capabilities = new Set(['hub.read', 'intelligence.query', 'intelligence.writeback.propose'])
  const appointments: AccessProfile['appointments'] = []
  let unmapped = 0

  const now = new Date()
  const cw = isCwActive(account)

  // Canonical appointments plus the legacy ledger rows. Legacy assignments
  // are superseded by a matching canonical row (same account + appointment
  // role + scope) rather than granted twice.
  const [appts, legacyRows] = await Promise.all([
    req.payload.find({
      collection: 'appointments',
      where: { account: { equals: account.id }, status: { in: ['active'] } },
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

  const canonical = new Set<string>()
  for (const row of appts.docs as any[] as RawRow[]) {
    if (!appointmentCurrent(row, now)) continue
    const roleKey = row.appointmentRole!
    canonical.add(`${roleKey}:${row.scopeType}:${row.scopeId}`)
  }

  const rows: RawRow[] = [
    ...(appts.docs as any[]),
    ...(legacyRows.docs as any[]).filter(
      (r: RawRow) => !canonical.has(`${resolveAppointmentRole(r)}:${r.scopeType}:${r.scopeId}`),
    ),
  ]

  for (const row of rows) {
    if (!appointmentCurrent(row, now)) continue
    const roleKey = resolveAppointmentRole(row)
    if (!roleKey || !APPOINTMENT_ROLES[roleKey]) {
      // Unmapped records are reported, never widened.
      unmapped += 1
      console.warn(
        `[appointments] unmapped record id=${row.id} scope=${row.scopeType}:${row.scopeId} role=${row.role} — denied until the migration map covers it`,
      )
      continue
    }
    const seat = councilSeatFor(roleKey, row)
    const substitute = roleKey === 'council.substitute'
    appointments.push({
      id: row.id,
      role: roleKey,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      councilSeat: seat,
      endsAt: row.endsAt ?? null,
      substitute,
    })
    // Appointments that require Constituency Work membership grant nothing
    // while that membership is inactive — they still show for the member.
    if (APPOINTMENT_ROLES[roleKey].requiresCw && !cw) continue
    for (const key of teamKeysFor(roleKey)) teamRoles.add(key)
    for (const cap of capabilitiesFor(roleKey, row.scopeId)) capabilities.add(cap)
    if (seat) councilSeats.add(seat)
    if (row.scopeType === 'body') bodyScopes.add(row.scopeId)
    if (row.scopeType === 'working_group')
      wgAssignments.push({ wgSlug: row.scopeId, role: wgLegacyRoleFor(roleKey) })
    if (['negotiation_track', 'negotiation_project'].includes(row.scopeType)) {
      const negRole = roleKey.replace('negotiation.', '')
      negotiationAssignments.push({
        scopeType: row.scopeType,
        scopeId: row.scopeId,
        role: negRole,
      })
      const scope = `${row.scopeType}:${row.scopeId}`
      capabilities.add(`negotiations.read:${scope}`)
      if (negRole === 'reviewer') {
        capabilities.add(`negotiations.evidence.review:${scope}`)
        capabilities.add(`negotiations.candidates.review:${scope}`)
      }
      if (negRole === 'applier') capabilities.add(`negotiations.candidates.apply:${scope}`)
      if (negRole === 'grant_manager') capabilities.add(`negotiations.grants.manage:${scope}`)
      if (negRole === 'process_facilitator')
        capabilities.add(`negotiations.process.record:${scope}`)
      if (negRole === 'transmitter') capabilities.add(`negotiations.transmission.record:${scope}`)
    }
  }

  if (account.role === 'admin') {
    for (const cap of ADMIN_CAPABILITIES) capabilities.add(cap)
  }
  // A focal-point account role records the elected mandate itself (S11/S10);
  // it acts as the council.focal_point appointment until the appointment row
  // is recorded.
  if (account.role === 'focal_point' && cw) {
    for (const cap of capabilitiesFor('focal_point', 'platform')) capabilities.add(cap)
    councilSeats.add('focal_point')
    if (!appointments.some((a) => a.role === 'focal_point'))
      appointments.push({
        id: 0,
        role: 'focal_point',
        scopeType: 'platform',
        scopeId: 'platform',
        councilSeat: 'focal_point',
        endsAt: null,
        substitute: false,
      })
  }

  return {
    teamRoles: [...teamRoles],
    wgAssignments,
    negotiationAssignments,
    councilSeats: [...councilSeats],
    bodyScopes: [...bodyScopes],
    appointments,
    unmappedAssignments: unmapped,
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
