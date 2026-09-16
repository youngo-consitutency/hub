export const RESOURCE_PATHWAYS = Object.freeze([
  {
    value: 'career',
    label: 'Career',
    description: 'Jobs, teams, and pathways into climate work.',
  },
  {
    value: 'research',
    label: 'Research',
    description: 'Data, models, policy tools, and open science.',
  },
  {
    value: 'education',
    label: 'Education',
    description: 'Courses, explainers, teaching resources, and communities.',
  },
  {
    value: 'investment',
    label: 'Funding',
    description: 'Funds and organisations backing climate solutions.',
  },
])

export const RESOURCE_TYPES = Object.freeze([
  { value: 'guide', label: 'Guide' },
  { value: 'report', label: 'Report' },
  { value: 'toolkit', label: 'Toolkit' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'course', label: 'Course' },
  { value: 'article', label: 'Article' },
  { value: 'video', label: 'Video' },
  { value: 'platform', label: 'Platform' },
  { value: 'opportunity', label: 'Opportunity' },
])

export const RESOURCE_TOPICS = Object.freeze([
  'Climate basics',
  'Policy',
  'Data and monitoring',
  'Technology',
  'Energy',
  'Adaptation',
  'Mitigation',
  'Loss and damage',
  'Climate finance',
  'Nature and food',
  'Water and oceans',
  'Health',
  'Gender and rights',
  'Youth and community',
])

export const RESOURCE_REGIONS = Object.freeze([
  { value: 'global', label: 'Global' },
  { value: 'africa', label: 'Africa' },
  { value: 'asia_pacific', label: 'Asia-Pacific' },
  { value: 'eca', label: 'Europe & Central Asia' },
  { value: 'lac', label: 'Latin America & Caribbean' },
  { value: 'mena', label: 'Middle East & North Africa' },
  { value: 'north_america', label: 'North America' },
  { value: 'weog', label: 'Western Europe & Others' },
])

export const RESOURCE_LANGUAGES = Object.freeze([
  'English',
  'Arabic',
  'Chinese',
  'French',
  'Russian',
  'Spanish',
  'Other',
])

export function resourceLabel(items, value) {
  return items.find((item) => item.value === value)?.label || value
}

// Keep meaningful queries/fragments, remove only known tracking parameters.
export function canonicalResourceUrl(value) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error('Use a public HTTP or HTTPS link without credentials.')
  for (const key of [...url.searchParams.keys()])
    if (/^utm_/i.test(key) || ['fbclid', 'gclid'].includes(key))
      url.searchParams.delete(key)
  url.searchParams.sort()
  return url.href
}

export const RESOURCE_ISSUE_KINDS = Object.freeze([
  { value: 'broken', label: 'Broken or inaccessible link' },
  { value: 'outdated', label: 'Outdated information' },
  { value: 'tags', label: 'Incorrect description or tags' },
  { value: 'duplicate', label: 'Duplicate resource' },
  { value: 'other', label: 'Other concern' },
])
