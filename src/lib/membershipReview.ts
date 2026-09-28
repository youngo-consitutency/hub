import { accountView } from './accounts'
import { requirePgPool, getPgPool, pickField } from './pg'

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
  member_status, role, team_roles, course_passed_at, course_score, verified_at,
  constituency_work_status, hub_access_status, membership_status,
  onboarding_cohort, renewal_due_at, membership_ended_at, membership_end_reason,
  created_at, last_login_at, email_verified_at, verified_by
`

function textList(value: any): string[] {
  if (Array.isArray(value))
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function pickDate(row: any, snake: string, camel: string) {
  const value = row?.[snake] ?? row?.[camel]
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

function pickBool(row: any, snake: string, camel: string) {
  const value = row?.[snake] ?? row?.[camel]
  if (value === true || value === 'yes' || value === 'true') return true
  if (value === false || value === 'no' || value === 'false') return false
  return null
}

export function extractPublicLinks(...values: any[]) {
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

export function membershipReviewAccount(row: any) {
  const account = accountView(row)
  if (!account) return null
  const orgWebsite = pickField(row, 'org_website', 'orgWebsite')
  const orgSocial = pickField(row, 'org_social', 'orgSocial')
  const under18 = Boolean(row.under_18 ?? row.under18)
  const minorityGroups = textList(row.minority_groups ?? row.minorityGroups)
  const minorityOther = pickField(row, 'minority_other', 'minorityOther')
  return {
    ...account,
    application: {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: account.phone,
      gender: account.gender,
      genderOther: pickField(row, 'gender_other', 'genderOther'),
      dateOfBirth: pickDate(row, 'date_of_birth', 'dateOfBirth'),
      ageBand: account.ageBand,
      entityType: account.entityType,
      membershipTrack: account.membershipTrack,
      countryOfResidence: account.country,
      region: account.region,
      nationality: account.nationality,
      motivation: pickField(row, 'motivation', 'motivation'),
      minorityIdentity: minorityGroups.length || minorityOther ? true : false,
      minorityGroups,
      minorityOther,
      memberOfAccreditedNgo: pickBool(
        row,
        'member_of_accredited_ngo',
        'memberOfAccreditedNgo',
      ),
      organizationName: account.organizationName,
      organizationType: account.organizationType,
      isUnfcccAdmitted: account.isUnfcccAdmitted,
      youthAffiliation: account.youthAffiliation,
      orgWebsite,
      orgSocial,
      orgMission: pickField(row, 'org_mission', 'orgMission'),
      orgOperateIn: pickField(row, 'org_operate_in', 'orgOperateIn'),
      under18,
      guardianName: under18 ? pickField(row, 'guardian_name', 'guardianName') : null,
      guardianEmail: under18
        ? pickField(row, 'guardian_email', 'guardianEmail')
        : null,
      guardianConsent: under18
        ? pickBool(row, 'guardian_consent', 'guardianConsent')
        : null,
      dcpName: pickField(row, 'dcp_name', 'dcpName'),
      dcpEmail: pickField(row, 'dcp_email', 'dcpEmail'),
      dcpPhone: pickField(row, 'dcp_phone', 'dcpPhone'),
      ycpName: pickField(row, 'ycp_name', 'ycpName'),
      ycpEmail: pickField(row, 'ycp_email', 'ycpEmail'),
      ycpPhone: pickField(row, 'ycp_phone', 'ycpPhone'),
      acceptCodeOfConduct: pickBool(
        row,
        'accept_code_of_conduct',
        'acceptCodeOfConduct',
      ),
      acceptDataProtection: pickBool(
        row,
        'accept_data_protection',
        'acceptDataProtection',
      ),
      acceptPrinciples: pickBool(row, 'accept_principles', 'acceptPrinciples'),
      acceptCoiPolicy: pickBool(row, 'accept_coi_policy', 'acceptCoiPolicy'),
      policiesAccepted: pickBool(row, 'policies_accepted', 'policiesAccepted'),
      membershipPolicyVersion: account.membershipPolicyVersion || null,
      privacyConsent: pickBool(row, 'privacy_consent', 'privacyConsent'),
      privacyNoticeVersion: account.privacyNoticeVersion,
      privacyConsentAt: account.privacyConsentAt,
      coiDeclared: pickBool(row, 'coi_declared', 'coiDeclared'),
      coiDetails: pickField(row, 'coi_details', 'coiDetails'),
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
  return rows.map(membershipReviewAccount)
}

function profileShape(row: any, account: any) {
  const updatedAt = row?.updated_at ?? row?.updatedAt ?? null
  const photoUpdatedAt = row?.photo_updated_at ?? row?.photoUpdatedAt ?? null
  return {
    accountId: account.id,
    displayName:
      row?.display_name ?? row?.displayName ?? account.name ?? 'YOUNGO member',
    headline: row?.headline || '',
    bio: row?.bio || '',
    pronouns: row?.pronouns || '',
    expertiseTags: row?.expertise_tags ?? row?.expertiseTags ?? [],
    directoryVisibility:
      row?.directory_visibility ?? row?.directoryVisibility ?? 'private',
    showCountry: Boolean(row?.show_country ?? row?.showCountry),
    showOrganization: Boolean(row?.show_organization ?? row?.showOrganization),
    showWorkingGroups:
      row?.show_working_groups ?? row?.showWorkingGroups ?? true,
    showRoles: row?.show_roles ?? row?.showRoles ?? true,
    roleTitle: row?.role_title ?? row?.roleTitle ?? '',
    revision: row?.revision || 1,
    updatedAt,
    hasPhoto: Boolean(row?.has_photo ?? row?.hasPhoto ?? photoUpdatedAt),
    photoUpdatedAt,
    photoUrl: photoUpdatedAt
      ? `/api/member/people/${account.id}/photo?v=${encodeURIComponent(photoUpdatedAt)}`
      : null,
  }
}

export async function listMemberProfileSummaries(accounts: any[]) {
  const byAccountId = new Map<number, any>()
  if (!accounts.length) return byAccountId
  const pool = getPgPool()
  let rows: any[] = []
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
    const profile = profileShape(byId.get(account.id), account)
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
