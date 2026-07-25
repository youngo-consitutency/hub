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
  return publicEvent
}

export function groupView(group, { includePrivate = false } = {}) {
  if (!group) return group
  const result = {
    ...group,
    ...(Array.isArray(group.events)
      ? { events: group.events.map((event) => eventView(event, { includePrivate })) }
      : {}),
    ...(group.contact
      ? { contact: contactView(group.contact, { includePrivate }) }
      : {}),
  }
  if (includePrivate) return result
  const publicGroup = { ...result }
  delete publicGroup.whatsappUrl
  delete publicGroup.groupUrl
  delete publicGroup.driveUrl
  return publicGroup
}

export function feedView(feed, { includePrivate = false } = {}) {
  if (!feed) return feed
  return {
    ...feed,
    live: eventView(feed.live, { includePrivate }),
    week: (feed.week || []).map((event) => eventView(event, { includePrivate })),
  }
}

export function searchView(results, { includePrivate = false } = {}) {
  if (!results) return results
  return {
    ...results,
    events: (results.events || []).map((event) => eventView(event, { includePrivate })),
    groups: (results.groups || []).map((group) => groupView(group, { includePrivate })),
    contacts: (results.contacts || []).map((contact) => contactView(contact, { includePrivate })),
  }
}

export function directoryView(items, { includePrivate = false } = {}) {
  return (items || []).map((contact) => contactView(contact, { includePrivate }))
}
