/**
 * Shared account-provisioning primitive for the demo-accounts script and
 * the integration-test fixture helpers. Applies a declarative account spec
 * to the database (account row + team/WG assignment rows). Contains no
 * identities or credentials — callers supply those.
 */
export interface AccountSpec {
  email: string
  password: string
  name: string
  role?: 'member' | 'admin' | 'focal_point' | 'wg_contact' | 'ngo_admin'
  entityType?: 'individual' | 'organization'
  membershipTrack?: 'network' | 'constituency_work'
  /** Completed onboarding + verification (memberStatus/hubAccessStatus). */
  verified?: boolean
  /** Team scopes, e.g. 'election_facilitation', 'membership_team'. */
  teams?: string[]
  /** Working-group assignment. */
  wg?: { slug: string; role: string }
  /** Required by the accounts collection; callers may override. */
  country?: string
}

const NOW = () => new Date().toISOString()

export async function applyAccountSpec(payload: any, spec: AccountSpec) {
  const verified = spec.verified !== false
  const track = spec.membershipTrack ?? 'network'
  const { docs } = await payload.find({
    collection: 'accounts',
    where: { email: { equals: spec.email } },
    limit: 1,
    overrideAccess: true,
  })
  const data = {
    email: spec.email,
    name: spec.name,
    firstName: spec.name.split(' ')[0] ?? spec.name,
    lastName: spec.name.split(' ').slice(1).join(' ') || spec.name,
    password: spec.password,
    country: spec.country ?? 'Kenya',
    entityType: spec.entityType ?? 'individual',
    membershipTrack: track,
    memberStatus: verified ? 'verified' : 'pending_course',
    hubAccessStatus: verified ? 'active' : 'pending_course',
    membershipStatus: verified ? 'active' : 'registered',
    constituencyWorkStatus:
      track === 'constituency_work'
        ? verified
          ? 'active'
          : 'pending_onboarding'
        : null,
    role: spec.role ?? 'member',
    teamRoles: spec.teams ?? [],
    policiesAccepted: true,
    membershipPolicyVersion: 'current',
    privacyConsent: true,
    privacyConsentAt: NOW(),
    coiDeclared: true,
    verifiedAt: verified ? NOW() : null,
    coursePassedAt: verified ? NOW() : null,
    emailVerifiedAt: verified ? NOW() : null,
  }
  const account = docs[0]
    ? await payload.update({
        collection: 'accounts',
        id: docs[0].id,
        data,
        overrideAccess: true,
      })
    : await payload.create({ collection: 'accounts', data, overrideAccess: true })

  const upsertAssignment = async (
    scopeType: string,
    scopeId: string,
    role: string,
  ) => {
    const existing = await payload.find({
      collection: 'assignments',
      where: {
        and: [
          { account: { equals: account.id } },
          { scopeType: { equals: scopeType } },
          { scopeId: { equals: scopeId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const row = {
      account: account.id,
      scopeType,
      scopeId,
      role,
      status: 'active',
      startsAt: NOW(),
      assignedBy: account.id,
    }
    if (existing.docs[0]) {
      return payload.update({
        collection: 'assignments',
        id: existing.docs[0].id,
        data: row,
        overrideAccess: true,
      })
    }
    return payload.create({
      collection: 'assignments',
      data: row,
      overrideAccess: true,
    })
  }

  for (const team of spec.teams ?? []) {
    await upsertAssignment('team', team, 'member')
  }
  if (spec.wg) {
    await upsertAssignment('working_group', spec.wg.slug, spec.wg.role)
    const progress = await payload.find({
      collection: 'wg-progress',
      where: {
        and: [
          { account: { equals: account.id } },
          { wgSlug: { equals: spec.wg.slug } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const row = {
      account: account.id,
      wgSlug: spec.wg.slug,
      presentationOk: true,
      rulesOk: true,
      status: 'active',
      roleInWg: spec.wg.role,
      unlockedAt: NOW(),
    }
    if (progress.docs[0]) {
      await payload.update({
        collection: 'wg-progress',
        id: progress.docs[0].id,
        data: row,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'wg-progress',
        data: row,
        overrideAccess: true,
      })
    }
  }
  return account
}
