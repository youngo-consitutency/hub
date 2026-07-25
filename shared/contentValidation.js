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
const EVENT_TYPE_SET = new Set(EVENT_TYPES)
const DIRECTORY_GROUPS = new Set([
  'focal_points',
  'wg_contacts',
  'liaisons',
  'operations',
])
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

  validateUrls(content, '', errors)
  return errors
}

function cleanText(value) {
  return String(value || '').trim()
}

function validDate(value) {
  return Boolean(value) && Number.isFinite(new Date(value).getTime())
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

  if (!['event', 'announcement'].includes(contentType)) {
    return {
      ok: false,
      errors: { contentType: 'Choose events or announcements.' },
    }
  }
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
    errors.slug = 'Use 1–100 lowercase letters, numbers, and hyphens.'
  }
  if (title.length < 3 || title.length > 160) {
    errors.title = 'Enter a title between 3 and 160 characters.'
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
    if (!validDate(startsAt))
      errors.startsAt = 'Enter a valid start date and time.'
    if (!validDate(endsAt)) errors.endsAt = 'Enter a valid end date and time.'
    if (
      validDate(startsAt) &&
      validDate(endsAt) &&
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
        startsAt: validDate(startsAt)
          ? new Date(startsAt).toISOString()
          : startsAt,
        endsAt: validDate(endsAt) ? new Date(endsAt).toISOString() : endsAt,
        description: description || null,
        wg: wg || null,
        meetingUrl: meetingUrl || null,
        recordingUrl: recordingUrl || null,
      },
    }
  }

  const body = cleanText(payload.body)
  if (body.length < 10 || body.length > 4000) {
    errors.body = 'Enter announcement text between 10 and 4,000 characters.'
  }
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { slug, title, body, pinned: Boolean(payload.pinned) },
  }
}
