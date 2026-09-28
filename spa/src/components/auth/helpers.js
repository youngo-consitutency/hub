import {
  GENDERS,
  MINORITY_OPTIONS,
  REGIONS,
} from '../../../shared/registration.js'

export const asOptions = (values) =>
  values.map((value) => ({ value, label: value }))

export const REGION_OPTIONS = asOptions(REGIONS)
export const GENDER_OPTIONS = asOptions(GENDERS)
export const MINORITY_SELECT_OPTIONS = asOptions(MINORITY_OPTIONS)
let phoneSupportPromise
let nationalityOptionsPromise

export function loadPhoneSupport() {
  // Retry if a prior dynamic import failed (e.g. broken Vite HMR), otherwise
  // submit stays on "Submitting…" forever waiting on a rejected/stale promise.
  phoneSupportPromise ||= import('../../lib/phone.js').catch((error) => {
    phoneSupportPromise = null
    throw error
  })
  return phoneSupportPromise
}

export function loadNationalityOptions() {
  nationalityOptionsPromise ||= import('../../../shared/nationalities.js').then(
    ({ NATIONALITIES }) =>
      NATIONALITIES.map((nationality) => ({
        value: nationality,
        label: nationality,
      })),
  )
  return nationalityOptionsPromise
}

export function browserPhoneCountry() {
  if (typeof navigator === 'undefined') return ''
  try {
    const locale = navigator.languages?.[0] || navigator.language
    return new Intl.Locale(locale).maximize().region || ''
  } catch {
    return ''
  }
}

export const EMPTY_REGISTER = {
  email: '',
  password: '',
  passwordConfirm: '',
  entityType: 'individual',
  // individual
  ageBand: '',
  firstName: '',
  lastName: '',
  phone: '+ ',
  phoneCountry: '',
  gender: '',
  genderOther: '',
  dateOfBirth: '',
  minorityIdentity: '',
  minorityGroups: [],
  minorityOther: '',
  region: '',
  nationality: '',
  countryOfResidence: '',
  motivation: '',
  memberOfAccreditedNgo: '',
  guardianName: '',
  guardianEmail: '',
  guardianConsent: false,
  acceptCodeOfConduct: false,
  acceptDataProtection: false,
  acceptPrinciples: false,
  acceptCoiPolicy: false,
  privacyConsent: false,
  // organisation
  organizationName: '',
  isUnfcccAdmitted: '', // 'yes' | 'no'
  youthAffiliation: '', // primary | secondary | no
  orgCountry: '',
  orgOperateIn: '',
  orgWebsite: '',
  orgSocial: '',
  orgMission: '',
  dcpName: '',
  dcpEmail: '',
  dcpPhone: '+ ',
  dcpPhoneCountry: '',
  ycpName: '',
  ycpEmail: '',
  ycpPhone: '+ ',
  ycpPhoneCountry: '',
  acceptAllOrgPolicies: false,
  membershipTrack: 'network',
  wgInterests: [],
}

export function initialRegistrationForm() {
  const country = browserPhoneCountry()
  return {
    ...EMPTY_REGISTER,
    phoneCountry: country,
    dcpPhoneCountry: country,
    ycpPhoneCountry: country,
  }
}

export function phoneInputValue(value) {
  return `+ ${String(value || '')
    .replaceAll('+', '')
    .trimStart()}`
}

export function fieldClass(err) {
  return err ? 'field hasError' : 'field'
}

export function checkClass(err) {
  return err ? 'authCheck hasError' : 'authCheck'
}

export function scrollToFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector(
      '.formAlert, .field.hasError, .authCheck.hasError, .fieldError',
    )
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

export function ageFromDob(dob) {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age
}
