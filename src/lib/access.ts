import type { PayloadRequest } from 'payload'

// Port of server/lib/access.js — derives the capability model from the
// account role plus active assignments. Authorisation stays source-side here;
// every endpoint derives access from this module.
export interface AccessProfile {
  teamRoles: string[]
  wgAssignments: { wgSlug: string; role: string }[]
  negotiationAssignments: { scopeType: string; scopeId: string; role: string }[]
  capabilities: string[]
  manageAllWgs: boolean
  isFocalPoint?: boolean
  isMandateHolder?: boolean
  accountId?: string
}

// Only coordination responsibilities carry wg.manage. Ordinary group
// membership is an affiliation, not a management mandate [S25].
export const WG_COORDINATION_ROLES = new Set([
  'contact',
  'lead',
  'coordinator',
  'contact_point',
])

export async function getAccessProfile(
  req: PayloadRequest,
  account: any,
): Promise<AccessProfile> {
  if (!account) {
    return {
      teamRoles: [],
      wgAssignments: [],
      negotiationAssignments: [],
      capabilities: [],
      manageAllWgs: false,
    }
  }
  // Legacy derives team roles from active account_assignments in DB mode
  // (account.teamRoles is fixture-mode only).
  const teamRoles = new Set<string>()
  const wgAssignments: { wgSlug: string; role: string }[] = []
  const negotiationAssignments: {
    scopeType: string
    scopeId: string
    role: string
  }[] = [...(account.negotiationAssignments || [])]

  const now = new Date()
  const { docs } = await req.payload.find({
    collection: 'assignments',
    where: {
      account: { equals: account.id },
      status: { equals: 'active' },
      and: [
        { startsAt: { less_than_equal: now.toISOString() } },
        { or: [{ endsAt: { exists: false } }, { endsAt: { greater_than: now.toISOString() } }] },
      ],
    },
    limit: 1000,
    overrideAccess: true,
  })
  for (const row of docs as any[]) {
    if (row.scopeType === 'team') teamRoles.add(row.scopeId)
    if (row.scopeType === 'working_group')
      wgAssignments.push({ wgSlug: row.scopeId, role: row.role })
    if (['negotiation_track', 'negotiation_project'].includes(row.scopeType))
      negotiationAssignments.push({
        scopeType: row.scopeType,
        scopeId: row.scopeId,
        role: row.role,
      })
  }
  if (account.role === 'admin') {
    teamRoles.add('membership_team')
    teamRoles.add('gys_policy_team')
  }

  const capabilities = new Set([
    'hub.read',
    'intelligence.query',
    'intelligence.writeback.propose',
  ])
  if (account.role === 'admin')
    [
      'platform.manage',
      'accounts.manage',
      'audit.read',
      'ngo.manage_all',
      'points.award',
      'content.draft',
      'content.review',
      'content.publish',
      'intelligence.operations.read',
      'intelligence.writeback.approve',
      'intelligence.writeback.apply',
      'notifications.send',
    ].forEach((x) => capabilities.add(x))
  if (account.role === 'focal_point') {
    capabilities.add('constituency.coordinate')
    capabilities.add('points.award')
  }
  if (teamRoles.has('membership_team')) {
    capabilities.add('membership.review')
    capabilities.add('points.award')
  }
  if (teamRoles.has('gys_policy_team')) {
    capabilities.add('gys.manage')
  }
  if (teamRoles.has('content_editor')) capabilities.add('content.draft')
  if (teamRoles.has('content_publisher')) {
    capabilities.add('content.review')
    capabilities.add('content.publish')
  }
  if (
    ['admin', 'focal_point', 'wg_contact', 'ngo_admin'].includes(
      account.role,
    ) ||
    wgAssignments.length ||
    teamRoles.has('membership_team') ||
    teamRoles.has('gys_policy_team')
  )
    capabilities.add('intelligence.contacts.read')
  for (const item of wgAssignments)
    if (WG_COORDINATION_ROLES.has(item.role))
      capabilities.add(`wg.manage:${item.wgSlug}`)
  for (const item of negotiationAssignments) {
    const scope = `${item.scopeType}:${item.scopeId}`
    capabilities.add(`negotiations.read:${scope}`)
    if (item.role === 'reviewer') {
      capabilities.add(`negotiations.evidence.review:${scope}`)
      capabilities.add(`negotiations.candidates.review:${scope}`)
    }
    if (item.role === 'applier')
      capabilities.add(`negotiations.candidates.apply:${scope}`)
    if (item.role === 'grant_manager')
      capabilities.add(`negotiations.grants.manage:${scope}`)
    if (item.role === 'process_facilitator')
      capabilities.add(`negotiations.process.record:${scope}`)
    if (item.role === 'transmitter')
      capabilities.add(`negotiations.transmission.record:${scope}`)
  }
  return {
    teamRoles: [...teamRoles],
    wgAssignments,
    negotiationAssignments,
    capabilities: [...capabilities],
    manageAllWgs: account.role === 'admin',
    isFocalPoint: account.role === 'focal_point',
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
