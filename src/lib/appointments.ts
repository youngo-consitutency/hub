// Policy-backed appointment model.
//
// An appointment is a time-bounded, scoped, evidenced responsibility recorded
// on an `assignments` row. Constituency authority derives from appointments —
// never from account titles. `account.role` only distinguishes technical
// administration and account entity kind.
//
// Sources: S13 Governance Policy (bodies/Council), S14 Interim GCT Mandate,
// S25 WG Contact Point Mandate, S15 Liaison Guidelines, S02 Awareness Team,
// S23/S04 Safeguarding, S17 Membership, S24 Selections, S10 Elections.

export interface AppointmentSpec {
  label: string
  /** scopeType values this appointment may be recorded under. */
  scopeTypes: string[]
  /** Legacy team identifiers emitted to existing consumers (teamRoles). */
  teamKeys?: string[]
  /** Capability templates; `{scope}` interpolates the assignment scopeId. */
  capabilities?: string[]
  /** Council seat key template; `{scope}` interpolates scopeId (S13 §6). */
  councilSeat?: string
  /** Appointment requires active Constituency Work membership (S17 §1.1). */
  requiresCw?: boolean
}

// The controlled vocabulary. Keep keys stable — rows persist them in
// assignments.appointment_role.
export const APPOINTMENT_ROLES: Record<string, AppointmentSpec> = {
  // ── Constituency officers ──────────────────────────────────────────
  focal_point: {
    label: 'Global Focal Point',
    scopeTypes: ['platform'],
    councilSeat: 'focal_point', // seat is personal: each of the two FPs votes
    capabilities: [
      'council.vote',
      'constituency.coordinate',
      'points.award',
      'intelligence.contacts.read',
    ],
    requiresCw: true,
  },
  'council.substitute': {
    // Recorded proxy for an existing seat; councilSeat stores the seat it
    // covers. A substitute never creates an additional vote (S13 §6).
    label: 'Council substitute',
    scopeTypes: ['platform'],
    capabilities: ['council.vote'],
    requiresCw: true,
  },

  // ── Organisations ─────────────────────────────────────────────────
  'org.representative': {
    label: 'Organisation Council representative',
    scopeTypes: ['organization'],
    councilSeat: 'org:{scope}',
    capabilities: ['council.vote', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'org.member': {
    label: 'Organisation member',
    scopeTypes: ['organization'],
  },
  'org.admin': {
    label: 'Organisation administrator',
    scopeTypes: ['organization'],
  },

  // ── Working groups ────────────────────────────────────────────────
  'wg.member': {
    label: 'Working-group member',
    scopeTypes: ['working_group', 'body'],
    requiresCw: true,
  },
  'wg.contact_point': {
    // One Council seat per Working Group however many CPs it has (S13 §6).
    label: 'Working-group Contact Point',
    scopeTypes: ['working_group', 'body'],
    councilSeat: 'wg:{scope}',
    capabilities: ['council.vote', 'wg.manage:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'wg.safeguarding_officer': {
    label: 'Working-group Safeguarding Officer',
    scopeTypes: ['working_group', 'body'],
    capabilities: ['wg.safeguard:{scope}'],
    requiresCw: true,
  },

  // ── Operational teams / platform bodies ────────────────────────────
  'ot.member': {
    label: 'Operational-team member',
    scopeTypes: ['operational_team', 'body'],
    requiresCw: true,
  },
  'ot.liaison': {
    // One Council seat per Operational Team (S13 §6).
    label: 'Operational-team Liaison',
    scopeTypes: ['operational_team'],
    councilSeat: 'ot:{scope}',
    capabilities: ['council.vote', 'ot.coordinate:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'body.member': {
    label: 'Body member',
    scopeTypes: ['body'],
    requiresCw: true,
  },
  'body.coordinator': {
    label: 'Body coordinator',
    scopeTypes: ['body'],
    capabilities: ['body.manage:{scope}'],
    requiresCw: true,
  },
  'body.contact_point': {
    label: 'Body Contact Point',
    scopeTypes: ['body'],
    councilSeat: 'body:{scope}',
    capabilities: ['council.vote', 'body.manage:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'body.liaison': {
    label: 'Body Liaison',
    scopeTypes: ['body'],
    councilSeat: 'body:{scope}',
    capabilities: ['council.vote', 'body.manage:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'body.council_representative': {
    label: 'Body Council representative',
    scopeTypes: ['body'],
    councilSeat: 'body:{scope}',
    capabilities: ['council.vote'],
    requiresCw: true,
  },

  // ── Global Coordination Team (S14: five responsibility areas) ─────
  'gct.coordinator': {
    label: 'GCT coordinator',
    scopeTypes: ['team'],
    teamKeys: ['gct'],
    capabilities: ['gct.coordinate', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'gct.partnerships': {
    label: 'GCT coordinator — Partnerships',
    scopeTypes: ['team'],
    teamKeys: ['gct'],
    capabilities: ['gct.coordinate', 'partnership.review', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'gct.membership': {
    label: 'GCT coordinator — Membership',
    scopeTypes: ['team'],
    teamKeys: ['gct', 'membership_team'],
    capabilities: [
      'gct.coordinate',
      'membership.review',
      'points.award',
      'intelligence.contacts.read',
    ],
    requiresCw: true,
  },
  'gct.finance': {
    label: 'GCT coordinator — Finance',
    scopeTypes: ['team'],
    teamKeys: ['gct', 'finance_team'],
    capabilities: ['gct.coordinate', 'finance.review'],
    requiresCw: true,
  },
  'gct.internal': {
    label: 'GCT coordinator — Internal management',
    scopeTypes: ['team'],
    teamKeys: ['gct'],
    capabilities: ['gct.coordinate', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'gct.coordination': {
    label: 'GCT coordinator — Coordination support',
    scopeTypes: ['team'],
    teamKeys: ['gct'],
    capabilities: ['gct.coordinate', 'recognition.review', 'intelligence.contacts.read'],
    requiresCw: true,
  },

  // ── Functional teams ───────────────────────────────────────────────
  'team.membership': {
    label: 'Membership Team member',
    scopeTypes: ['team'],
    teamKeys: ['membership_team'],
    capabilities: ['membership.review', 'points.award', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'team.selections': {
    label: 'Selections Team member',
    scopeTypes: ['team'],
    teamKeys: ['selection_team'],
    capabilities: ['selection.manage'],
    requiresCw: true,
  },
  'team.election_facilitation': {
    label: 'Election Facilitation Team member',
    scopeTypes: ['team'],
    teamKeys: ['election_facilitation'],
    capabilities: ['election.facilitate'],
    requiresCw: true,
  },
  'team.awareness': {
    label: 'Awareness Team member',
    scopeTypes: ['team'],
    teamKeys: ['awareness_team'],
    capabilities: ['awareness.case'],
    requiresCw: true,
  },
  'team.safeguarding': {
    label: 'Safeguarding Team member',
    scopeTypes: ['team'],
    teamKeys: ['safeguarding_team'],
    capabilities: ['safeguarding.case'],
    requiresCw: true,
  },
  'team.finance': {
    label: 'Finance Team member',
    scopeTypes: ['team'],
    teamKeys: ['finance_team'],
    capabilities: ['finance.review'],
    requiresCw: true,
  },
  'team.partnerships': {
    label: 'Partnerships Team member',
    scopeTypes: ['team'],
    teamKeys: ['partnerships_team', 'partnerships'],
    capabilities: ['partnership.review', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'team.comms': {
    label: 'Communications Team member',
    scopeTypes: ['team'],
    teamKeys: ['comms_team'],
    capabilities: ['content.review', 'content.publish'],
    requiresCw: true,
  },
  'team.reforms': {
    label: 'Reforms Team member',
    scopeTypes: ['team'],
    teamKeys: ['reforms_team'],
    capabilities: ['reforms.coordinate'],
    requiresCw: true,
  },
  'team.data_controller': {
    label: 'Data Controller',
    scopeTypes: ['team'],
    teamKeys: ['data_controller'],
    capabilities: ['privacy.manage'],
    requiresCw: true,
  },
  'team.gys_policy': {
    label: 'GYS policy team member',
    scopeTypes: ['team'],
    teamKeys: ['gys_policy_team'],
    capabilities: ['gys.manage'],
    requiresCw: true,
  },

  // ── Editorial responsibilities ─────────────────────────────────────
  'content.editor': {
    label: 'Content editor',
    scopeTypes: ['team'],
    teamKeys: ['content_editor'],
    capabilities: ['content.draft'],
    requiresCw: true,
  },
  'content.publisher': {
    label: 'Content publisher',
    scopeTypes: ['team'],
    teamKeys: ['content_publisher'],
    capabilities: ['content.review', 'content.publish'],
    requiresCw: true,
  },

  // ── Conference roles (S15 liaisons, S03 event-scoped CCT) ──────────
  'coy.lcoy_liaison': {
    label: 'LCOY Liaison',
    scopeTypes: ['team', 'body'],
    capabilities: ['coy.liaise:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'coy.rcoy_liaison': {
    label: 'RCOY Liaison',
    scopeTypes: ['team', 'body'],
    capabilities: ['coy.liaise:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'coy.gcoy_liaison': {
    label: 'GCOY Liaison',
    scopeTypes: ['team', 'body'],
    capabilities: ['coy.liaise:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'cct.member': {
    label: 'Conference Coordination Team member',
    scopeTypes: ['event'],
    capabilities: ['cct.coordinate:{scope}'],
    requiresCw: true,
  },
  'cct.coordinator': {
    label: 'Conference Coordination Team coordinator',
    scopeTypes: ['event'],
    capabilities: ['cct.coordinate:{scope}', 'intelligence.contacts.read'],
    requiresCw: true,
  },

  // ── Negotiation scopes (existing scoped grants, preserved) ─────────
  'negotiation.member': {
    label: 'Negotiation scope member',
    scopeTypes: ['negotiation_track', 'negotiation_project'],
  },
  'negotiation.reviewer': {
    label: 'Negotiation reviewer',
    scopeTypes: ['negotiation_track', 'negotiation_project'],
  },
  'negotiation.applier': {
    label: 'Negotiation applier',
    scopeTypes: ['negotiation_track', 'negotiation_project'],
  },
  'negotiation.grant_manager': {
    label: 'Negotiation grant manager',
    scopeTypes: ['negotiation_track', 'negotiation_project'],
  },
  'negotiation.process_facilitator': {
    label: 'Negotiation process facilitator',
    scopeTypes: ['negotiation_track', 'negotiation_project'],
  },
  'negotiation.transmitter': {
    label: 'Negotiation transmitter',
    scopeTypes: ['negotiation_track', 'negotiation_project'],
  },
}

export const APPOINTMENT_ROLE_KEYS = Object.keys(APPOINTMENT_ROLES)

// ── Legacy normalisation ────────────────────────────────────────────
// Explicit mapping from historical (scopeType, scopeId, role) tuples to
// appointment roles. Records that match no rule are *unmapped*: they are
// reported by the migration preview and grant no access. Never widen access
// by guessing at names.

const TEAM_LEGACY: Record<string, string> = {
  membership_team: 'team.membership',
  selection_team: 'team.selections',
  election_facilitation: 'team.election_facilitation',
  bottomlining: 'team.election_facilitation',
  blt: 'team.election_facilitation',
  awareness_team: 'team.awareness',
  safeguarding_team: 'team.safeguarding',
  finance_team: 'team.finance',
  partnerships_team: 'team.partnerships',
  partnerships: 'team.partnerships',
  comms_team: 'team.comms',
  reforms_team: 'team.reforms',
  data_controller: 'team.data_controller',
  gys_policy_team: 'team.gys_policy',
  content_editor: 'content.editor',
  content_publisher: 'content.publisher',
}

const GCT_AREAS: Record<string, string> = {
  partnerships: 'gct.partnerships',
  membership: 'gct.membership',
  finance: 'gct.finance',
  internal: 'gct.internal',
  coordination: 'gct.coordination',
}

const WG_LEGACY_ROLES: Record<string, string> = {
  member: 'wg.member',
  contact: 'wg.contact_point',
  lead: 'wg.contact_point',
  coordinator: 'wg.contact_point',
  contact_point: 'wg.contact_point',
  safeguarding_officer: 'wg.safeguarding_officer',
}

const BODY_LEGACY_ROLES: Record<string, string> = {
  member: 'body.member',
  coordinator: 'body.coordinator',
  contact_point: 'body.contact_point',
  liaison: 'body.liaison',
  council_representative: 'body.council_representative',
}

const ORG_LEGACY_ROLES: Record<string, string> = {
  member: 'org.member',
  representative: 'org.representative',
  dcp: 'org.representative',
  admin: 'org.admin',
}

const NEGOTIATION_LEGACY_ROLES: Record<string, string> = {
  member: 'negotiation.member',
  reviewer: 'negotiation.reviewer',
  applier: 'negotiation.applier',
  grant_manager: 'negotiation.grant_manager',
  process_facilitator: 'negotiation.process_facilitator',
  transmitter: 'negotiation.transmitter',
}

const COY_LIAISON_TEAMS: Record<string, string> = {
  lcoy_liaison: 'coy.lcoy_liaison',
  rcoy_liaison: 'coy.rcoy_liaison',
  gcoy_liaison: 'coy.gcoy_liaison',
}

// Resolve a legacy row to an appointment role, or null when unmapped.
export function legacyAppointmentRole(
  scopeType: string,
  scopeId: string,
  role: string,
): string | null {
  switch (scopeType) {
    case 'team': {
      if (scopeId === 'gct') return GCT_AREAS[role] ?? 'gct.coordinator'
      if (TEAM_LEGACY[scopeId]) return TEAM_LEGACY[scopeId]
      if (COY_LIAISON_TEAMS[scopeId]) return COY_LIAISON_TEAMS[scopeId]
      return null
    }
    case 'working_group':
      return WG_LEGACY_ROLES[role] ?? null
    case 'operational_team':
      return role === 'liaison' ? 'ot.liaison' : role === 'member' ? 'ot.member' : null
    case 'body':
    case 'platform_body': {
      if (COY_LIAISON_TEAMS[role]) return COY_LIAISON_TEAMS[role]
      return BODY_LEGACY_ROLES[role] ?? null
    }
    case 'organization':
      return ORG_LEGACY_ROLES[role] ?? null
    case 'negotiation_track':
    case 'negotiation_project':
      return NEGOTIATION_LEGACY_ROLES[role] ?? 'negotiation.member'
    case 'event':
      return role === 'coordinator' ? 'cct.coordinator' : 'cct.member'
    default:
      return null
  }
}

// Resolve an assignments row to its appointment role: the recorded
// appointmentRole wins; legacy rows fall back to the explicit map.
export function resolveAppointmentRole(row: {
  appointmentRole?: string | null
  scopeType: string
  scopeId: string
  role?: string
}): string | null {
  if (row.appointmentRole && APPOINTMENT_ROLES[row.appointmentRole]) return row.appointmentRole
  return legacyAppointmentRole(row.scopeType, row.scopeId, row.role ?? '')
}

// An appointment counts only while it is active and within its window.
// Future, expired, revoked and inactive rows grant nothing — but they are
// still reported so members can see pending or finished mandates.
export function appointmentCurrent(
  row: { status: string; startsAt?: any; endsAt?: any },
  now = new Date(),
) {
  if (row.status !== 'active') return false
  if (row.startsAt && new Date(row.startsAt).getTime() > now.getTime()) return false
  if (row.endsAt && new Date(row.endsAt).getTime() <= now.getTime()) return false
  return true
}

// Why a row does not currently grant the appointment (for reporting/audit).
export function appointmentState(
  row: { status: string; startsAt?: any; endsAt?: any },
  now = new Date(),
) {
  if (row.status !== 'active') return row.status // inactive | expired | revoked
  if (row.startsAt && new Date(row.startsAt).getTime() > now.getTime()) return 'future'
  if (row.endsAt && new Date(row.endsAt).getTime() <= now.getTime()) return 'lapsed'
  return 'current'
}

export function councilSeatFor(
  roleKey: string,
  row: { scopeId: string; councilSeat?: string | null },
) {
  const spec = APPOINTMENT_ROLES[roleKey]
  if (!spec) return null
  // Substitutes cover an existing seat recorded on the row.
  if (roleKey === 'council.substitute') return row.councilSeat ?? null
  if (!spec.councilSeat) return null
  return spec.councilSeat.replace('{scope}', row.scopeId)
}

export function capabilitiesFor(roleKey: string, scopeId: string): string[] {
  const spec = APPOINTMENT_ROLES[roleKey]
  return (spec?.capabilities ?? []).map((c) => c.replace('{scope}', scopeId))
}

export function teamKeysFor(roleKey: string): string[] {
  return APPOINTMENT_ROLES[roleKey]?.teamKeys ?? []
}

// The legacy WG role label used by consumers of `wgAssignments`.
export function wgLegacyRoleFor(roleKey: string): string {
  switch (roleKey) {
    case 'wg.contact_point':
      return 'contact'
    case 'wg.safeguarding_officer':
      return 'safeguarding_officer'
    default:
      return 'member'
  }
}
