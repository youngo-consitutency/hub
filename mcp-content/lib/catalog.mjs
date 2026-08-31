/**
 * Closed lists the content MCP advertises. Keep in sync with
 * shared/resourceHub.js, shared/contentValidation.js (EVENT_TYPES),
 * shared/workingGroups.js, and server/lib/opportunities.js. Isolated here so
 * the Railway HTTP service never imports Hub server modules or DATABASE_URL.
 */

export const EVENT_TYPES = Object.freeze([
  'constituency_call',
  'wg_call',
  'wgf',
  'unfccc_session',
  'webinar',
  'coordination',
])

export const WORKING_GROUPS = Object.freeze([
  { slug: 'ace', name: 'ACE' },
  { slug: 'finance', name: 'Finance & Markets' },
  { slug: 'adaptation', name: 'Adaptation' },
  { slug: 'loss-and-damage', name: 'Loss & Damage' },
  { slug: 'health', name: 'Health' },
  { slug: 'energy', name: 'Energy' },
  { slug: 'mitigation', name: 'Mitigation' },
  { slug: 'ndcs', name: 'NDCs' },
  { slug: 'oceans', name: 'Oceans' },
  { slug: 'agriculture', name: 'Food & Agriculture' },
  { slug: 'nature', name: 'Nature' },
  { slug: 'gender', name: 'Gender' },
  { slug: 'human-rights', name: 'Human Rights' },
  { slug: 'technology', name: 'Technology' },
  { slug: 'conflict-of-interest', name: 'Conflict of Interest' },
  { slug: 'coy', name: 'Conference of Youth' },
])

export const OPPORTUNITY_KINDS = [
  { value: 'event', label: 'Event' },
  { value: 'workshop', label: 'Online workshop' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'call', label: 'Open call' },
  { value: 'training', label: 'Training' },
]

export const OPPORTUNITY_FORMATS = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
]

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
