// Port of server/lib/publicViews.js — public/member view policy.
// A conferencing *join* link is a credential: join links are stripped from
// anonymous payloads while deliberate registration pages survive.

const JOIN_LINK_PATTERNS = [/^meet\.google\.com$/, /^meet\.jit\.si$/, /^(www\.)?whereby\.com$/]

function isMeetingJoinLink(value: string): boolean {
  let url: URL
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
  if (host === 'webex.com' || host.endsWith('.webex.com')) {
    return path.includes('/meet/') || path.includes('/join/')
  }
  return false
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi

/** Replace join links in free text with a placeholder, leaving other links. */
function redactMeetingLinks(text: unknown): unknown {
  if (typeof text !== 'string' || !text) return text
  return text.replace(URL_PATTERN, (match) => {
    const trailing = match.match(/[.,;:]+$/)?.[0] || ''
    const url = trailing ? match.slice(0, -trailing.length) : match
    return isMeetingJoinLink(url) ? `(members-only link)${trailing}` : match
  })
}

// A working-group resource is public when it does not carry an explicit
// members-only visibility flag.
function isPublicGroupResource(resource: Record<string, unknown>): boolean {
  const visibility = String(resource?.visibility || 'public')
  return visibility !== 'members' && visibility !== 'private'
}

function resourceViews(
  resources: unknown,
  { includePrivate = false, includeWorkspace = false } = {},
) {
  if (!Array.isArray(resources)) return resources
  return resources
    .filter((resource) => includeWorkspace || isPublicGroupResource(resource))
    .filter((resource) => includeWorkspace || !isMeetingJoinLink(resource?.url || ''))
    .map((resource) =>
      includePrivate
        ? { ...resource }
        : {
            ...resource,
            description: redactMeetingLinks(resource?.description),
          },
    )
}

function contactView(
  contact: Record<string, unknown> | null | undefined,
  { includePrivate = false } = {},
) {
  if (!contact) return contact
  if (includePrivate) return { ...contact }
  const publicContact: Record<string, unknown> = { ...contact }
  delete publicContact.personName
  delete publicContact.channelValue
  return publicContact
}

export function eventView(
  event: Record<string, unknown> | null | undefined,
  { includePrivate = false } = {},
) {
  if (!event) return event
  if (includePrivate) return { ...event }
  const publicEvent: Record<string, unknown> = { ...event }
  delete publicEvent.meetingUrl
  publicEvent.description = redactMeetingLinks(publicEvent.description)
  return publicEvent
}

export function groupView(
  group: Record<string, unknown> | null | undefined,
  { includePrivate = false, includeWorkspace = false } = {},
) {
  if (!group) return group
  const publicSpace = Boolean(group.publicSpace)
  const result: Record<string, unknown> = {
    ...group,
    publicSpace,
    ...(Array.isArray(group.events)
      ? {
          events: (group.events as Record<string, unknown>[]).map((event) =>
            eventView(event, { includePrivate }),
          ),
        }
      : {}),
    ...(group.contact
      ? {
          contact: contactView(group.contact as Record<string, unknown>, {
            includePrivate,
          }),
        }
      : {}),
  }
  const publicGroup: Record<string, unknown> = { ...result }
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
      (publicGroup.resources as Record<string, unknown>[]).some(
        (resource) => !isPublicGroupResource(resource),
      )
    publicGroup.resources = resourceViews(publicGroup.resources, {
      includePrivate,
      includeWorkspace,
    })
  }
  return publicGroup
}

export function feedView(
  feed: Record<string, unknown> | null | undefined,
  { includePrivate = false } = {},
) {
  if (!feed) return feed
  return {
    ...feed,
    live: eventView(feed.live as Record<string, unknown>, { includePrivate }),
    week: ((feed.week as Record<string, unknown>[]) || []).map((event) =>
      eventView(event, { includePrivate }),
    ),
  }
}

export function searchView(
  results: Record<string, unknown> | null | undefined,
  { includePrivate = false } = {},
) {
  if (!results) return results
  return {
    ...results,
    events: ((results.events as Record<string, unknown>[]) || []).map((event) =>
      eventView(event, { includePrivate }),
    ),
    groups: ((results.groups as Record<string, unknown>[]) || []).map((group) =>
      groupView(group, { includePrivate }),
    ),
    contacts: ((results.contacts as Record<string, unknown>[]) || []).map((contact) =>
      contactView(contact, { includePrivate }),
    ),
  }
}

export function directoryView(items: Record<string, unknown>[], { includePrivate = false } = {}) {
  return (items || []).map((contact) => contactView(contact, { includePrivate }))
}

// WG activity rows -> member-facing JSON.
export function wgActivityView(d: any) {
  return {
    id: d.id,
    wg_slug: d.wgSlug,
    kind: d.kind,
    title: d.title,
    body: d.body,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    url: d.url,
    task_force_slug: d.taskForceSlug,
    created_by: typeof d.createdBy === 'object' ? d.createdBy?.id : d.createdBy,
    created_at: d.createdAt,
  }
}
