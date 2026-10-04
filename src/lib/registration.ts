// Port of the registration validator from server/lib/accounts.js — kept
// behaviour-identical so the SPA's registration form validates exactly as
// before. Field shape checks are zod schemas; option lists (regions, genders,
// nationalities, …) live in the `registration-options` content document,
// edited via the database/console, so dynamic membership stays imperative.
import type { AnyValue, Doc } from './domain'
import { z } from 'zod'
import { getDocument } from './documents'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_RE = /^\+?[\d\s().-]{7,22}$/
const WORD_LIMIT = 250

type RegistrationOptions = {
  regions?: string[]
  genders?: string[]
  minorityOptions?: string[]
  ageBands?: { value: string }[]
  youthAffiliations?: { value: string }[]
  nationalities?: string[]
}

// When the document is absent the whitelist degrades to a non-empty check so
// a fresh install stays usable; once staff publish options they are enforced.
function optionSets(options: RegistrationOptions) {
  return {
    regions: new Set(options.regions || []),
    genders: new Set(options.genders || []),
    minorities: new Set(options.minorityOptions || []),
    ageBands: new Set((options.ageBands || []).map((o) => o.value)),
    affiliations: new Set((options.youthAffiliations || []).map((o) => o.value)),
    nationalities: new Set(options.nationalities || []),
  }
}

// Non-empty when no managed list exists; membership otherwise.
function allowed(set: Set<string>, value: string) {
  return set.size ? set.has(value) : Boolean(value)
}

type Fields = Record<string, string>
type Body = Doc

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
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function parseYesNo(value: unknown): boolean | null {
  if (value === true || value === 'yes') return true
  if (value === false || value === 'no') return false
  return null
}

// Normalising primitives — coerce the raw request body so constraint checks
// and output mapping both see clean values.
const str = <T extends z.ZodTypeAny>(inner: T) => z.preprocess((v) => String(v ?? ''), inner)
const strTrim = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => String(v ?? '').trim(), inner)
const strOpt = () => z.preprocess((v) => String(v ?? '').trim() || null, z.string().nullable())
const strEmailOpt = () =>
  z.preprocess(
    (v) =>
      String(v ?? '')
        .trim()
        .toLowerCase() || null,
    z.string().nullable(),
  )
const yesNo = () => z.preprocess(parseYesNo, z.boolean().nullable())
const strList = () => z.preprocess(asStringArray, z.array(z.string()))

// Zod issues → the field-error map the SPA renders. Last write wins, matching
// the previous sequential `fields[k] = …` assignments.
function addIssues(error: z.ZodError, fields: Fields) {
  for (const issue of error.issues) {
    const key = String(issue.path[0] || '')
    if (key) fields[key] = issue.message
  }
}

const issue = (ctx: z.RefinementCtx, path: string, message: string) =>
  ctx.addIssue({ code: 'custom', path: [path], message })

// Shared shape: entity/track/policy/password are validated regardless of
// which entity branch runs.
const baseSchema = z
  .object({
    entityType: z.preprocess(
      (v) => String(v ?? '').trim(),
      z.enum(['individual', 'organization'], {
        error: 'Choose Individual or Organisation / NGO.',
      }),
    ),
    membershipTrack: z.preprocess(
      (v) => String(v ?? '').trim() || 'network',
      z.enum(['network', 'constituency_work'], {
        error: 'Choose a membership track.',
      }),
    ),
    membershipPolicyVersion: strTrim(
      z.string().min(1, 'You must read the Membership Policy first.'),
    ),
    password: str(
      z
        .string()
        .min(10, 'Password must be at least 10 characters (for YOUNGO Hub access).')
        .max(200, 'Password is too long.'),
    ),
    passwordConfirm: str(z.string()),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.passwordConfirm) {
      issue(ctx, 'passwordConfirm', 'Passwords do not match.')
    }
  })

function wordCount(text: string): number {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function sanitizeWgInterests(value: unknown): string[] {
  return asStringArray(value).slice(0, 30)
}

function agreementFields(b: Body, fields: Fields) {
  const combined = Boolean(b.acceptAllOrgPolicies)
  const acceptCodeOfConduct = Boolean(b.acceptCodeOfConduct) || combined
  const acceptDataProtection = Boolean(b.acceptDataProtection) || combined
  const acceptPrinciples = Boolean(b.acceptPrinciples) || combined
  const acceptCoiPolicy = Boolean(b.acceptCoiPolicy) || combined
  if (!acceptCodeOfConduct)
    fields.acceptCodeOfConduct = 'You must agree to the YOUNGO Code of Conduct.'
  if (!acceptDataProtection)
    fields.acceptDataProtection = 'You must agree to the YOUNGO Data Protection Policy.'
  if (!acceptPrinciples) fields.acceptPrinciples = 'You must agree to the YOUNGO Principles.'
  if (!acceptCoiPolicy)
    fields.acceptCoiPolicy = 'You must agree to the YOUNGO Conflict of Interest Policy.'
  return {
    acceptCodeOfConduct,
    acceptDataProtection,
    acceptPrinciples,
    acceptCoiPolicy,
  }
}

function privacyConsentError(
  b: Body,
  notice: { PRIVACY_VERSION?: string; CONSENT_STATEMENT?: string } | null,
): string | null {
  if (!b.privacyConsent) {
    return 'Please read the YOUNGO Hub Privacy Notice and confirm you consent to your data being used as it describes.'
  }
  const version = notice?.PRIVACY_VERSION
  if (!version || !notice?.CONSENT_STATEMENT) {
    return 'The Privacy Notice is unavailable right now. Please try again shortly.'
  }
  const claimed = String(b.privacyNoticeVersion || '').trim()
  if (claimed && claimed !== version) {
    return 'The Privacy Notice has been updated since this page was opened. Please reload, read the current notice, and consent again.'
  }
  return null
}

function privacyConsentFragment(notice: { PRIVACY_VERSION?: string; CONSENT_STATEMENT?: string }) {
  return {
    privacyConsent: true,
    privacyNoticeVersion: notice.PRIVACY_VERSION,
    privacyConsentAt: new Date().toISOString(),
    privacyConsentStatement: notice.CONSENT_STATEMENT,
  }
}

export async function validateRegistration(req: AnyValue, body: Body) {
  const [noticeDoc, optionsDoc] = await Promise.all([
    getDocument(req, 'privacy-notice'),
    getDocument(req, 'registration-options'),
  ])
  const notice = noticeDoc?.body || null
  const opts = optionSets((optionsDoc?.body as RegistrationOptions) || {})
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

  const baseResult = baseSchema.safeParse(b)
  if (!baseResult.success) addIssues(baseResult.error, fields)

  const entityType = String(b.entityType || '').trim()
  const membershipTrack = String(b.membershipTrack || 'network').trim() || 'network'
  const membershipPolicyVersion = String(b.membershipPolicyVersion || '').trim()
  const password = String(b.password || '')

  // Agreements and privacy consent are validated in both entity branches —
  // any non-'organization' entity falls through to the individual path.
  const agreements = agreementFields(b, fields)
  let privacy: ReturnType<typeof privacyConsentFragment> | null = null
  const privacyError = privacyConsentError(b, notice)
  if (privacyError) fields.privacyConsent = privacyError
  else privacy = privacyConsentFragment(notice!)

  if (entityType === 'organization') {
    const orgSchema = z
      .object({
        email: strTrim(z.string().toLowerCase().regex(EMAIL_RE, 'Please enter a valid email.')),
        organizationName: strTrim(
          z
            .string()
            .min(1, 'Full legal name of the organisation is required.')
            .max(200, 'Organisation name is too long.'),
        ),
        isUnfcccAdmitted: yesNo().refine(
          (v) => v !== null,
          'Indicate whether this organisation is an admitted UNFCCC observer NGO.',
        ),
        orgMission: str(
          z
            .string()
            .trim()
            .refine(
              (v) => !v || wordCount(v) <= WORD_LIMIT,
              `Please keep the summary to ${WORD_LIMIT} words or fewer.`,
            ),
        ),
        orgOperateIn: strTrim(z.string()),
        orgWebsite: strOpt(),
        orgSocial: strOpt(),
        youthAffiliation: strOpt(),
        dcpName: strOpt(),
        dcpEmail: strEmailOpt(),
        dcpPhone: strOpt(),
        ycpName: strOpt(),
        ycpEmail: strEmailOpt(),
        ycpPhone: strOpt(),
        region: z.preprocess(() => String(b.region || b.orgRegion || '').trim(), z.string()),
        country: z.preprocess(() => String(b.orgCountry || b.country || '').trim(), z.string()),
      })
      .superRefine((v, ctx) => {
        if (v.isUnfcccAdmitted === true) {
          if (!allowed(opts.affiliations, v.youthAffiliation || '')) {
            issue(ctx, 'youthAffiliation', 'Indicate affiliation with “youth” within the UNFCCC.')
          }
          if (!allowed(opts.regions, v.region)) {
            issue(
              ctx,
              'region',
              'Select the UN region where the organisation is legally established.',
            )
          }
          if (!v.country) {
            issue(ctx, 'country', 'Country of legal establishment is required.')
          }
          if (!v.dcpName) {
            issue(ctx, 'dcpName', "UNFCCC DCP's full name is required.")
          }
          if (!EMAIL_RE.test(v.dcpEmail || '')) {
            issue(ctx, 'dcpEmail', "UNFCCC DCP's official email is required.")
          }
          if (!v.dcpPhone || !PHONE_RE.test(v.dcpPhone)) {
            issue(ctx, 'dcpPhone', "UNFCCC DCP's phone (with country code) is required.")
          }
          const ycpPartial = v.ycpName || v.ycpEmail || v.ycpPhone
          if (ycpPartial) {
            if (!v.ycpName) {
              issue(
                ctx,
                'ycpName',
                'YOUNGO Contact Point name is required if providing a contact point.',
              )
            }
            if (!EMAIL_RE.test(v.ycpEmail || '')) {
              issue(
                ctx,
                'ycpEmail',
                'YOUNGO Contact Point email is required if providing a contact point.',
              )
            }
            if (!v.ycpPhone || !PHONE_RE.test(v.ycpPhone)) {
              issue(
                ctx,
                'ycpPhone',
                'YOUNGO Contact Point phone is required if providing a contact point.',
              )
            }
          }
        } else if (v.isUnfcccAdmitted === false) {
          if (!v.orgOperateIn) {
            issue(ctx, 'orgOperateIn', 'Please describe regions/countries of operation.')
          }
          if (!v.ycpName) {
            issue(ctx, 'ycpName', "YOUNGO Contact Point's full name is required.")
          }
          if (!EMAIL_RE.test(v.ycpEmail || '')) {
            issue(ctx, 'ycpEmail', "YOUNGO Contact Point's email is required.")
          }
          if (!v.ycpPhone || !PHONE_RE.test(v.ycpPhone)) {
            issue(
              ctx,
              'ycpPhone',
              "YOUNGO Contact Point's phone is required if providing a contact point.",
            )
          }
        }
      })

    const parsed = orgSchema.safeParse(b)
    if (parsed.error) addIssues(parsed.error, fields)
    if (Object.keys(fields).length) return { fields }
    const v = parsed.data!

    const accountName = v.ycpName || v.dcpName || v.organizationName
    const nameParts = accountName.split(/\s+/)
    const firstName = nameParts[0] || v.organizationName
    const lastName = nameParts.slice(1).join(' ') || (v.isUnfcccAdmitted ? 'DCP' : 'Contact')

    return {
      data: {
        email: v.email,
        password,
        firstName,
        lastName,
        name: accountName,
        entityType: 'organization',
        membershipTrack,
        phone: v.ycpPhone || v.dcpPhone || '',
        gender: null,
        genderOther: null,
        ageBand: null,
        dateOfBirth: null,
        minorityGroups: [],
        minorityOther: null,
        region: v.region || null,
        nationality: null,
        country: v.country || '—',
        motivation: null,
        organizationName: v.organizationName,
        organizationType: v.isUnfcccAdmitted ? 'unfccc_admitted' : 'non_admitted',
        isUnfcccAdmitted: Boolean(v.isUnfcccAdmitted),
        youthAffiliation: v.isUnfcccAdmitted ? v.youthAffiliation : null,
        orgOperateIn: v.orgOperateIn || null,
        orgWebsite: v.orgWebsite,
        orgSocial: v.orgSocial,
        orgMission: v.orgMission || null,
        dcpName: v.isUnfcccAdmitted ? v.dcpName : null,
        dcpEmail: v.isUnfcccAdmitted ? v.dcpEmail : null,
        dcpPhone: v.isUnfcccAdmitted ? v.dcpPhone : null,
        ycpName: v.ycpName,
        ycpEmail: v.ycpEmail,
        ycpPhone: v.ycpPhone,
        under18: false,
        guardianName: null,
        guardianEmail: null,
        guardianConsent: false,
        ...agreements,
        ...privacy,
        coiDeclared: agreements.acceptCoiPolicy,
        coiDetails: null,
        policiesAccepted: true,
        memberOfAccreditedNgo: Boolean(v.isUnfcccAdmitted),
        membershipPolicyVersion,
        constituencyWorkStatus: 'pending_onboarding',
        memberStatus: 'pending_course',
        role: 'member',
        wgInterests: sanitizeWgInterests(b.wgInterests),
      },
    }
  }

  // Individual registration
  const indSchema = z
    .object({
      email: strTrim(
        z
          .string()
          .toLowerCase()
          .regex(EMAIL_RE, 'Please enter a valid email.')
          .max(160, 'Email is too long.'),
      ),
      firstName: strTrim(
        z.string().min(1, 'First name is required.').max(80, 'First name is too long.'),
      ),
      lastName: strTrim(
        z.string().min(1, 'Last name is required.').max(80, 'Last name is too long.'),
      ),
      phone: strTrim(
        z.string().regex(PHONE_RE, 'Enter a phone number with country code (e.g. +123 456 7890).'),
      ),
      gender: strTrim(
        z.string().refine((v) => allowed(opts.genders, v), 'Please select your gender.'),
      ),
      genderOther: strOpt(),
      ageBand: strTrim(
        z
          .string()
          .refine((v) => allowed(opts.ageBands, v), 'Please select your age group.')
          .refine(
            (v) => v !== '35_plus',
            'YOUNGO membership is for children and youth up to 35. Individual membership ends at 35.',
          ),
      ),
      dateOfBirth: strOpt().refine((v) => v !== null, 'Date of birth is required.'),
      minorityIdentity: yesNo().refine((v) => v !== null, 'Please answer yes or no.'),
      minorityGroups: strList(),
      minorityOther: strOpt(),
      region: strTrim(
        z.string().refine((v) => allowed(opts.regions, v), 'Please select your UN region.'),
      ),
      nationality: strTrim(
        z
          .string()
          .refine(
            (v) => allowed(opts.nationalities, v),
            'Please select a nationality from the list.',
          ),
      ),
      country: z.preprocess(
        () => String(b.countryOfResidence || b.country || '').trim(),
        z.string().min(1, 'Country of residence is required.'),
      ),
      motivation: strTrim(z.string().max(2000, 'Please keep this under 2000 characters.')),
      memberOfAccreditedNgo: yesNo().refine((v) => v !== null, 'Please answer for statistics.'),
      guardianName: strOpt(),
      guardianEmail: strEmailOpt(),
      guardianConsent: z.preprocess((v) => Boolean(v), z.boolean()),
    })
    .superRefine((v, ctx) => {
      if (v.gender === 'Other' && !v.genderOther) {
        issue(ctx, 'genderOther', 'Please specify.')
      }
      let under18 = v.ageBand === 'under_18'
      if (v.dateOfBirth) {
        const age = ageFromDob(v.dateOfBirth)
        if (age === null) {
          issue(ctx, 'dateOfBirth', 'Enter a valid date of birth.')
        } else if (age >= 35) {
          issue(ctx, 'dateOfBirth', 'Individual membership expires at age 35.')
        } else if (age < 18) under18 = true
      }
      if (opts.minorities.size) {
        if (v.minorityGroups.some((g) => !opts.minorities.has(g))) {
          issue(ctx, 'minorityGroups', 'Invalid minority group selection.')
        }
      }
      if (v.minorityIdentity === true && v.minorityGroups.length === 0) {
        issue(ctx, 'minorityGroups', 'Select at least one option.')
      }
      if (
        (v.minorityIdentity === false ? [] : v.minorityGroups).includes('Other') &&
        !v.minorityOther
      ) {
        issue(ctx, 'minorityOther', 'Please specify.')
      }
      if (under18) {
        if (!v.guardianName) {
          issue(ctx, 'guardianName', 'Guardian name is required for members under 18.')
        }
        if (!EMAIL_RE.test(v.guardianEmail || '')) {
          issue(ctx, 'guardianEmail', 'Guardian email is required for members under 18.')
        }
        if (!v.guardianConsent) {
          issue(ctx, 'guardianConsent', 'Guardian permission is required for members under 18.')
        }
      }
    })

  const parsed = indSchema.safeParse(b)
  if (!parsed.success) {
    addIssues(parsed.error, fields)
    return { fields }
  }
  if (Object.keys(fields).length) return { fields }
  const v = parsed.data

  const name = `${v.firstName} ${v.lastName}`.trim() || String(b.name || '').trim()
  const minorityGroups = v.minorityIdentity === false ? [] : v.minorityGroups
  let under18 = v.ageBand === 'under_18'
  if (v.dateOfBirth) {
    const age = ageFromDob(v.dateOfBirth)
    if (age !== null && age < 18) under18 = true
  }

  return {
    data: {
      email: v.email,
      password,
      firstName: v.firstName,
      lastName: v.lastName,
      name,
      entityType: 'individual',
      membershipTrack,
      phone: v.phone,
      gender: v.gender,
      genderOther: v.gender === 'Other' ? v.genderOther : null,
      ageBand: under18 ? 'under_18' : '18_35',
      dateOfBirth: v.dateOfBirth,
      minorityGroups,
      minorityOther: minorityGroups.includes('Other') ? v.minorityOther : null,
      region: v.region,
      nationality: v.nationality,
      country: v.country,
      motivation: v.motivation || null,
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
      guardianName: under18 ? v.guardianName : null,
      guardianEmail: under18 ? v.guardianEmail : null,
      guardianConsent: under18 ? v.guardianConsent : false,
      ...agreements,
      ...privacy,
      coiDeclared: agreements.acceptCoiPolicy,
      coiDetails: null,
      policiesAccepted: true,
      memberOfAccreditedNgo: v.memberOfAccreditedNgo,
      membershipPolicyVersion,
      constituencyWorkStatus: 'pending_onboarding',
      memberStatus: 'pending_course',
      role: 'member',
      wgInterests: sanitizeWgInterests(b.wgInterests),
    },
  }
}
