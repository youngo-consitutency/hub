import {
  AsYouType,
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/min'

function displayNameForCountry(countryCode: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode
  } catch {
    return countryCode
  }
}

// Boundary: callers hold the ISO code as a plain string; libphonenumber rejects unknown ones itself
const asCountry = (code: string | null | undefined) =>
  (code || undefined) as CountryCode | undefined

export function getCountryOptions() {
  return getCountries()
    .map((countryCode) => ({
      value: displayNameForCountry(countryCode),
      label: displayNameForCountry(countryCode),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function formatPhoneWhileTyping(value: unknown, countryCode: string | null | undefined) {
  const supplied = String(value || '')
  if (!supplied.replaceAll('+', '').trim()) return '+ '

  const international = supplied.trimStart().startsWith('+')
  const raw = international ? `+${supplied.replaceAll('+', '').trimStart()}` : supplied
  const formatted = new AsYouType(international ? undefined : asCountry(countryCode)).input(raw)
  return international ? `+ ${formatted.slice(1).trimStart()}` : formatted
}

export function normalizePhone(value: unknown, countryCode: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw || !/\d/.test(raw)) return ''

  const parsed = parsePhoneNumberFromString(raw, asCountry(countryCode))
  return parsed?.isValid() ? parsed.number : raw
}
