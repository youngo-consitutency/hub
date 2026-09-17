import {
  canonicalResourceUrl,
  RESOURCE_LANGUAGES,
  RESOURCE_PATHWAYS,
  RESOURCE_REGIONS,
  RESOURCE_TOPICS,
  RESOURCE_TYPES,
} from './resourceHub.js'

const REQUIRED_LISTS = [
  'groups',
  'events',
  'submissions',
  'council',
  'coys',
  'announcements',
  'directory',
]
const SLUG_LISTS = [
  'groups',
  'events',
  'submissions',
  'council',
  'coys',
  'announcements',
]
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
const DIRECTORY_GROUPS = new Set([
  'focal_points',
  'wg_contacts',
  'liaisons',
  'operations',
])
const OPPORTUNITY_KINDS = new Set([
  'event',
  'workshop',
  'hackathon',
  'opportunity',
  'call',
  'training',
])
const OPPORTUNITY_FORMATS = new Set(['online', 'in_person', 'hybrid'])
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isWebUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validateUrls(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateUrls(item, `${path}[${index}]`, errors),
    )
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, item] of Object.entries(value)) {
    const itemPath = path ? `${path}.${key}` : key
    if (key.endsWith('Url') && item != null && item !== '' && !isWebUrl(item)) {
      errors.push(`${itemPath} must be a full http:// or https:// URL`)
    } else {
      validateUrls(item, itemPath, errors)
    }
  }
}

export function validateContent(content) {
  const errors = []
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return ['The content file must contain one JSON object.']
  }

  for (const key of REQUIRED_LISTS) {
    if (!Array.isArray(content[key])) errors.push(`${key} must be a list`)
  }
  if (errors.length > 0) return errors

  for (const key of SLUG_LISTS) {
    const seen = new Set()
    content[key].forEach((item, index) => {
      const slug = String(item?.slug || '').trim()
      if (!slug) {
        errors.push(`${key}[${index}].slug is required`)
      } else if (seen.has(slug)) {
        errors.push(`${key} contains the duplicate slug "${slug}"`)
      }
      seen.add(slug)
    })
  }

  const groupSlugs = new Set(content.groups.map((group) => group.slug))
  content.groups.forEach((group, index) => {
    if (!Array.isArray(group.tags) || group.tags.length === 0) {
      errors.push(`groups[${index}].tags must contain at least one topic`)
      return
    }
    const tags = group.tags.map((tag) => String(tag || '').trim())
    if (tags.some((tag) => !tag || tag.length > 40)) {
      errors.push(`groups[${index}].tags must be 1–40 characters each`)
    }
    if (
      new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length
    ) {
      errors.push(`groups[${index}].tags must not contain duplicates`)
    }
  })
  content.events.forEach((event, index) => {
    if (!String(event.title || '').trim())
      errors.push(`events[${index}].title is required`)
    if (!EVENT_TYPE_SET.has(event.type))
      errors.push(`events[${index}].type "${event.type}" is not supported`)
    if (event.wg && !groupSlugs.has(event.wg))
      errors.push(
        `events[${index}].wg "${event.wg}" does not match a group slug`,
      )
  })
  content.submissions.forEach((submission, index) => {
    if (submission.wg && !groupSlugs.has(submission.wg)) {
      errors.push(
        `submissions[${index}].wg "${submission.wg}" does not match a group slug`,
      )
    }
  })
  content.directory.forEach((contact, index) => {
    if (!DIRECTORY_GROUPS.has(contact.group)) {
      errors.push(
        `directory[${index}].group "${contact.group}" is not supported`,
      )
    }
    if (!String(contact.roleTitle || '').trim())
      errors.push(`directory[${index}].roleTitle is required`)
    if (!String(contact.description || '').trim())
      errors.push(`directory[${index}].description is required`)
  })

  // Optional board feed: shared / channel opportunities (not WG-inherent work).
  if (content.opportunities != null) {
    if (!Array.isArray(content.opportunities)) {
      errors.push('opportunities must be a list')
    } else {
      const seenOpp = new Set()
      content.opportunities.forEach((item, index) => {
        const slug = String(item?.slug || '').trim()
        if (!slug) {
          errors.push(`opportunities[${index}].slug is required`)
        } else if (seenOpp.has(slug)) {
          errors.push(`opportunities contains the duplicate slug "${slug}"`)
        } else if (!SLUG_PATTERN.test(slug)) {
          errors.push(`opportunities[${index}].slug is not a valid slug`)
        } else {
          seenOpp.add(slug)
        }
        if (!String(item?.title || '').trim()) {
          errors.push(`opportunities[${index}].title is required`)
        }
        if (!OPPORTUNITY_KINDS.has(item?.kind)) {
          errors.push(
            `opportunities[${index}].kind "${item?.kind}" is not supported`,
          )
        }
        const format = item?.format || 'online'
        if (!OPPORTUNITY_FORMATS.has(format)) {
          errors.push(
            `opportunities[${index}].format "${format}" is not supported`,
          )
        }
      })
    }
  }

  validateUrls(content, '', errors)
  return errors
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
