import { accountView } from './accounts'
import { requirePgPool, getPgPool } from './pg'
import { toCamelCase } from './case'
import type { Doc, AccountLike, AnyValue } from './domain'

// Shapes consumed by the membership-team review queue.

const REVIEW_COLUMNS = `
  id, email, name, first_name, last_name, phone, gender, gender_other,
  entity_type, membership_track, country, date_of_birth, nationality, region, age_band,
  organization_name, organization_type, is_unfccc_admitted,
  youth_affiliation, member_of_accredited_ngo,
  motivation, wg_interests, org_operate_in, org_website, org_social, org_mission,
  dcp_name, dcp_email, dcp_phone, ycp_name, ycp_email, ycp_phone,
  under18, guardian_name, guardian_email, guardian_consent,
  minority_groups, minority_other,
  accept_code_of_conduct, accept_data_protection, accept_principles, accept_coi_policy,
  policies_accepted, membership_policy_version,
  privacy_consent, privacy_notice_version, privacy_consent_at,
  coi_declared, coi_details,
  member_status, role, (SELECT COALESCE(jsonb_agg(DISTINCT ar.scope_id), '[]'::jsonb) FROM authority_records ar WHERE ar.account_id=accounts.id AND ar.scope_type='team' AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now())) AS team_roles, course_passed_at, course_score, verified_at,
  constituency_work_status, hub_access_status, membership_status,
  onboarding_cohort, renewal_due_at, membership_ended_at, membership_end_reason,
  created_at, last_login_at, email_verified_at, verified_by
`

function textList(value: AnyValue): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

// Application booleans may arrive as booleans or 'yes'/'no' strings —
// keep the tri-state: undecided stays null rather than collapsing to false.
function toBool(value: AnyValue): boolean | null {
  if (value === true || value === 'yes' || value === 'true') return true
  if (value === false || value === 'no' || value === 'false') return false
  return null
}

function toIsoDate(value: AnyValue) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear()
    const month = String(value.getUTCMonth() + 1).padStart(2, '0')
    const day = String(value.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : text || null
}

export function extractPublicLinks(...values: Doc[]) {
  const found: { href: string; host: string }[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const text = String(value || '')
    if (!text.trim()) continue
    const tokens = text.split(/[\s,;|]+/).filter(Boolean)
    const embedded = text.match(/https?:\/\/[^\s<>"'()]+/gi) || []
    for (const raw of [...tokens, ...embedded]) {
      const trimmed = String(raw || '')
        .trim()
        .replace(/[).,;:]+$/g, '')
      if (!trimmed) continue
      let href = trimmed
      if (!/^https?:\/\//i.test(href)) {
        if (!/^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(href)) continue
        href = `https://${href}`
      }
      try {
        const url = new URL(href)
        if (!['http:', 'https:'].includes(url.protocol)) continue
        if (!url.hostname.includes('.')) continue
        const normalized = url.toString()
        if (seen.has(normalized)) continue
        seen.add(normalized)
        found.push({
          href: normalized,
          host: url.hostname.replace(/^www\./, ''),
        })
      } catch {
        // Ignore tokens that are not URLs.
      }
    }
  }
  return found
}

export function membershipReviewAccount(row: Doc) {
  const account = accountView(row)
  if (!account) return null
  const r = toCamelCase<Doc>(row)
  const orgWebsite = r.orgWebsite ?? null
  const orgSocial = r.orgSocial ?? null
  const under18 = Boolean(r.under18)
  const minorityGroups = textList(r.minorityGroups)
  const minorityOther = r.minorityOther ?? null
  return {
    ...account,
    application: {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: account.phone,
      gender: account.gender,
      genderOther: r.genderOther ?? null,
      dateOfBirth: toIsoDate(r.dateOfBirth),
      ageBand: account.ageBand,
      entityType: account.entityType,
      membershipTrack: account.membershipTrack,
      countryOfResidence: account.country,
      region: account.region,
      nationality: account.nationality,
      motivation: r.motivation ?? null,
      minorityIdentity: minorityGroups.length || minorityOther ? true : false,
      minorityGroups,
      minorityOther,
      memberOfAccreditedNgo: toBool(r.memberOfAccreditedNgo),
      organizationName: account.organizationName,
      organizationType: account.organizationType,
      isUnfcccAdmitted: account.isUnfcccAdmitted,
      youthAffiliation: account.youthAffiliation,
      orgWebsite,
      orgSocial,
      orgMission: r.orgMission ?? null,
      orgOperateIn: r.orgOperateIn ?? null,
      under18,
      guardianName: under18 ? (r.guardianName ?? null) : null,
      guardianEmail: under18 ? (r.guardianEmail ?? null) : null,
      guardianConsent: under18 ? toBool(r.guardianConsent) : null,
      dcpName: r.dcpName ?? null,
      dcpEmail: r.dcpEmail ?? null,
      dcpPhone: r.dcpPhone ?? null,
      ycpName: r.ycpName ?? null,
      ycpEmail: r.ycpEmail ?? null,
      ycpPhone: r.ycpPhone ?? null,
      acceptCodeOfConduct: toBool(r.acceptCodeOfConduct),
      acceptDataProtection: toBool(r.acceptDataProtection),
      acceptPrinciples: toBool(r.acceptPrinciples),
      acceptCoiPolicy: toBool(r.acceptCoiPolicy),
      policiesAccepted: toBool(r.policiesAccepted),
      membershipPolicyVersion: account.membershipPolicyVersion || null,
      privacyConsent: toBool(r.privacyConsent),
      privacyNoticeVersion: account.privacyNoticeVersion,
      privacyConsentAt: account.privacyConsentAt,
      coiDeclared: toBool(r.coiDeclared),
      coiDetails: r.coiDetails ?? null,
      links: extractPublicLinks(orgWebsite, orgSocial),
    },
  }
}

export async function listMembershipReviewItems() {
  const pool = requirePgPool()
  const { rows } = await pool.query(
    `SELECT ${REVIEW_COLUMNS}
     FROM accounts
     ORDER BY created_at DESC
     LIMIT 500`,
  )
  return rows.map(membershipReviewAccount).filter((a): a is NonNullable<typeof a> => a !== null)
}

function profileShape(row: Doc, account: AccountLike) {
  const r = toCamelCase<AnyValue>(row)
  const updatedAt = r.updatedAt ?? null
  const photoUpdatedAt = r.photoUpdatedAt ?? null
  return {
    accountId: account.id,
    displayName: r.displayName ?? account.name ?? 'YOUNGO member',
    headline: r.headline || '',
    bio: r.bio || '',
    pronouns: r.pronouns || '',
    expertiseTags: r.expertiseTags ?? [],
    directoryVisibility: r.directoryVisibility ?? 'private',
    showCountry: Boolean(r.showCountry),
    showOrganization: Boolean(r.showOrganization),
    showWorkingGroups: r.showWorkingGroups ?? true,
    showRoles: r.showRoles ?? true,
    roleTitle: r.roleTitle ?? '',
    revision: r.revision || 1,
    updatedAt,
    hasPhoto: Boolean(r.hasPhoto ?? photoUpdatedAt),
    photoUpdatedAt,
    photoUrl: photoUpdatedAt
      ? `/api/member/people/${account.id}/photo?v=${encodeURIComponent(photoUpdatedAt)}`
      : null,
  }
}

export async function listMemberProfileSummaries(accounts: AccountLike[]) {
  const byAccountId = new Map<number, Doc>()
  if (!accounts.length) return byAccountId
  const pool = getPgPool()
  let rows: Doc[] = []
  if (pool) {
    const result = await pool.query(
      `SELECT p.*,
              ph.updated_at AS photo_updated_at,
              (ph.account_id IS NOT NULL) AS has_photo
       FROM member_profiles p
       LEFT JOIN member_profile_photos ph ON ph.account_id=p.account_id
       WHERE p.account_id=ANY($1::int[])`,
      [accounts.map((account) => account.id)],
    )
    rows = result.rows
  }
  const byId = new Map(rows.map((row) => [row.account_id, row]))
  for (const account of accounts) {
    const profile = profileShape(byId.get(account.id) || {}, account)
    byAccountId.set(account.id, {
      displayName: profile.displayName,
      headline: profile.headline,
      expertiseTags: profile.expertiseTags,
      directoryVisibility: profile.directoryVisibility,
      hasPhoto: profile.hasPhoto,
      photoUrl: profile.photoUrl,
      updatedAt: profile.updatedAt,
    })
  }
  return byAccountId
}

export { profileShape }
