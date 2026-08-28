function timestamp(value) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

export function isOpportunityClosed(item, now = Date.now()) {
  const closesAt = timestamp(item.deadlineAt) ?? timestamp(item.endsAt)
  return closesAt != null && closesAt <= Number(now)
}

export function groupOpportunitiesByStatus(items, now = Date.now()) {
  return items.reduce(
    (groups, item) => {
      groups[isOpportunityClosed(item, now) ? 'closed' : 'open'].push(item)
      return groups
    },
    { open: [], closed: [] },
  )
}
