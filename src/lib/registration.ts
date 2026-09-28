// Port of the registration validator from server/lib/accounts.js — kept
// behaviour-identical so the SPA's registration form validates exactly as
// before.
import {
  REGIONS,
  GENDERS,
  MINORITY_OPTIONS,
  AGE_BANDS,
  YOUTH_AFFILIATIONS,
} from '../../spa/shared/registration.js'
import { getDocument } from './documents'
import { NATIONALITIES } from '../../spa/shared/nationalities.js'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^\+?[\d\s().-]{7,22}$/
const WORD_LIMIT = 250
const NATIONALITY_SET = new Set(NATIONALITIES)

type Fields = Record<string, string>
type Body = Record<string, any>

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function parseYesNo(value: unknown): boolean | null {
  if (value === true || value === 'yes') return true
  if (value === false || value === 'no') return false
  return null
}

function requirePassword(
  password: string,
  passwordConfirm: string,
  fields: Fields,
) {
  if (password.length < 10)
    fields.password =
      'Password must be at least 10 characters (for YOUNGO Hub access).'
  if (password.length > 200) fields.password = 'Password is too long.'
  if (password !== passwordConfirm)
    fields.passwordConfirm = 'Passwords do not match.'
}

function requireAgreements(b: Body, fields: Fields) {
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

function requirePrivacyConsent(
  b: Body,
  fields: Fields,
  notice: { PRIVACY_VERSION?: string; CONSENT_STATEMENT?: string } | null,
) {
  const consented = Boolean(b.privacyConsent)
  if (!consented) {
    fields.privacyConsent =
      'Please read the YOUNGO Hub Privacy Notice and confirm you consent to your data being used as it describes.'
    return null
  }
  const version = notice?.PRIVACY_VERSION
  if (!version || !notice?.CONSENT_STATEMENT) {
    fields.privacyConsent =
      'The Privacy Notice is unavailable right now. Please try again shortly.'
    return null
  }
  const claimed = String(b.privacyNoticeVersion || '').trim()
  if (claimed && claimed !== version) {
    fields.privacyConsent =
      'The Privacy Notice has been updated since this page was opened. Please reload, read the current notice, and consent again.'
    return null
  }
  return {
    privacyConsent: true,
    privacyNoticeVersion: version,
    privacyConsentAt: new Date().toISOString(),
    privacyConsentStatement: notice.CONSENT_STATEMENT,
  }
}

function wordCount(text: string): number {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function sanitizeWgInterests(value: unknown): string[] {
  return asStringArray(value).slice(0, 30)
}

export async function validateRegistration(req: any, body: Body) {
  const notice = (await getDocument(req, 'privacy-notice'))?.body || null
  const b = body || {}
  const fields: Fields = {}

  if (b.hpWebsite || b.website === 'http://bot') return { honeypot: true }
  if (
    b.website &&
    !b.orgWebsite &&
    String(b.website).includes('http') &&
    b.entityType !== 'organization'
  ) {
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
    const privacy = requirePrivacyConsent(b, fields, notice)

    if (isUnfcccAdmitted === true) {
      if (!YOUTH_AFFILIATIONS.includes(youthAffiliation as any)) {
        fields.youthAffiliation =
          'Indicate affiliation with “youth” within the UNFCCC.'
      }
      if (!(REGIONS as readonly string[]).includes(region))
        fields.region =
          'Select the UN region where the organisation is legally established.'
      if (!country)
        fields.country = 'Country of legal establishment is required.'
      if (!dcpName) fields.dcpName = "UNFCCC DCP's full name is required."
      if (!EMAIL_RE.test(dcpEmail || ''))
        fields.dcpEmail = "UNFCCC DCP's official email is required."
      if (!dcpPhone || !PHONE_RE.test(dcpPhone))
        fields.dcpPhone = "UNFCCC DCP's phone (with country code) is required."
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
      if (!orgOperateIn)
        fields.orgOperateIn = 'Please describe regions/countries of operation.'
      if (!ycpName)
        fields.ycpName = "YOUNGO Contact Point's full name is required."
      if (!EMAIL_RE.test(ycpEmail || ''))
        fields.ycpEmail = "YOUNGO Contact Point's email is required."
      if (!ycpPhone || !PHONE_RE.test(ycpPhone))
        fields.ycpPhone =
          "YOUNGO Contact Point's phone is required if providing a contact point."
    }

    if (Object.keys(fields).length) return { fields }

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
        wgInterests: sanitizeWgInterests(b.wgInterests),
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
  const wgInterests = sanitizeWgInterests(b.wgInterests)

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
  if (!(GENDERS as readonly string[]).includes(gender))
    fields.gender = 'Please select your gender.'
  if (gender === 'Other' && !genderOther) fields.genderOther = 'Please specify.'
  if (!(AGE_BANDS as readonly string[]).includes(ageBand))
    fields.ageBand = 'Please select your age group.'
  if (ageBand === '35_plus') {
    fields.ageBand =
      'YOUNGO membership is for children and youth up to 35. Individual membership ends at 35.'
  }
  if (!dateOfBirth) fields.dateOfBirth = 'Date of birth is required.'
  if (!(REGIONS as readonly string[]).includes(region))
    fields.region = 'Please select your UN region.'
  if (!NATIONALITY_SET.has(nationality))
    fields.nationality = 'Please select a nationality from the list.'
  if (!country) fields.country = 'Country of residence is required.'
  if (motivation && motivation.length > 2000)
    fields.motivation = 'Please keep this under 2000 characters.'

  const agreements = requireAgreements(b, fields)
  const privacy = requirePrivacyConsent(b, fields, notice)
  if (memberOfAccreditedNgo === null) {
    fields.memberOfAccreditedNgo = 'Please answer for statistics.'
  }

  const invalidMinority = minorityGroups.filter(
    (g) => !(MINORITY_OPTIONS as readonly string[]).includes(g),
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
