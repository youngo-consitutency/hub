import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { apiGet } from '../../lib/api'

/** The staff-edited registration-options document, as far as the sign-up forms read it. */
type RegistrationOptions = { nationalities?: string[] }

export const asOptions = (values: string[]) => values.map((value) => ({ value, label: value }))

// Registration option lists (regions, genders, nationalities, …) are
// staff-editable content in the `registration-options` document.
let registrationOptionsPromise: Promise<RegistrationOptions> | undefined
let nationalityOptionsPromise: Promise<{ value: string; label: string }[]> | undefined
let phoneSupportPromise: Promise<typeof import('../../lib/phone')> | null | undefined

function loadRegistrationOptions() {
  registrationOptionsPromise ||= apiGet<{ body?: RegistrationOptions }>(
    '/documents/registration-options',
  ).then((data) => data?.body || {})
  return registrationOptionsPromise
}

export function wordCount(value: string | null | undefined) {
  const text = String(value || '').trim()
  return text ? text.split(/\s+/).length : 0
}

export function loadPhoneSupport() {
  // Retry if a prior dynamic import failed (e.g. broken Vite HMR), otherwise
  // submit stays on "Submitting…" forever waiting on a rejected/stale promise.
  phoneSupportPromise ||= import('../../lib/phone').catch((error) => {
    phoneSupportPromise = null
    throw error
  })
  return phoneSupportPromise
}

export function loadNationalityOptions() {
  nationalityOptionsPromise ||= loadRegistrationOptions().then((options) =>
    (options.nationalities || []).map((nationality) => ({
      value: nationality,
      label: nationality,
    })),
  )
  return nationalityOptionsPromise
}

function browserPhoneCountry() {
  if (typeof navigator === 'undefined') return ''
  try {
    const locale = navigator.languages?.[0] || navigator.language
    return new Intl.Locale(locale).maximize().region || ''
  } catch {
    return ''
  }
}

const EMPTY_REGISTER = {
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
  minorityGroups: [] as string[],
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
  wgInterests: [] as string[],
}

export type RegistrationForm = typeof EMPTY_REGISTER
/** A registration field name (string keys only, so it can also index the error map). */
export type RegistrationField = Extract<keyof RegistrationForm, string>

export function initialRegistrationForm(): RegistrationForm {
  const country = browserPhoneCountry()
  return {
    ...EMPTY_REGISTER,
    phoneCountry: country,
    dcpPhoneCountry: country,
    ycpPhoneCountry: country,
  }
}

export function phoneInputValue(value: string | null | undefined) {
  return `+ ${String(value || '')
    .replaceAll('+', '')
    .trimStart()}`
}

export function fieldClass(err: string | null | undefined) {
  return err ? 'field hasError' : 'field'
}

export function checkClass(err: string | null | undefined) {
  return err ? 'authCheck hasError' : 'authCheck'
}

export function scrollToFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector(
      '.formAlert, .field.hasError, .authCheck.hasError, .fieldError',
    )
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    // the alert is announced by its role; a field error moves focus to the field itself
    const invalid = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    if (!document.querySelector('.formAlert')) invalid?.focus({ preventScroll: true })
  })
}

// same calendar-age rule the server applies at registration
export { ageFromDob } from '../../../shared/age'

/** The state and handlers AuthGate hands to the individual and organisation sign-up forms. */
export interface RegistrationFormProps {
  form: RegistrationForm
  fields: Record<string, string>
  countryOptions: { value: string; label: string }[]
  setForm: Dispatch<SetStateAction<RegistrationForm>>
  setReg: (
    field: RegistrationField,
  ) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  setChoice: <K extends RegistrationField>(
    field: K,
    errorKey?: string,
  ) => (value: RegistrationForm[K]) => void
  setPhone: (
    phoneKey: 'phone' | 'dcpPhone' | 'ycpPhone',
    countryKey: 'phoneCountry' | 'dcpPhoneCountry' | 'ycpPhoneCountry',
  ) => (event: ChangeEvent<HTMLInputElement>) => void
  toggleWg: (slug: string) => void
  ensureCountryOptions: () => Promise<void>
}
