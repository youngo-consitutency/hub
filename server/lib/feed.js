// Pure home-feed assembly — spec: docs/specs/youngo/01-product-spec.md (home-feed)
const DAY = 86400000

export function assembleFeed(data, now = new Date()) {
  const t = now.getTime()
  const events = [...data.events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))

  const live = events.find(
    (e) => new Date(e.startsAt) <= now && e.endsAt && now < new Date(e.endsAt)
  ) || null

  const week = events
    .filter((e) => {
      const s = new Date(e.startsAt).getTime()
      return s > t && s <= t + 7 * DAY
    })
    .slice(0, 5)

  const openSubs = data.submissions
    .filter((s) => ['open', 'drafting', 'internal_review'].includes(s.status))
    .filter((s) => s.deadlineAt && new Date(s.deadlineAt) > now)
    .map((s) => ({
      kind: 'submission', slug: s.slug, title: s.title,
      status: s.status, deadlineAt: s.deadlineAt, wg: s.wg || null,
    }))

  const openDecisions = data.council
    .filter((d) => ['open_for_input', 'objection_window'].includes(d.status))
    .map((d) => ({
      kind: 'decision', slug: d.slug, title: d.title, status: d.status,
      deadlineAt: d.status === 'objection_window' ? d.objectionDeadline : d.inputDeadline,
    }))
    .filter((d) => d.deadlineAt && new Date(d.deadlineAt) > now)

  const closing = [...openSubs, ...openDecisions]
    .filter((x) => new Date(x.deadlineAt).getTime() <= t + 14 * DAY)
    .sort((a, b) => new Date(a.deadlineAt) - new Date(b.deadlineAt))
    .slice(0, 3)

  const pinned = data.announcements.filter((a) => a.pinned).slice(0, 2)

  const coys = data.coys
    .filter((c) => c.reviewStatus === 'approved' && !['concluded', 'cancelled'].includes(c.status))
    .sort((a, b) => String(a.startsOn || '9999').localeCompare(String(b.startsOn || '9999')))
    .slice(0, 4)

  return { live, pinned, week, closing, coys }
}
