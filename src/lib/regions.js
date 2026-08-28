const REGION_ABBREVIATIONS = {
  africa: 'AFR',
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

export function regionAbbreviation(value) {
  const normalized = String(value || '')
    .trim()
    .toLocaleLowerCase()
  if (!normalized) return ''
  if (REGION_ABBREVIATIONS[normalized]) {
    return REGION_ABBREVIATIONS[normalized]
  }

  const words = normalized.split(/[\s–—-]+/).filter(Boolean)
  if (words.length > 1) {
    return words
      .map((word) => word[0])
      .join('')
      .slice(0, 4)
      .toLocaleUpperCase()
  }
  return normalized.slice(0, 3).toLocaleUpperCase()
}

export function regionFilterPrefix(value, label = value) {
  const abbreviation = regionAbbreviation(value)
  return abbreviation ===
    String(label || '')
      .trim()
      .toLocaleUpperCase()
    ? ''
    : abbreviation
}
