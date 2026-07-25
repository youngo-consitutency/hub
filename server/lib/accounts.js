import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { getPool } from './db.js'
import {
  hashPassword,
  verifyPassword,
  newSessionToken,
  sessionExpiry,
} from './password.js'
import { getAccessProfile } from './access.js'
import {
  PRIVACY_VERSION,
  CONSENT_STATEMENT,
} from '../../shared/privacyNotice.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../data')
const accountsPath = path.join(dataDir, 'hub-accounts.json')
const sessionsPath = path.join(dataDir, 'hub-sessions.json')
const seatsPath = path.join(dataDir, 'ngo-seats.json')

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^\+?[\d\s().-]{7,22}$/
const WORD_LIMIT = 250
const VERIFIED_PLATFORM_ROLES = new Set(['admin', 'focal_point'])

export const REGIONS = [
  'Africa',
  'Asia-Pacific',
  'Eastern Europe',
  'Latin America and the Caribbean',
  'Western Europe and Others',
]

export const GENDERS = [
  'Female',
  'Male',
  'Non-binary',
  'Prefer not to say',
  'Other',
]

export const MINORITY_OPTIONS = [
  'Indigenous peoples',
  'Persons with disabilities',
  'LGBTQIA+ community',
  'Refugees',
  'Women',
  'Children',
  'Other',
]

export const AGE_BANDS = ['under_18', '18_35', '35_plus']

export const YOUTH_AFFILIATIONS = ['primary', 'secondary', 'no']

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* empty */
  }
  return fallback
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function publicAccount(row) {
  if (!row) return null
  const first = row.first_name ?? row.firstName
  const last = row.last_name ?? row.lastName
  const name = row.name || [first, last].filter(Boolean).join(' ')
  const memberStatus = row.member_status ?? row.memberStatus ?? 'pending_course'
  const role = row.role || 'member'
  const hubAccessStatus =
    row.hub_access_status ??
    row.hubAccessStatus ??
    (memberStatus === 'verified' ? 'active' : 'pending_course')
  return {
    id: row.id,
    email: row.email,
    name,
    firstName: first || null,
    lastName: last || null,
    phone: row.phone || null,
    gender: row.gender || null,
    entityType: row.entity_type ?? row.entityType,
    membershipTrack: row.membership_track ?? row.membershipTrack,
    country: row.country,
    nationality: row.nationality || null,
    region: row.region || null,
    ageBand: row.age_band ?? row.ageBand ?? null,
    organizationName: row.organization_name ?? row.organizationName ?? null,
    organizationType: row.organization_type ?? row.organizationType ?? null,
    isUnfcccAdmitted: Boolean(row.is_unfccc_admitted ?? row.isUnfcccAdmitted),
    youthAffiliation: row.youth_affiliation ?? row.youthAffiliation ?? null,
    under18: Boolean(row.under_18 ?? row.under18),
    constituencyWorkStatus:
      row.constituency_work_status ?? row.constituencyWorkStatus ?? null,
    membershipPolicyVersion:
      row.membership_policy_version ?? row.membershipPolicyVersion,
    privacyConsent: Boolean(row.privacy_consent ?? row.privacyConsent),
    privacyNoticeVersion:
      row.privacy_notice_version ?? row.privacyNoticeVersion ?? null,
    privacyConsentAt: row.privacy_consent_at ?? row.privacyConsentAt ?? null,
    memberStatus,
    hubAccessStatus,
    membershipStatus:
      row.membership_status ??
      row.membershipStatus ??
      (row.course_passed_at ? 'course_passed' : 'registered'),
    onboardingCohort: row.onboarding_cohort ?? row.onboardingCohort ?? null,
    renewalDueAt: row.renewal_due_at ?? row.renewalDueAt ?? null,
    membershipEndedAt: row.membership_ended_at ?? row.membershipEndedAt ?? null,
    membershipEndReason:
      row.membership_end_reason ?? row.membershipEndReason ?? null,
    role,
    teamRoles: row.team_roles ?? row.teamRoles ?? [],
    wgInterests: row.wg_interests ?? row.wgInterests ?? [],
    coursePassedAt: row.course_passed_at ?? row.coursePassedAt ?? null,
    courseScore: row.course_score ?? row.courseScore ?? null,
    verifiedAt: row.verified_at ?? row.verifiedAt ?? null,
    isVerified:
      hubAccessStatus === 'active' &&
      (memberStatus === 'verified' || VERIFIED_PLATFORM_ROLES.has(role)),
    isAdmin: role === 'admin',
    isFocalPoint: role === 'focal_point',
    isMandateHolder: [
      'admin',
      'focal_point',
      'wg_contact',
      'ngo_admin',
    ].includes(role),
    isWgContact: role === 'wg_contact' || role === 'admin',
    isNgo: (row.entity_type ?? row.entityType) === 'organization',
    isNgoAdmin: role === 'ngo_admin' || role === 'admin',
    createdAt: row.created_at ?? row.createdAt,
    lastLoginAt: row.last_login_at ?? row.lastLoginAt ?? null,
  }
}

async function enrichAccountAccess(account) {
  if (!account) return null
  const accessProfile = await getAccessProfile(account)
  const pool = getPool()
  let ngoSeat
  if (pool) {
    const { rows } = await pool.query(
      `SELECT org_account_id, seat_role FROM ngo_seats
       WHERE member_account_id = $1 AND status = 'active'
       ORDER BY accepted_at DESC NULLS LAST
       LIMIT 1`,
      [account.id],
    )
    ngoSeat = rows[0]
  } else {
    ngoSeat = readJson(seatsPath, [])
      .filter(
        (row) =>
          row.member_account_id === account.id && row.status === 'active',
      )
      .sort((a, b) =>
        String(b.accepted_at || '').localeCompare(String(a.accepted_at || '')),
      )[0]
  }

  return {
    ...account,
    access: {
      ...accessProfile,
      isAdmin: account.role === 'admin',
      managedWgs: accessProfile.wgAssignments.map((item) => item.wgSlug).sort(),
      ngo: ngoSeat
        ? { orgAccountId: ngoSeat.org_account_id, seatRole: ngoSeat.seat_role }
        : null,
    },
  }
}

function ageFromDob(dob) {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age
}

function asStringArray(value) {
  if (Array.isArray(value))
    return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function parseYesNo(value) {
  if (value === true || value === 'yes') return true
  if (value === false || value === 'no') return false
  return null
}

function requirePassword(password, passwordConfirm, fields) {
  if (password.length < 10)
    fields.password =
      'Password must be at least 10 characters (for YOUNGO Hub access).'
  if (password.length > 200) fields.password = 'Password is too long.'
  if (password !== passwordConfirm)
    fields.passwordConfirm = 'Passwords do not match.'
}

function requireAgreements(b, fields) {
  // Single "Yes" for org combined policies OR individual four checkboxes
  const combined = Boolean(b.acceptAllOrgPolicies)
  const acceptCodeOfConduct = Boolean(b.acceptCodeOfConduct) || combined
  const acceptDataProtection = Boolean(b.acceptDataProtection) || combined
  const acceptPrinciples = Boolean(b.acceptPrinciples) || combined
  const acceptCoiPolicy = Boolean(b.acceptCoiPolicy) || combined
  if (!acceptCodeOfConduct)
    fields.acceptCodeOfConduct = 'You must agree to the YOUNGO Code of Conduct.'
  if (!acceptDataProtection)
    fields.acceptDataProtection =
      'You must agree to the YOUNGO Data Protection Policy.'
  if (!acceptPrinciples)
    fields.acceptPrinciples = 'You must agree to the YOUNGO Principles.'
  if (!acceptCoiPolicy)
    fields.acceptCoiPolicy =
      'You must agree to the YOUNGO Conflict of Interest Policy.'
  if (combined && !acceptCodeOfConduct) {
    fields.acceptAllOrgPolicies =
      'The organisation must agree to YOUNGO’s policies and principles.'
  }
  return {
    acceptCodeOfConduct,
    acceptDataProtection,
    acceptPrinciples,
    acceptCoiPolicy,
  }
}

/**
 * Explicit consent to the YOUNGO Hub Privacy Notice.
 *
 * Policy agreements and consent to process personal data are separate choices.
 * The server records the current notice version instead of trusting a version
 * supplied by the client.
 */
function requirePrivacyConsent(b, fields) {
  const consented = Boolean(b.privacyConsent)
  if (!consented) {
    fields.privacyConsent =
      'Please read the YOUNGO Hub Privacy Notice and confirm you consent to your data being used as it describes.'
    return null
  }
  const claimed = String(b.privacyNoticeVersion || '').trim()
  if (claimed && claimed !== PRIVACY_VERSION) {
    fields.privacyConsent =
      'The Privacy Notice has been updated since this page was opened. Please reload, read the current notice, and consent again.'
    return null
  }
  return {
    privacyConsent: true,
    privacyNoticeVersion: PRIVACY_VERSION,
    privacyConsentAt: new Date().toISOString(),
    privacyConsentStatement: CONSENT_STATEMENT,
  }
}

/**
 * Validate individual and organisation registration.
 */
export function validateRegistration(body) {
  const b = body || {}
  const fields = {}

  // The honeypot field must remain separate from the organisation website.
  if (b.hpWebsite || b.website === 'http://bot') return { honeypot: true }
  // Continue to reject obvious spam sent through the old honeypot field.
  if (
    b.website &&
    !b.orgWebsite &&
    String(b.website).includes('http') &&
    b.entityType !== 'organization'
  ) {
    // Older individual forms used `website` as their honeypot.
    if (!b.firstName && !b.phone) return { honeypot: true }
  }

  const entityType = String(b.entityType || '').trim()
  const membershipTrack =
    String(b.membershipTrack || 'network').trim() || 'network'
  const membershipPolicyVersion = String(b.membershipPolicyVersion || '').trim()
  const password = String(b.password || '')
  const passwordConfirm = String(b.passwordConfirm || '')

  if (!['individual', 'organization'].includes(entityType)) {
    fields.entityType = 'Choose Individual or Organisation / NGO.'
  }
  if (!['network', 'constituency_work'].includes(membershipTrack)) {
    fields.membershipTrack = 'Choose a membership track.'
  }
  if (!membershipPolicyVersion) {
    fields.membershipPolicyVersion =
      'You must read the Membership Policy first.'
  }
  requirePassword(password, passwordConfirm, fields)

  // Organisation registration
  if (entityType === 'organization') {
    const email = String(b.email || '')
      .trim()
      .toLowerCase()
    const organizationName = String(b.organizationName || '').trim()
    const isUnfcccAdmitted = parseYesNo(b.isUnfcccAdmitted)
    const orgOperateIn = String(b.orgOperateIn || '').trim()
    const orgWebsite = String(b.orgWebsite || '').trim() || null
    const orgSocial = String(b.orgSocial || '').trim() || null
    const orgMission = String(b.orgMission || '').trim() || null
    const dcpName = String(b.dcpName || '').trim() || null
    const dcpEmail =
      String(b.dcpEmail || '')
        .trim()
        .toLowerCase() || null
    const dcpPhone = String(b.dcpPhone || '').trim() || null
    const ycpName = String(b.ycpName || '').trim() || null
    const ycpEmail =
      String(b.ycpEmail || '')
        .trim()
        .toLowerCase() || null
    const ycpPhone = String(b.ycpPhone || '').trim() || null
    const youthAffiliation = String(b.youthAffiliation || '').trim() || null
    const region = String(b.region || b.orgRegion || '').trim()
    const country = String(b.orgCountry || b.country || '').trim()

    if (!EMAIL_RE.test(email)) fields.email = 'Please enter a valid email.'
    if (!organizationName)
      fields.organizationName =
        'Full legal name of the organisation is required.'
    if (organizationName.length > 200)
      fields.organizationName = 'Organisation name is too long.'
    if (isUnfcccAdmitted === null) {
      fields.isUnfcccAdmitted =
        'Indicate whether this organisation is an admitted UNFCCC observer NGO.'
    }
    if (orgMission && wordCount(orgMission) > WORD_LIMIT) {
      fields.orgMission = `Please keep the summary to ${WORD_LIMIT} words or fewer.`
    }

    const agreements = requireAgreements(b, fields)
    const privacy = requirePrivacyConsent(b, fields)

    if (isUnfcccAdmitted === true) {
      // UNFCCC-admitted organisation
      if (!YOUTH_AFFILIATIONS.includes(youthAffiliation)) {
        fields.youthAffiliation =
          'Indicate affiliation with “youth” within the UNFCCC.'
      }
      if (!REGIONS.includes(region))
        fields.region =
          'Select the UN region where the organisation is legally established.'
      if (!country)
        fields.country = 'Country of legal establishment is required.'
      if (!dcpName) fields.dcpName = "UNFCCC DCP's full name is required."
      if (!EMAIL_RE.test(dcpEmail || ''))
        fields.dcpEmail = "UNFCCC DCP's official email is required."
      if (!dcpPhone || !PHONE_RE.test(dcpPhone))
        fields.dcpPhone = "UNFCCC DCP's phone (with country code) is required."
      // Contact Point details are optional, but partial entries are invalid.
      const ycpPartial = ycpName || ycpEmail || ycpPhone
      if (ycpPartial) {
        if (!ycpName)
          fields.ycpName =
            'YOUNGO Contact Point name is required if providing a contact point.'
        if (!EMAIL_RE.test(ycpEmail || ''))
          fields.ycpEmail =
            'YOUNGO Contact Point email is required if providing a contact point.'
        if (!ycpPhone || !PHONE_RE.test(ycpPhone))
          fields.ycpPhone =
            'YOUNGO Contact Point phone is required if providing a contact point.'
      }
    } else if (isUnfcccAdmitted === false) {
      // Organisation without UNFCCC admission
      if (!orgOperateIn)
        fields.orgOperateIn = 'Please describe regions/countries of operation.'
      if (!ycpName)
        fields.ycpName = "YOUNGO Contact Point's full name is required."
      if (!EMAIL_RE.test(ycpEmail || ''))
        fields.ycpEmail = "YOUNGO Contact Point's email is required."
      if (!ycpPhone || !PHONE_RE.test(ycpPhone))
        fields.ycpPhone =
          "YOUNGO Contact Point's phone (with country code) is required."
    }

    if (Object.keys(fields).length) return { fields }

    // Prefer the YOUNGO Contact Point, then the designated contact, as the account name.
    const accountName = ycpName || dcpName || organizationName
    const nameParts = accountName.split(/\s+/)
    const firstName = nameParts[0] || organizationName
    const lastName =
      nameParts.slice(1).join(' ') || (isUnfcccAdmitted ? 'DCP' : 'Contact')

    return {
      data: {
        email,
        password,
        firstName,
        lastName,
        name: accountName,
        entityType: 'organization',
        membershipTrack,
        phone: ycpPhone || dcpPhone || '',
        gender: null,
        genderOther: null,
        ageBand: null,
        dateOfBirth: null,
        minorityGroups: [],
        minorityOther: null,
        region: region || null,
        nationality: null,
        country: country || '—',
        motivation: null,
        organizationName,
        organizationType: isUnfcccAdmitted ? 'unfccc_admitted' : 'non_admitted',
        isUnfcccAdmitted: Boolean(isUnfcccAdmitted),
        youthAffiliation: isUnfcccAdmitted ? youthAffiliation : null,
        orgOperateIn: orgOperateIn || null,
        orgWebsite,
        orgSocial,
        orgMission,
        dcpName: isUnfcccAdmitted ? dcpName : null,
        dcpEmail: isUnfcccAdmitted ? dcpEmail : null,
        dcpPhone: isUnfcccAdmitted ? dcpPhone : null,
        ycpName,
        ycpEmail,
        ycpPhone,
        under18: false,
        guardianName: null,
        guardianEmail: null,
        guardianConsent: false,
        ...agreements,
        ...privacy,
        coiDeclared: agreements.acceptCoiPolicy,
        coiDetails: null,
        policiesAccepted: true,
        memberOfAccreditedNgo: Boolean(isUnfcccAdmitted),
        membershipPolicyVersion,
        constituencyWorkStatus: 'pending_onboarding',
        memberStatus: 'pending_course',
        role: 'member',
        wgInterests: [],
      },
    }
  }

  // Individual registration
  const email = String(b.email || '')
    .trim()
    .toLowerCase()
  const firstName = String(b.firstName || '').trim()
  const lastName = String(b.lastName || '').trim()
  const name = `${firstName} ${lastName}`.trim() || String(b.name || '').trim()
  const phone = String(b.phone || '').trim()
  const gender = String(b.gender || '').trim()
  const genderOther = String(b.genderOther || '').trim() || null
  const ageBand = String(b.ageBand || '').trim()
  const dateOfBirth = String(b.dateOfBirth || '').trim() || null
  const minorityIdentity = parseYesNo(b.minorityIdentity)
  let minorityGroups = asStringArray(b.minorityGroups)
  const minorityOther = String(b.minorityOther || '').trim() || null
  const region = String(b.region || '').trim()
  const nationality = String(b.nationality || '').trim()
  const country = String(b.countryOfResidence || b.country || '').trim()
  const motivation = String(b.motivation || '').trim() || null
  const guardianName = String(b.guardianName || '').trim() || null
  const guardianEmail =
    String(b.guardianEmail || '')
      .trim()
      .toLowerCase() || null
  const guardianConsent = Boolean(b.guardianConsent)
  const memberOfAccreditedNgo = parseYesNo(b.memberOfAccreditedNgo)
  const wgInterests = asStringArray(b.wgInterests)

  if (!firstName) fields.firstName = 'First name is required.'
  if (firstName.length > 80) fields.firstName = 'First name is too long.'
  if (!lastName) fields.lastName = 'Last name is required.'
  if (lastName.length > 80) fields.lastName = 'Last name is too long.'
  if (!EMAIL_RE.test(email)) fields.email = 'Please enter a valid email.'
  if (email.length > 160) fields.email = 'Email is too long.'
  if (!phone || !PHONE_RE.test(phone)) {
    fields.phone =
      'Enter a phone number with country code (e.g. +123 456 7890).'
  }
  if (!GENDERS.includes(gender)) fields.gender = 'Please select your gender.'
  if (gender === 'Other' && !genderOther) fields.genderOther = 'Please specify.'
  if (!AGE_BANDS.includes(ageBand))
    fields.ageBand = 'Please select your age group.'
  if (ageBand === '35_plus') {
    fields.ageBand =
      'YOUNGO membership is for children and youth up to 35. Individual membership ends at 35.'
  }
  if (!dateOfBirth) fields.dateOfBirth = 'Date of birth is required.'
  if (!REGIONS.includes(region)) fields.region = 'Please select your UN region.'
  if (!nationality) fields.nationality = 'Nationality is required.'
  if (!country) fields.country = 'Country of residence is required.'
  if (motivation && motivation.length > 2000)
    fields.motivation = 'Please keep this under 2000 characters.'

  const agreements = requireAgreements(b, fields)
  const privacy = requirePrivacyConsent(b, fields)
  if (memberOfAccreditedNgo === null) {
    fields.memberOfAccreditedNgo = 'Please answer for statistics.'
  }

  const invalidMinority = minorityGroups.filter(
    (g) => !MINORITY_OPTIONS.includes(g),
  )
  if (minorityIdentity === null)
    fields.minorityIdentity = 'Please answer yes or no.'
  if (minorityIdentity === true && minorityGroups.length === 0) {
    fields.minorityGroups = 'Select at least one option.'
  }
  if (minorityIdentity === false) minorityGroups = []
  if (invalidMinority.length)
    fields.minorityGroups = 'Invalid minority group selection.'
  if (minorityGroups.includes('Other') && !minorityOther) {
    fields.minorityOther = 'Please specify.'
  }

  let under18 = ageBand === 'under_18'
  if (dateOfBirth) {
    const age = ageFromDob(dateOfBirth)
    if (age === null) fields.dateOfBirth = 'Enter a valid date of birth.'
    else if (age >= 35)
      fields.dateOfBirth = 'Individual membership expires at age 35.'
    else if (age < 18) under18 = true
  }
  if (under18) {
    if (!guardianName)
      fields.guardianName = 'Guardian name is required for members under 18.'
    if (!EMAIL_RE.test(guardianEmail || ''))
      fields.guardianEmail = 'Guardian email is required for members under 18.'
    if (!guardianConsent)
      fields.guardianConsent =
        'Guardian permission is required for members under 18.'
  }

  if (Object.keys(fields).length) return { fields }

  return {
    data: {
      email,
      password,
      firstName,
      lastName,
      name,
      entityType: 'individual',
      membershipTrack,
      phone,
      gender,
      genderOther: gender === 'Other' ? genderOther : null,
      ageBand: under18 ? 'under_18' : '18_35',
      dateOfBirth,
      minorityGroups,
      minorityOther: minorityGroups.includes('Other') ? minorityOther : null,
      region,
      nationality,
      country,
      motivation,
      organizationName: null,
      organizationType: null,
      isUnfcccAdmitted: false,
      youthAffiliation: null,
      orgOperateIn: null,
      orgWebsite: null,
      orgSocial: null,
      orgMission: null,
      dcpName: null,
      dcpEmail: null,
      dcpPhone: null,
      ycpName: null,
      ycpEmail: null,
      ycpPhone: null,
      under18,
      guardianName: under18 ? guardianName : null,
      guardianEmail: under18 ? guardianEmail : null,
      guardianConsent: under18 ? guardianConsent : false,
      ...agreements,
      ...privacy,
      coiDeclared: agreements.acceptCoiPolicy,
      coiDetails: null,
      policiesAccepted: true,
      memberOfAccreditedNgo,
      membershipPolicyVersion,
      constituencyWorkStatus: 'pending_onboarding',
      memberStatus: 'pending_course',
      role: 'member',
      wgInterests,
    },
  }
}

export async function findAccountByEmail(email) {
  const normalized = String(email || '')
    .trim()
    .toLowerCase()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM hub_accounts WHERE lower(email) = lower($1) LIMIT 1',
      [normalized],
    )
    return rows[0] || null
  }
  const list = readJson(accountsPath, [])
  return list.find((a) => a.email.toLowerCase() === normalized) || null
}

export async function findAccountById(id) {
  const accountId = String(id || '').trim()
  if (!accountId) return null
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM hub_accounts WHERE id = $1 LIMIT 1',
      [accountId],
    )
    return rows[0] || null
  }
  const list = readJson(accountsPath, [])
  return list.find((a) => a.id === accountId) || null
}

export async function createAccount(data, client = null) {
  const existing = client
    ? (
        await client.query(
          'SELECT * FROM hub_accounts WHERE lower(email) = lower($1) LIMIT 1',
          [data.email],
        )
      ).rows[0]
    : await findAccountByEmail(data.email)
  if (existing) {
    const err = new Error(
      'An account with this email already exists. Sign in instead.',
    )
    err.code = 'email_taken'
    throw err
  }

  const { salt, hash } = await hashPassword(data.password)
  const pool = client || getPool()

  const memberStatus = data.memberStatus || 'pending_course'
  const role = data.role || 'member'
  const wgInterests = data.wgInterests || []

  if (pool) {
    let rows
    try {
      ;({ rows } = await pool.query(
        `INSERT INTO hub_accounts (
        email, password_hash, password_salt, name, first_name, last_name,
        entity_type, membership_track, country, date_of_birth,
        organization_name, organization_type, is_unfccc_admitted, dcp_name,
        under_18, guardian_name, guardian_email, guardian_consent,
        coi_declared, coi_details, policies_accepted, membership_policy_version,
        constituency_work_status,
        phone, gender, gender_other, age_band, minority_groups, minority_other,
        region, nationality, motivation,
        accept_code_of_conduct, accept_data_protection, accept_principles, accept_coi_policy,
        member_of_accredited_ngo,
        youth_affiliation, org_operate_in, org_website, org_social, org_mission,
        dcp_email, dcp_phone, ycp_name, ycp_email, ycp_phone,
        member_status, role, wg_interests,
        privacy_consent, privacy_notice_version, privacy_consent_at, privacy_consent_statement
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,
        $15,$16,$17,$18,
        $19,$20,$21,$22,
        $23,
        $24,$25,$26,$27,$28,$29,
        $30,$31,$32,
        $33,$34,$35,$36,
        $37,
        $38,$39,$40,$41,$42,
        $43,$44,$45,$46,$47,
        $48,$49,$50,
        $51,$52,$53,$54
      ) RETURNING *`,
        [
          data.email,
          hash,
          salt,
          data.name,
          data.firstName,
          data.lastName,
          data.entityType,
          data.membershipTrack,
          data.country,
          data.dateOfBirth,
          data.organizationName,
          data.organizationType,
          data.isUnfcccAdmitted,
          data.dcpName,
          data.under18,
          data.guardianName,
          data.guardianEmail,
          data.guardianConsent,
          data.coiDeclared,
          data.coiDetails,
          data.policiesAccepted,
          data.membershipPolicyVersion,
          data.constituencyWorkStatus,
          data.phone,
          data.gender,
          data.genderOther,
          data.ageBand,
          data.minorityGroups || [],
          data.minorityOther,
          data.region,
          data.nationality,
          data.motivation,
          data.acceptCodeOfConduct,
          data.acceptDataProtection,
          data.acceptPrinciples,
          data.acceptCoiPolicy,
          data.memberOfAccreditedNgo,
          data.youthAffiliation,
          data.orgOperateIn,
          data.orgWebsite,
          data.orgSocial,
          data.orgMission,
          data.dcpEmail,
          data.dcpPhone,
          data.ycpName,
          data.ycpEmail,
          data.ycpPhone,
          memberStatus,
          role,
          wgInterests,
          Boolean(data.privacyConsent),
          data.privacyNoticeVersion || null,
          data.privacyConsentAt || null,
          data.privacyConsentStatement || null,
        ],
      ))
    } catch (error) {
      if (error.code === '23505') {
        const duplicate = new Error(
          'An account with this email already exists. Sign in instead.',
        )
        duplicate.code = 'email_taken'
        throw duplicate
      }
      throw error
    }
    return publicAccount(rows[0])
  }

  const row = {
    id: randomUUID(),
    email: data.email,
    password_hash: hash,
    password_salt: salt,
    name: data.name,
    first_name: data.firstName,
    last_name: data.lastName,
    entity_type: data.entityType,
    membership_track: data.membershipTrack,
    country: data.country,
    date_of_birth: data.dateOfBirth,
    organization_name: data.organizationName,
    organization_type: data.organizationType,
    is_unfccc_admitted: data.isUnfcccAdmitted,
    dcp_name: data.dcpName,
    under_18: data.under18,
    guardian_name: data.guardianName,
    guardian_email: data.guardianEmail,
    guardian_consent: data.guardianConsent,
    coi_declared: data.coiDeclared,
    coi_details: data.coiDetails,
    policies_accepted: data.policiesAccepted,
    membership_policy_version: data.membershipPolicyVersion,
    constituency_work_status: data.constituencyWorkStatus,
    phone: data.phone,
    gender: data.gender,
    gender_other: data.genderOther,
    age_band: data.ageBand,
    minority_groups: data.minorityGroups || [],
    minority_other: data.minorityOther,
    region: data.region,
    nationality: data.nationality,
    motivation: data.motivation,
    accept_code_of_conduct: data.acceptCodeOfConduct,
    accept_data_protection: data.acceptDataProtection,
    accept_principles: data.acceptPrinciples,
    accept_coi_policy: data.acceptCoiPolicy,
    privacy_consent: Boolean(data.privacyConsent),
    privacy_notice_version: data.privacyNoticeVersion || null,
    privacy_consent_at: data.privacyConsentAt || null,
    privacy_consent_statement: data.privacyConsentStatement || null,
    member_of_accredited_ngo: data.memberOfAccreditedNgo,
    youth_affiliation: data.youthAffiliation,
    org_operate_in: data.orgOperateIn,
    org_website: data.orgWebsite,
    org_social: data.orgSocial,
    org_mission: data.orgMission,
    dcp_email: data.dcpEmail,
    dcp_phone: data.dcpPhone,
    ycp_name: data.ycpName,
    ycp_email: data.ycpEmail,
    ycp_phone: data.ycpPhone,
    member_status: memberStatus,
    role,
    wg_interests: wgInterests,
    course_passed_at: null,
    course_score: null,
    verified_at: null,
    created_at: new Date().toISOString(),
    last_login_at: null,
  }
  const list = readJson(accountsPath, [])
  list.push(row)
  writeJson(accountsPath, list)
  return publicAccount(row)
}

export async function authenticate(email, password) {
  const row = await findAccountByEmail(email)
  if (!row) return null
  const ok = await verifyPassword(
    password,
    row.password_salt,
    row.password_hash,
  )
  if (!ok) return null
  return row
}

export async function createSession(accountId, client = null) {
  const token = newSessionToken()
  const storedToken = createHash('sha256').update(token).digest('hex')
  const expiresAt = sessionExpiry(30)
  const pool = client || getPool()
  if (pool) {
    await pool.query(
      'INSERT INTO hub_sessions(token, account_id, expires_at) VALUES ($1, $2, $3)',
      [storedToken, accountId, expiresAt.toISOString()],
    )
    await pool.query(
      'UPDATE hub_accounts SET last_login_at = now() WHERE id = $1',
      [accountId],
    )
    return { token, expiresAt: expiresAt.toISOString() }
  }
  const sessions = readJson(sessionsPath, [])
  sessions.push({
    token: storedToken,
    account_id: accountId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
  })
  writeJson(sessionsPath, sessions)
  const accounts = readJson(accountsPath, [])
  const idx = accounts.findIndex((a) => a.id === accountId)
  if (idx >= 0) {
    accounts[idx].last_login_at = new Date().toISOString()
    writeJson(accountsPath, accounts)
  }
  return { token, expiresAt: expiresAt.toISOString() }
}

export async function getSessionAccount(token) {
  if (!token) return null
  const storedToken = createHash('sha256').update(token).digest('hex')
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT a.* FROM hub_sessions s
       JOIN hub_accounts a ON a.id = s.account_id
       WHERE s.token = $1 AND s.expires_at > now()
       LIMIT 1`,
      [storedToken],
    )
    if (rows[0]) return enrichAccountAccess(publicAccount(rows[0]))
    const legacy = await pool.query(
      `SELECT a.* FROM hub_sessions s JOIN hub_accounts a ON a.id=s.account_id
       WHERE s.token=$1 AND s.expires_at > now() LIMIT 1`,
      [token],
    )
    return enrichAccountAccess(publicAccount(legacy.rows[0] || null))
  }
  const sessions = readJson(sessionsPath, [])
  const session = sessions.find(
    (s) => s.token === storedToken || s.token === token,
  )
  if (!session) return null
  if (new Date(session.expires_at) <= new Date()) return null
  const accounts = readJson(accountsPath, [])
  const row = accounts.find((a) => a.id === session.account_id)
  return enrichAccountAccess(publicAccount(row || null))
}

export async function destroySession(token) {
  if (!token) return
  const storedToken = createHash('sha256').update(token).digest('hex')
  const pool = getPool()
  if (pool) {
    await pool.query(
      'DELETE FROM hub_sessions WHERE token = $1 OR token = $2',
      [storedToken, token],
    )
    return
  }
  const sessions = readJson(sessionsPath, []).filter(
    (s) => s.token !== token && s.token !== storedToken,
  )
  writeJson(sessionsPath, sessions)
}

export async function destroyAllSessions(accountId) {
  const pool = getPool()
  if (pool) {
    await pool.query('DELETE FROM hub_sessions WHERE account_id=$1', [
      accountId,
    ])
    return
  }
  writeJson(
    sessionsPath,
    readJson(sessionsPath, []).filter((s) => s.account_id !== accountId),
  )
}

export { publicAccount }
