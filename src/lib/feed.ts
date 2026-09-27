// Port of server/lib/feed.js — pure home-feed assembly.
const DAY = 86400000

type AnyRecord = Record<string, any>

export function assembleFeed(data: AnyRecord, now = new Date()) {
  const t = now.getTime()
  const events = [...data.events].sort(
    (a: AnyRecord, b: AnyRecord) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )

  const live =
    events.find(
      (e) =>
        new Date(e.startsAt) <= now && e.endsAt && now < new Date(e.endsAt),
    ) || null

  const week = events
    .filter((e) => {
      const s = new Date(e.startsAt).getTime()
      return s > t && s <= t + 7 * DAY
    })
    .slice(0, 5)

  const openSubs = (data.submissions || [])
    .filter((s: AnyRecord) =>
      ['open', 'drafting', 'internal_review'].includes(s.status),
    )
    .filter((s: AnyRecord) => s.deadlineAt && new Date(s.deadlineAt) > now)
    .map((s: AnyRecord) => ({
      kind: 'submission',
      slug: s.slug,
      title: s.title,
      status: s.status,
      deadlineAt: s.deadlineAt,
      wg: s.wg || null,
    }))

  const openDecisions = (data.council || [])
    .filter((d: AnyRecord) =>
      ['consultation', 'revision', 'decision', 'voting'].includes(d.status),
    )
    .map((d: AnyRecord) => ({
      kind: 'decision',
      slug: d.slug,
      title: d.title,
      status: d.status,
      deadlineAt: d.windowDeadline,
    }))
    .filter((d: AnyRecord) => d.deadlineAt && new Date(d.deadlineAt) > now)

  const closing = [...openSubs, ...openDecisions]
    .filter((x) => new Date(x.deadlineAt).getTime() <= t + 14 * DAY)
    .sort((a, b) => new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime())
    .slice(0, 3)

  const pinned = (data.announcements || [])
    .filter((a: AnyRecord) => a.pinned)
    .filter(
      (a: AnyRecord) => !a.ctaDeadlineAt || new Date(a.ctaDeadlineAt) > now,
    )
    .sort((a: AnyRecord, b: AnyRecord) => {
      const deadlineA = a.ctaDeadlineAt
        ? new Date(a.ctaDeadlineAt).getTime()
        : Infinity
      const deadlineB = b.ctaDeadlineAt
        ? new Date(b.ctaDeadlineAt).getTime()
        : Infinity
      if (deadlineA !== deadlineB) return deadlineA - deadlineB
      return (
        new Date(b.publishedAt || 0).getTime() -
        new Date(a.publishedAt || 0).getTime()
      )
    })
    .slice(0, 2)

  const coys = (data.coys || [])
    .filter(
      (c: AnyRecord) =>
        c.reviewStatus === 'approved' &&
        !['concluded', 'cancelled'].includes(c.status),
    )
    .sort((a: AnyRecord, b: AnyRecord) =>
      String(a.startsOn || '9999').localeCompare(String(b.startsOn || '9999')),
    )
    .slice(0, 4)

  return { live, pinned, week, closing, coys }
}
