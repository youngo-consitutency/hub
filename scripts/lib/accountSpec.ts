/**
 * Shared account-provisioning primitive for the demo-accounts script and
 * the integration-test fixture helpers. Applies a declarative account spec
 * to the database (account row + authority records). Contains no
 * identities or credentials — callers supply those.
 *
 * Every scope/role tuple lands in `authority-records`, matching the
 * runtime model in src/lib/authority.ts.
 */
import { recordKind, resolveLegacyRole, normaliseScopeType } from '../../src/lib/authority'

export interface AccountSpec {
  email: string
  password: string
  name: string
  /** Technical account kind only — authority comes from `records`. */
  role?: 'member'
  entityType?: 'individual' | 'organization'
  membershipTrack?: 'network' | 'constituency_work'
  /** Completed onboarding + verification (memberStatus/hubAccessStatus). */
  verified?: boolean
  /** Team mandates, e.g. 'election_facilitation', 'membership_team'. */
  teams?: string[]
  /** Working-group scope: 'member' = participation, 'contact' = mandate. */
  wg?: { slug: string; role: string }
  /** Operational body scope (platform bodies). */
  body?: { slug: string; role: string }
  /** Explicit mandate grants (canonical registry role values). */
  records?: { role: string; scopeType?: string; scopeId?: string; kind?: string }[]
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
      track === 'constituency_work' ? (verified ? 'active' : 'pending_onboarding') : null,
    role: spec.role ?? 'member',
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

  // One upsert into the single authority store: the tuple resolves to its
  // canonical registry role and `kind` marks mandate vs participation.
  // Unknown tuples are an error, never silently widened.
  const upsertRecord = async (role: string, scopeType: string, scopeId: string, kind?: string) => {
    const canonical = normaliseScopeType(scopeType)
    const existing = await payload.find({
      collection: 'authority-records',
      where: {
        and: [
          { account: { equals: account.id } },
          { role: { equals: role } },
          { scopeType: { equals: canonical } },
          { scopeId: { equals: scopeId } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })
    const row = {
      account: account.id,
      kind: kind ?? recordKind(canonical, role),
      role,
      scopeType: canonical,
      scopeId,
      status: 'active',
      startsAt: NOW(),
      recordedBy: account.id,
    }
    if (existing.docs[0]) {
      return payload.update({
        collection: 'authority-records',
        id: existing.docs[0].id,
        data: row,
        overrideAccess: true,
      })
    }
    return payload.create({
      collection: 'authority-records',
      data: row,
      overrideAccess: true,
    })
  }

  const recordScope = async (scopeType: string, scopeId: string, role: string) => {
    const resolved = resolveLegacyRole(scopeType, scopeId, role)
    if (!resolved) throw new Error(`Unmapped scope ${scopeType}:${scopeId} role=${role}`)
    return upsertRecord(resolved, scopeType, scopeId, recordKind(scopeType, role))
  }

  for (const team of spec.teams ?? []) {
    await recordScope('team', team, 'member')
  }
  if (spec.body) {
    await recordScope('body', spec.body.slug, spec.body.role)
  }
  for (const a of spec.records ?? []) {
    await upsertRecord(a.role, a.scopeType ?? 'platform', a.scopeId ?? 'platform', a.kind)
  }
  if (spec.wg) {
    await recordScope('working_group', spec.wg.slug, spec.wg.role)
    const progress = await payload.find({
      collection: 'wg-progress',
      where: {
        and: [{ account: { equals: account.id } }, { wgSlug: { equals: spec.wg.slug } }],
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
