import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { publicAccount } from './accounts.js'
import { getPool } from './db.js'
import { readJson } from './jsonFile.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const accountsPath = path.join(here, '../../data/hub-accounts.json')

const REVIEW_COLUMNS = `
  id, email, name, first_name, last_name, phone, gender, gender_other,
  entity_type, membership_track, country, date_of_birth, nationality, region, age_band,
  organization_name, organization_type, is_unfccc_admitted,
  youth_affiliation, member_of_accredited_ngo,
  motivation, wg_interests, org_operate_in, org_website, org_social, org_mission,
  dcp_name, dcp_email, dcp_phone, ycp_name, ycp_email, ycp_phone,
  under_18, guardian_name, guardian_email, guardian_consent,
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

function pick(row, snake, camel) {
  const value = row?.[snake] ?? row?.[camel]
  if (value == null) return null
  if (typeof value === 'string') {
    const text = value.trim()
    return text || null
  }
  return value
}

function textList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function pickDate(row, snake, camel) {
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

function pickBool(row, snake, camel) {
  const value = row?.[snake] ?? row?.[camel]
  if (value === true || value === 'yes' || value === 'true') return true
  if (value === false || value === 'no' || value === 'false') return false
  return null
}

export function extractPublicLinks(...values) {
  const found = []
  const seen = new Set()
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

export function membershipReviewAccount(row) {
  const account = publicAccount(row)
  if (!account) return null
  const orgWebsite = pick(row, 'org_website', 'orgWebsite')
  const orgSocial = pick(row, 'org_social', 'orgSocial')
  const under18 = Boolean(row.under_18 ?? row.under18)
  const minorityGroups = textList(row.minority_groups ?? row.minorityGroups)
  const minorityOther = pick(row, 'minority_other', 'minorityOther')
  return {
    ...account,
    application: {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      phone: account.phone,
      gender: account.gender,
      genderOther: pick(row, 'gender_other', 'genderOther'),
      dateOfBirth: pickDate(row, 'date_of_birth', 'dateOfBirth'),
      ageBand: account.ageBand,
      entityType: account.entityType,
      membershipTrack: account.membershipTrack,
      countryOfResidence: account.country,
      region: account.region,
      nationality: account.nationality,
      motivation: pick(row, 'motivation', 'motivation'),
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
      orgMission: pick(row, 'org_mission', 'orgMission'),
      orgOperateIn: pick(row, 'org_operate_in', 'orgOperateIn'),
      under18,
      guardianName: under18 ? pick(row, 'guardian_name', 'guardianName') : null,
      guardianEmail: under18
        ? pick(row, 'guardian_email', 'guardianEmail')
        : null,
      guardianConsent: under18
        ? pickBool(row, 'guardian_consent', 'guardianConsent')
        : null,
      dcpName: pick(row, 'dcp_name', 'dcpName'),
      dcpEmail: pick(row, 'dcp_email', 'dcpEmail'),
      dcpPhone: pick(row, 'dcp_phone', 'dcpPhone'),
      ycpName: pick(row, 'ycp_name', 'ycpName'),
      ycpEmail: pick(row, 'ycp_email', 'ycpEmail'),
      ycpPhone: pick(row, 'ycp_phone', 'ycpPhone'),
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
      coiDetails: pick(row, 'coi_details', 'coiDetails'),
      links: extractPublicLinks(orgWebsite, orgSocial),
    },
  }
}

export async function listMembershipReviewItems() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT ${REVIEW_COLUMNS}
       FROM hub_accounts
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    return rows.map(membershipReviewAccount)
  }
  return readJson(accountsPath, []).map(membershipReviewAccount)
}
