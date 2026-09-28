import {
  canonicalResourceUrl,
  RESOURCE_LANGUAGES,
  RESOURCE_PATHWAYS,
  RESOURCE_REGIONS,
  RESOURCE_TOPICS,
  RESOURCE_TYPES,
} from './resourceHub.js'

export const EVENT_TYPES = Object.freeze([
  'constituency_call',
  'wg_call',
  'wgf',
  'unfccc_session',
  'webinar',
  'coordination',
])
export const LIVE_CONTENT_TYPES = Object.freeze(['event', 'announcement'])
export const EVENT_PATCH_FIELDS = Object.freeze([
  'title',
  'type',
  'startsAt',
  'endsAt',
  'description',
  'wg',
  'meetingUrl',
  'recordingUrl',
])
export const ANNOUNCEMENT_PATCH_FIELDS = Object.freeze([
  'title',
  'body',
  'pinned',
  'ctaUrl',
  'ctaLabel',
  'ctaDeadlineAt',
])
const EVENT_TYPE_SET = new Set(EVENT_TYPES)
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isWebUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function cleanText(value) {
  return String(value || '').trim()
}

export function isIsoDateTime(value) {
  const text = cleanText(value)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
      text,
    )
  ) {
    return false
  }
  return Number.isFinite(new Date(text).getTime())
}

export function normalizeWorkingGroupRef(wg) {
  if (wg == null || wg === '') return ''
  if (typeof wg === 'object' && !Array.isArray(wg)) return cleanText(wg.slug)
  return cleanText(wg)
}

export function validateEditableContent(
  contentType,
  input,
  { groupSlugs = [] } = {},
) {
  const errors = {}
  const payload =
    input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const slug = cleanText(payload.slug).toLowerCase()
  const title = cleanText(payload.title)

  if (!['event', 'announcement', 'resource'].includes(contentType)) {
    return {
      ok: false,
      errors: { contentType: 'Choose events, announcements, or resources.' },
    }
  }
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
    errors.slug = 'Use 1–100 lowercase letters, numbers, and hyphens.'
  }
  if (title.length < 3 || title.length > 160) {
    errors.title = 'Enter a title between 3 and 160 characters.'
  }

  if (contentType === 'resource') {
    const url = cleanText(payload.url)
    const summary = cleanText(payload.summary)
    const publisher = cleanText(payload.publisher)
    const pathway = cleanText(payload.pathway)
    const type = cleanText(payload.type)
    const topic = cleanText(payload.topic)
    const topics = payload.topics === undefined ? [topic] : payload.topics
    const region = cleanText(payload.region) || 'global'
    const language = cleanText(payload.language) || 'English'
    const pathwayValues = new Set(RESOURCE_PATHWAYS.map((item) => item.value))
    const typeValues = new Set(RESOURCE_TYPES.map((item) => item.value))
    const regionValues = new Set(RESOURCE_REGIONS.map((item) => item.value))

    try {
      canonicalResourceUrl(url)
    } catch {
      errors.url = 'Enter a public http:// or https:// URL without credentials.'
    }
    if (summary.length < 20 || summary.length > 600) {
      errors.summary = 'Enter a summary between 20 and 600 characters.'
    }
    if (publisher.length > 120)
      errors.publisher = 'Publisher must be 120 characters or fewer.'
    if (!pathwayValues.has(pathway)) errors.pathway = 'Choose a pathway.'
    if (!typeValues.has(type)) errors.type = 'Choose a resource type.'
    if (!RESOURCE_TOPICS.includes(topic)) errors.topic = 'Choose a topic.'
    if (
      !Array.isArray(topics) ||
      topics.length < 1 ||
      topics.length > 5 ||
      new Set([topic, ...topics]).size > 5 ||
      topics.some((t) => !RESOURCE_TOPICS.includes(t))
    )
      errors.topics = 'Choose one to five recognised topic tags.'
    if (!regionValues.has(region)) errors.region = 'Choose a region.'
    if (!RESOURCE_LANGUAGES.includes(language))
      errors.language = 'Choose a language.'

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      value: {
        slug,
        title,
        url,
        summary,
        publisher: publisher || null,
        pathway,
        type,
        topic,
        topics: Array.isArray(topics)
          ? [...new Set([topic, ...topics])]
          : [topic],
        region,
        language,
      },
    }
  }

  if (contentType === 'event') {
    const startsAt = cleanText(payload.startsAt)
    const endsAt = cleanText(payload.endsAt)
    const type = cleanText(payload.type)
    const description = cleanText(payload.description)
    const wg = cleanText(payload.wg)
    const meetingUrl = cleanText(payload.meetingUrl)
    const recordingUrl = cleanText(payload.recordingUrl)

    if (!EVENT_TYPE_SET.has(type))
      errors.type = 'Choose a supported event type.'
    if (!isIsoDateTime(startsAt))
      errors.startsAt = 'Enter a valid ISO start date and time.'
    if (!isIsoDateTime(endsAt))
      errors.endsAt = 'Enter a valid ISO end date and time.'
    if (
      isIsoDateTime(startsAt) &&
      isIsoDateTime(endsAt) &&
      new Date(endsAt) <= new Date(startsAt)
    ) {
      errors.endsAt = 'End time must be after the start time.'
    }
    if (description.length > 2000)
      errors.description = 'Description must be 2,000 characters or fewer.'
    if (wg && !new Set(groupSlugs).has(wg))
      errors.wg = 'Choose an existing working group.'
    if (meetingUrl && !isWebUrl(meetingUrl))
      errors.meetingUrl = 'Enter a full http:// or https:// URL.'
    if (recordingUrl && !isWebUrl(recordingUrl))
      errors.recordingUrl = 'Enter a full http:// or https:// URL.'

    return {
      ok: Object.keys(errors).length === 0,
      errors,
      value: {
        slug,
        title,
        type,
        startsAt: isIsoDateTime(startsAt)
          ? new Date(startsAt).toISOString()
          : startsAt,
        endsAt: isIsoDateTime(endsAt) ? new Date(endsAt).toISOString() : endsAt,
        description: description || null,
        wg: wg || null,
        meetingUrl: meetingUrl || null,
        recordingUrl: recordingUrl || null,
      },
    }
  }

  const body = cleanText(payload.body)
  const ctaUrl = cleanText(payload.ctaUrl)
  const ctaLabel = cleanText(payload.ctaLabel)
  const ctaDeadlineAt = cleanText(payload.ctaDeadlineAt)
  if (body.length < 10 || body.length > 4000) {
    errors.body = 'Enter announcement text between 10 and 4,000 characters.'
  }
  if (ctaUrl && !isWebUrl(ctaUrl)) {
    errors.ctaUrl = 'Enter a full http:// or https:// URL.'
  }
  if (ctaLabel.length > 80) {
    errors.ctaLabel = 'CTA label must be 80 characters or fewer.'
  }
  if (ctaUrl && !ctaLabel) {
    errors.ctaLabel = 'Add a label for the call-to-action button.'
  }
  if (ctaDeadlineAt && !isIsoDateTime(ctaDeadlineAt)) {
    errors.ctaDeadlineAt = 'Enter a valid ISO deadline date and time.'
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      slug,
      title,
      body,
      pinned: Boolean(payload.pinned),
      ctaUrl: ctaUrl || null,
      ctaLabel: ctaLabel || null,
      ctaDeadlineAt: isIsoDateTime(ctaDeadlineAt)
        ? new Date(ctaDeadlineAt).toISOString()
        : null,
    },
  }
}
