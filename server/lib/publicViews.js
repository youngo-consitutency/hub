import { isPublicGroupResource } from '../../shared/resourceCategories.js'

// A conferencing *join* link is a credential: anyone holding one can walk into
// a YOUNGO call. Deleting the `meetingUrl` field is not enough — the same link
// is repeated in prose descriptions and in working-group resource lists, and
// both are rendered into the anonymous ICS feed and the public JSON API.
//
// Registration pages (Zoom `/meeting/register`, Teams event pages) are the
// opposite: they are published deliberately so newcomers can sign up. Match on
// the join-link shape rather than the host so those survive.
const JOIN_LINK_PATTERNS = [
  /^meet\.google\.com$/,
  /^meet\.jit\.si$/,
  /^(www\.)?whereby\.com$/,
]

function isMeetingJoinLink(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  const path = url.pathname
  if (JOIN_LINK_PATTERNS.some((pattern) => pattern.test(host))) {
    return path.length > 1
  }
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) {
    return /^\/(j|w|my|s)\//.test(path)
  }
  if (host === 'teams.microsoft.com' || host === 'teams.live.com') {
    return path.includes('/l/meetup-join') || path.includes('/meet/')
  }
  if (host.endsWith('webex.com')) {
    return path.includes('/meet/') || path.includes('/join/')
  }
  return false
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi

/** Replace join links in free text with a placeholder, leaving other links. */
export function redactMeetingLinks(text) {
  if (typeof text !== 'string' || !text) return text
  return text.replace(URL_PATTERN, (match) => {
    // Sentence punctuation belongs to the prose, not to the URL.
    const trailing = match.match(/[.,;:]+$/)?.[0] || ''
    const url = trailing ? match.slice(0, -trailing.length) : match
    return isMeetingJoinLink(url) ? `(members-only link)${trailing}` : match
  })
}

/** Keep public media open while member workspace material stays source-gated. */
function resourceViews(
  resources,
  { includePrivate = false, includeWorkspace = false } = {},
) {
  if (!Array.isArray(resources)) return resources
  return resources
    .filter((resource) => includeWorkspace || isPublicGroupResource(resource))
    .filter(
      (resource) => includeWorkspace || !isMeetingJoinLink(resource?.url || ''),
    )
    .map((resource) =>
      includePrivate
        ? { ...resource }
        : {
            ...resource,
            description: redactMeetingLinks(resource?.description),
          },
    )
}

function contactView(contact, { includePrivate = false } = {}) {
  if (!contact) return contact
  if (includePrivate) return { ...contact }
  const publicContact = { ...contact }
  delete publicContact.personName
  delete publicContact.channelValue
  return publicContact
}

export function eventView(event, { includePrivate = false } = {}) {
  if (!event) return event
  if (includePrivate) return { ...event }
  const publicEvent = { ...event }
  delete publicEvent.meetingUrl
  publicEvent.description = redactMeetingLinks(publicEvent.description)
  return publicEvent
}

export function groupView(
  group,
  { includePrivate = false, includeWorkspace = false } = {},
) {
  if (!group) return group
  const publicSpace = Boolean(group.publicSpace)
  const result = {
    ...group,
    publicSpace,
    ...(Array.isArray(group.events)
      ? {
          events: group.events.map((event) =>
            eventView(event, { includePrivate }),
          ),
        }
      : {}),
    ...(group.contact
      ? { contact: contactView(group.contact, { includePrivate }) }
      : {}),
  }
  const publicGroup = { ...result }
  if (!includeWorkspace) {
    delete publicGroup.whatsappUrl
    delete publicGroup.groupUrl
    delete publicGroup.driveUrl
  }
  if (!includePrivate) {
    publicGroup.description = redactMeetingLinks(publicGroup.description)
    if (!publicSpace) {
      delete publicGroup.focusLine
      delete publicGroup.cadenceNote
      delete publicGroup.events
      delete publicGroup.submissions
      delete publicGroup.contact
      delete publicGroup.resources
      delete publicGroup.taskForces
      publicGroup.workspaceResourcesLocked = true
    }
  }
  if (Array.isArray(publicGroup.resources)) {
    publicGroup.workspaceResourcesLocked =
      !includeWorkspace &&
      publicGroup.resources.some((resource) => !isPublicGroupResource(resource))
    publicGroup.resources = resourceViews(publicGroup.resources, {
      includePrivate,
      includeWorkspace,
    })
  }
  return publicGroup
}

export function feedView(feed, { includePrivate = false } = {}) {
  if (!feed) return feed
  return {
    ...feed,
    live: eventView(feed.live, { includePrivate }),
    week: (feed.week || []).map((event) =>
      eventView(event, { includePrivate }),
    ),
  }
}

export function searchView(results, { includePrivate = false } = {}) {
  if (!results) return results
  return {
    ...results,
    events: (results.events || []).map((event) =>
      eventView(event, { includePrivate }),
    ),
    groups: (results.groups || []).map((group) =>
      groupView(group, { includePrivate }),
    ),
    contacts: (results.contacts || []).map((contact) =>
      contactView(contact, { includePrivate }),
    ),
  }
}

export function directoryView(items, { includePrivate = false } = {}) {
  return (items || []).map((contact) =>
    contactView(contact, { includePrivate }),
  )
}
