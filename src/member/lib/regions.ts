import type { AnyValue } from './types'
const REGION_ABBREVIATIONS = {
  global: 'GLO',
  africa: 'AFR',
  asia_pacific: 'AP',
  north_america: 'NA',
  apac: 'AP',
  'asia-pacific': 'AP',
  'asia pacific': 'AP',
  eca: 'ECA',
  europe: 'EUR',
  lac: 'LAC',
  'latin america': 'LAC',
  mena: 'MENA',
  'middle east and north africa': 'MENA',
  noram: 'NA',
  'north america': 'NA',
  oceania: 'OCE',
  pacific: 'PAC',
  weog: 'WEOG',
}

export function regionAbbreviation(value: AnyValue) {
  const normalized = regionKey(value)
  if (!normalized) return ''
  if ((REGION_ABBREVIATIONS as AnyValue)[normalized]) {
    return (REGION_ABBREVIATIONS as AnyValue)[normalized]
  }

  const words = normalized.split(/[\s–—-]+/).filter(Boolean)
  if (words.length > 1) {
    return words
      .map((word: AnyValue) => word[0])
      .join('')
      .slice(0, 4)
      .toLocaleUpperCase()
  }
  return normalized.slice(0, 3).toLocaleUpperCase()
}

export function regionFilterPrefix(value: AnyValue, label = value) {
  const abbreviation = regionAbbreviation(value)
  return abbreviation ===
    String(label || '')
      .trim()
      .toLocaleUpperCase()
    ? ''
    : abbreviation
}

const REGION_NAMES = {
  global: 'Global',
  africa: 'Africa',
  asia_pacific: 'Asia-Pacific',
  eca: 'Europe & Central Asia',
  europe: 'Europe',
  lac: 'Latin America & the Caribbean',
  mena: 'Middle East & North Africa',
  north_america: 'North America',
  oceania: 'Oceania',
  pacific: 'Pacific',
  weog: 'Western Europe & Others',
}
const REGION_ALIASES = {
  apac: 'asia_pacific',
  'asia pacific': 'asia_pacific',
  'europe & central asia': 'eca',
  'europe and central asia': 'eca',
  'latin america': 'lac',
  'latin america & the caribbean': 'lac',
  'latin america & caribbean': 'lac',
  'latin america and the caribbean': 'lac',
  'middle east & north africa': 'mena',
  'middle east and north africa': 'mena',
  noram: 'north_america',
  'north america': 'north_america',
  'western europe & others': 'weog',
}

export function regionKey(value: AnyValue) {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
  return (REGION_ALIASES as AnyValue)[key] || key
}

export function regionLabel(value: AnyValue) {
  const key = regionKey(value)
  return (
    (REGION_NAMES as AnyValue)[key] ||
    String(value || '')
      .trim()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
  )
}
