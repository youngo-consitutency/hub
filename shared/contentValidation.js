const REQUIRED_LISTS = ['groups', 'events', 'submissions', 'council', 'coys', 'announcements', 'directory']
const SLUG_LISTS = ['groups', 'events', 'submissions', 'council', 'coys']
const EVENT_TYPES = new Set([
  'constituency_call',
  'wg_call',
  'wgf',
  'unfccc_session',
  'webinar',
  'coordination',
])
const DIRECTORY_GROUPS = new Set(['focal_points', 'wg_contacts', 'liaisons', 'operations'])

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
    value.forEach((item, index) => validateUrls(item, `${path}[${index}]`, errors))
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
    if (!String(event.title || '').trim()) errors.push(`events[${index}].title is required`)
    if (!EVENT_TYPES.has(event.type)) errors.push(`events[${index}].type "${event.type}" is not supported`)
    if (event.wg && !groupSlugs.has(event.wg)) errors.push(`events[${index}].wg "${event.wg}" does not match a group slug`)
  })
  content.submissions.forEach((submission, index) => {
    if (submission.wg && !groupSlugs.has(submission.wg)) {
      errors.push(`submissions[${index}].wg "${submission.wg}" does not match a group slug`)
    }
  })
  content.directory.forEach((contact, index) => {
    if (!DIRECTORY_GROUPS.has(contact.group)) {
      errors.push(`directory[${index}].group "${contact.group}" is not supported`)
    }
    if (!String(contact.roleTitle || '').trim()) errors.push(`directory[${index}].roleTitle is required`)
    if (!String(contact.description || '').trim()) errors.push(`directory[${index}].description is required`)
  })

  validateUrls(content, '', errors)
  return errors
}
