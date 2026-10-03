// Policy-backed authority model.
//
// An authority record is a time-bounded, scoped, evidenced responsibility or
// participation recorded on an `authority-records` row. Constituency authority
// derives from these records — never from account titles. `account.role` only
// distinguishes technical administration and account entity kind.
//
// Sources: S13 Governance Policy (bodies/Council), S14 Interim GCT Mandate,
// S25 WG Contact Point Mandate, S15 Liaison Guidelines, S02 Awareness Team,
// S23/S04 Safeguarding, S17 Membership, S24 Selections, S10 Elections.

export interface AuthorityRoleSpec {
  label: string
  /** scopeType values this role may be recorded under. */
  scopeTypes: string[]
  /** Legacy team identifiers emitted to existing consumers (teamRoles). */
  teamKeys?: string[]
  /** Capability templates; `{scope}` interpolates the assignment scopeId. */
  capabilities?: string[]
  /** Council seat key template; `{scope}` interpolates scopeId (S13 §6). */
  councilSeat?: string
  /** Role requires active Constituency Work membership (S17 §1.1). */
  requiresCw?: boolean
}

// The controlled vocabulary. Keep keys stable — rows persist them in
// authority_records.role.
export const AUTHORITY_ROLES: Record<string, AuthorityRoleSpec> = {
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
    scopeTypes: ['organisation'],
    councilSeat: 'org:{scope}',
    capabilities: ['council.vote', 'intelligence.contacts.read'],
    requiresCw: true,
  },
  'org.member': {
    label: 'Organisation member',
    scopeTypes: ['organisation'],
  },
  'org.admin': {
    label: 'Organisation administrator',
    scopeTypes: ['organisation'],
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

export const AUTHORITY_ROLE_KEYS = Object.keys(AUTHORITY_ROLES)

// ── Scope-type normalisation ────────────────────────────────────────
// Historical spellings still arrive from callers ('organization',
// 'platform_body'); the store holds the canonical 'organisation'/'body'
// — the migration canonicalised every copied row. Every comparison runs
// on the canonical form.
const SCOPE_TYPE_ALIASES: Record<string, string> = {
  organization: 'organisation',
  platform_body: 'body',
}
/** Map historical scope-type spellings to their canonical form. */
export function normaliseScopeType(scopeType: string): string {
  return SCOPE_TYPE_ALIASES[scopeType] ?? scopeType
}

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

// Explicit (scopeId='gct', role) tuples. A generic area-agnostic membership
// maps to the coordinator appointment; anything else is unmapped — never
// defaulted into authority by a fallback.
const GCT_LEGACY_ROLES: Record<string, string> = {
  ...GCT_AREAS,
  member: 'gct.coordinator',
  coordinator: 'gct.coordinator',
  lead: 'gct.coordinator',
}

// Role values accepted on scope-keyed team/COY rows — the scopeId is the
// authority tuple element, but only ordinary membership wordings.
const TEAM_MEMBER_ROLES = new Set(['member', 'coordinator', 'lead', ''])

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

// Resolve a recorded (scopeType, scopeId, role) tuple to a registry role,
// or null when unmapped. Every accepted tuple is explicit — unknown roles
// are reported as unmapped and denied, never defaulted into a broader
// role.
export function resolveLegacyRole(scopeType: string, scopeId: string, role: string): string | null {
  switch (normaliseScopeType(scopeType)) {
    case 'team': {
      if (scopeId === 'gct') return GCT_LEGACY_ROLES[role] ?? null
      if (!TEAM_MEMBER_ROLES.has(role)) return null
      return TEAM_LEGACY[scopeId] ?? COY_LIAISON_TEAMS[scopeId] ?? null
    }
    case 'working_group':
      return WG_LEGACY_ROLES[role] ?? null
    case 'operational_team':
      return role === 'liaison' ? 'ot.liaison' : role === 'member' ? 'ot.member' : null
    case 'body': {
      if (COY_LIAISON_TEAMS[role]) return COY_LIAISON_TEAMS[role]
      return BODY_LEGACY_ROLES[role] ?? null
    }
    case 'organisation':
      return ORG_LEGACY_ROLES[role] ?? null
    case 'negotiation_track':
    case 'negotiation_project':
      return NEGOTIATION_LEGACY_ROLES[role] ?? null
    case 'event':
      return role === 'coordinator' ? 'cct.coordinator' : role === 'member' ? 'cct.member' : null
    default:
      return null
  }
}

// Resolve an authority row to its registry role: a canonical stored key
// wins — but only inside the scopes that role declares (a canonical key
// recorded against the wrong scope grants nothing); recorded legacy
// strings fall back to the explicit map.
export function resolveRecordRole(row: {
  role?: string | null
  scopeType: string
  scopeId: string
}): string | null {
  if (row.role && AUTHORITY_ROLES[row.role]?.scopeTypes.includes(row.scopeType)) return row.role
  return resolveLegacyRole(row.scopeType, row.scopeId, row.role ?? '')
}

// A record counts only while it is active and within its window.
// Future, expired, revoked and inactive rows grant nothing — but they are
// still reported so members can see pending or finished mandates.
export function recordCurrent(
  row: { status: string; startsAt?: any; endsAt?: any },
  now = new Date(),
) {
  if (row.status !== 'active') return false
  if (row.startsAt && new Date(row.startsAt).getTime() > now.getTime()) return false
  if (row.endsAt && new Date(row.endsAt).getTime() <= now.getTime()) return false
  return true
}

/** Resolve the Council seat key a role grants on the given row, if any. */
export function councilSeatFor(
  roleKey: string,
  row: { scopeId: string; councilSeat?: string | null },
) {
  const spec = AUTHORITY_ROLES[roleKey]
  if (!spec) return null
  // Substitutes cover an existing seat recorded on the row.
  if (roleKey === 'council.substitute') return row.councilSeat ?? null
  if (!spec.councilSeat) return null
  return spec.councilSeat.replace('{scope}', row.scopeId)
}

/** Expand a role's capability templates for the given scope. */
export function capabilitiesFor(roleKey: string, scopeId: string): string[] {
  const spec = AUTHORITY_ROLES[roleKey]
  return (spec?.capabilities ?? []).map((c) => c.replace('{scope}', scopeId))
}

/** List the legacy team keys a role maps to. */
export function teamKeysFor(roleKey: string): string[] {
  return AUTHORITY_ROLES[roleKey]?.teamKeys ?? []
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

// ── Shared authority derivation ─────────────────────────────────────
// ONE engine for both endpoint families: the Payload access layer and the
// platform service feed rows from the single store into `deriveAuthority`
// and consume the same capabilities/team keys/seats — no parallel
// scope-identifier logic.

// Raw authority row (Payload doc or aliased SQL result).
export interface AuthorityRow {
  id: number
  kind?: string
  role?: string | null
  scopeType: string
  scopeId: string
  councilSeat?: string | null
  status: string
  startsAt?: any
  endsAt?: any
  provenance?: { source?: string; assignmentId?: number | string } | null
}

export interface AuthorityDerivation {
  teamRoles: string[]
  capabilities: string[]
  councilSeats: string[]
  bodyScopes: string[]
  wgAssignments: { wgSlug: string; role: string }[]
  negotiationAssignments: { scopeType: string; scopeId: string; role: string }[]
  records: {
    id: number
    role: string
    scopeType: string
    scopeId: string
    councilSeat: string | null
    endsAt: string | null
    substitute: boolean
  }[]
  unmapped: number
}

// Derive authority from an account's authority rows.
export function deriveAuthority(
  rows: AuthorityRow[],
  opts: { cw: boolean; now?: Date; baseCapabilities?: Iterable<string> },
): AuthorityDerivation {
  const { cw, now = new Date() } = opts
  const teamRoles = new Set<string>()
  const capabilities = new Set(opts.baseCapabilities ?? [])
  const councilSeats = new Set<string>()
  const bodyScopes = new Set<string>()
  const wgAssignments: AuthorityDerivation['wgAssignments'] = []
  const negotiationAssignments: AuthorityDerivation['negotiationAssignments'] = []
  const records: AuthorityDerivation['records'] = []
  let unmapped = 0

  for (const row of rows) {
    if (!recordCurrent(row, now)) continue
    const roleKey = resolveRecordRole(row)
    if (!roleKey || !AUTHORITY_ROLES[roleKey]) {
      // Unmapped records are reported, never widened.
      unmapped += 1
      continue
    }
    const scopeType = normaliseScopeType(row.scopeType)
    const seat = councilSeatFor(roleKey, { scopeId: row.scopeId, councilSeat: row.councilSeat })
    records.push({
      id: row.id,
      role: roleKey,
      scopeType,
      scopeId: row.scopeId,
      councilSeat: seat,
      endsAt: row.endsAt ?? null,
      substitute: roleKey === 'council.substitute',
    })
    // Appointments that require Constituency Work membership grant nothing
    // while that membership is inactive — they still show for the member.
    if (AUTHORITY_ROLES[roleKey].requiresCw && !cw) continue
    for (const key of teamKeysFor(roleKey)) teamRoles.add(key)
    for (const cap of capabilitiesFor(roleKey, row.scopeId)) capabilities.add(cap)
    if (seat) councilSeats.add(seat)
    if (scopeType === 'body') bodyScopes.add(row.scopeId)
    if (scopeType === 'working_group')
      wgAssignments.push({ wgSlug: row.scopeId, role: wgLegacyRoleFor(roleKey) })
    if (['negotiation_track', 'negotiation_project'].includes(scopeType)) {
      const negRole = roleKey.replace('negotiation.', '')
      negotiationAssignments.push({ scopeType, scopeId: row.scopeId, role: negRole })
      const scope = `${scopeType}:${row.scopeId}`
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

  return {
    teamRoles: [...teamRoles],
    capabilities: [...capabilities],
    councilSeats: [...councilSeats],
    bodyScopes: [...bodyScopes],
    wgAssignments,
    negotiationAssignments,
    records,
    unmapped,
  }
}

// ── Record kind ─────────────────────────────────────────────────────
// Member-joinable scopes: a 'member' record in one of these is
// participation (opted membership, no appointing authority needed);
// anything else is a mandate. Writers use this to set `kind`; readers
// never branch on it — authority resolves from the role either way.
export const PARTICIPATION_SCOPES = new Set([
  'body',
  'working_group',
  'organisation',
  'negotiation_track',
  'negotiation_project',
])
const MEMBER_KIND_ROLES = new Set([
  'member',
  'wg.member',
  'body.member',
  'org.member',
  'negotiation.member',
])

/** Classify a role/scope pair as member-joinable 'participation' or an appointed 'mandate'. */
export function recordKind(scopeType: string, role: string): 'mandate' | 'participation' {
  return MEMBER_KIND_ROLES.has(role) && PARTICIPATION_SCOPES.has(normaliseScopeType(scopeType))
    ? 'participation'
    : 'mandate'
}
