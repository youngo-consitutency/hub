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

export function wordCount(value) {
  const text = String(value || '').trim()
  return text ? text.split(/\s+/).length : 0
}
