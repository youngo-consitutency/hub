import type { AnyValue } from './types'
import { AsYouType, getCountries, parsePhoneNumberFromString } from 'libphonenumber-js/min'

function displayNameForCountry(countryCode: AnyValue) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode
  } catch {
    return countryCode
  }
}

export function getCountryOptions() {
  return getCountries()
    .map((countryCode) => ({
      value: displayNameForCountry(countryCode),
      label: displayNameForCountry(countryCode),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

export function formatPhoneWhileTyping(value: AnyValue, countryCode: AnyValue) {
  const supplied = String(value || '')
  if (!supplied.replaceAll('+', '').trim()) return '+ '

  const international = supplied.trimStart().startsWith('+')
  const raw = international ? `+${supplied.replaceAll('+', '').trimStart()}` : supplied
  const formatted = new AsYouType(international ? undefined : countryCode || undefined).input(raw)
  return international ? `+ ${formatted.slice(1).trimStart()}` : formatted
}

export function normalizePhone(value: AnyValue, countryCode: AnyValue) {
  const raw = String(value || '').trim()
  if (!raw || !/\d/.test(raw)) return ''

  const parsed = parsePhoneNumberFromString(raw, countryCode || undefined)
  return parsed?.isValid() ? parsed.number : raw
}
