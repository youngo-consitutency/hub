import { createHash } from 'node:crypto'
import { listContentPublications } from '../contentWorkflow.js'
import { appOrigin } from '../config.js'
import { getPool } from '../db.js'
import { enqueueNotification } from './store.js'

function dayKey(now) {
  return new Date(now).toISOString().slice(0, 10)
}

function dateLabel(value) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function withinScope(item, interests) {
  return !item.wg_slug || interests.includes(item.wg_slug)
}

async function digestRecipients(client, now) {
  const { rows } = await client.query(
    `SELECT a.id, a.wg_interests
     FROM hub_accounts a
     JOIN notification_settings s ON s.account_id=a.id
     JOIN notification_preferences p ON p.account_id=a.id
       AND p.channel='email' AND p.category='digest' AND p.enabled=true
     LEFT JOIN email_suppressions x ON x.account_id=a.id
     WHERE a.email_verified_at IS NOT NULL
       AND a.hub_access_status='active'
       AND a.membership_status NOT IN ('expired','terminated')
       AND x.account_id IS NULL
       AND s.digest_day=extract(dow FROM $1::timestamptz)::integer
       AND s.digest_hour_utc=extract(hour FROM $1::timestamptz)::integer`,
    [new Date(now).toISOString()],
  )
  return rows
}

// Read the same publication records as the site, freshly on each schedule run.
// Relative-date demo fixtures and the unused legacy tables must never send mail.
export function notificationContent(publications, now) {
  const timestamp = new Date(now).getTime()
  const events = [],
    announcements = [],
    deadlines = []
  for (const item of publications) {
    if (item.status !== 'published') continue
    const p = item.payload
    if (item.contentType === 'event') {
      const starts = Date.parse(p.startsAt)
      if (starts >= timestamp && starts < timestamp + 7 * 86400000)
        events.push({
          title: p.title,
          starts_at: p.startsAt,
          wg_slug: p.wg || null,
        })
    }
    if (item.contentType === 'announcement') {
      const published = Date.parse(item.publishedAt)
      if (published >= timestamp - 7 * 86400000 && published <= timestamp)
        announcements.push({
          title: p.title,
          published_at: item.publishedAt,
          wg_slug: null,
        })
      const due = Date.parse(p.ctaDeadlineAt)
      const days = Number.isFinite(due)
        ? Math.round(
            (Date.parse(dayKey(due)) - Date.parse(dayKey(now))) / 86400000,
          )
        : null
      if ([2, 7].includes(days))
        deadlines.push({
          id: item.contentKey,
          title: p.title,
          due_at: p.ctaDeadlineAt,
          wg_slug: null,
        })
    }
  }
  events.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
  announcements.sort(
    (a, b) => Date.parse(b.published_at) - Date.parse(a.published_at),
  )
  deadlines.sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at))
  return { events, announcements, deadlines }
}

export function deadlineBatchKey(items, now) {
  const sources = items
    .map((item) => [item.id, item.due_at])
    .sort((a, b) => a[0].localeCompare(b[0]))
  return `${dayKey(now)}:${createHash('sha256').update(JSON.stringify(sources)).digest('hex').slice(0, 24)}`
}

function digestMessage(items, interests) {
  const scoped = {
    events: items.events.filter((item) => withinScope(item, interests)),
    announcements: items.announcements.filter((item) =>
      withinScope(item, interests),
    ),
  }
  const sections = []
  if (scoped.events.length) {
    sections.push(
      `Upcoming events\n${scoped.events
        .slice(0, 8)
        .map((item) => `• ${item.title} — ${dateLabel(item.starts_at)} UTC`)
        .join('\n')}`,
    )
  }
  if (scoped.announcements.length) {
    sections.push(
      `Recent announcements\n${scoped.announcements
        .slice(0, 6)
        .map((item) => `• ${item.title}`)
        .join('\n')}`,
    )
  }
  return sections.join('\n\n')
}

async function scheduleDigests(client, now, env, items) {
  const recipients = await digestRecipients(client, now)
  let queued = 0
  for (const account of recipients) {
    const message = digestMessage(items, account.wg_interests || [])
    if (!message) continue
    const result = await enqueueNotification({
      accountId: account.id,
      category: 'digest',
      templateKey: 'digest',
      sourceType: 'digest',
      sourceId: dayKey(now),
      deduplicationKey: `digest:${account.id}:${dayKey(now)}`,
      payload: {
        title: 'Your weekly YOUNGO Hub digest',
        expiresAt: new Date(
          new Date(now).getTime() + 7 * 86400000,
        ).toISOString(),
        message,
        actionUrl: `${appOrigin(env)}/`,
        actionLabel: 'Open your Hub',
      },
    })
    if (result.created) queued += 1
  }
  return queued
}

async function deadlineRecipients(client, wgSlugs, hasGlobal) {
  const { rows } = await client.query(
    `SELECT DISTINCT a.id,a.wg_interests
     FROM hub_accounts a
     JOIN notification_preferences p ON p.account_id=a.id
       AND p.channel='email' AND p.category='deadline' AND p.enabled=true
     LEFT JOIN email_suppressions x ON x.account_id=a.id
     WHERE a.email_verified_at IS NOT NULL
       AND a.hub_access_status='active'
       AND a.membership_status NOT IN ('expired','terminated')
       AND x.account_id IS NULL
       AND ($2::boolean OR $1::text[] = '{}'::text[] OR a.wg_interests && $1::text[])`,
    [wgSlugs, hasGlobal],
  )
  return rows
}

async function scheduleDeadlines(client, now, env, items) {
  if (!items.length) return 0
  const scopedSlugs = [
    ...new Set(items.map((item) => item.wg_slug).filter(Boolean)),
  ]
  const recipients = await deadlineRecipients(
    client,
    scopedSlugs,
    items.some((item) => !item.wg_slug),
  )
  let queued = 0
  for (const account of recipients) {
    const interests = account.wg_interests || []
    const scoped = items.filter((item) => withinScope(item, interests))
    if (!scoped.length) continue
    const message = scoped
      .map((item) => `• ${item.title} — ${dateLabel(item.due_at)} UTC`)
      .join('\n')
    const result = await enqueueNotification({
      accountId: account.id,
      category: 'deadline',
      templateKey: 'deadline',
      sourceType: 'deadline_batch',
      sourceId: deadlineBatchKey(scoped, now),
      deduplicationKey: `deadline:${account.id}:${deadlineBatchKey(scoped, now)}`,
      payload: {
        title:
          scoped.length === 1
            ? `Deadline reminder: ${scoped[0].title}`
            : `${scoped.length} YOUNGO deadlines are approaching`,
        message,
        actionUrl: `${appOrigin(env)}/`,
        actionLabel: 'Review deadlines',
        expiresAt: new Date(
          Math.min(...scoped.map((item) => Date.parse(item.due_at))),
        ).toISOString(),
      },
    })
    if (result.created) queued += 1
  }
  return queued
}

export async function scheduleDueNotifications({
  now = new Date(),
  env = process.env,
} = {}) {
  const pool = getPool()
  if (!pool) return { digest: 0, deadline: 0, skipped: 'database_required' }
  const client = await pool.connect()
  let locked = false
  try {
    const lock = await client.query(
      `SELECT pg_try_advisory_lock(hashtext('youngo-email-scheduler')) AS locked`,
    )
    locked = Boolean(lock.rows[0]?.locked)
    if (!locked) return { digest: 0, deadline: 0, skipped: 'lock_busy' }
    const content = notificationContent(await listContentPublications(), now)
    return {
      digest: await scheduleDigests(client, now, env, content),
      deadline: await scheduleDeadlines(client, now, env, content.deadlines),
    }
  } finally {
    if (locked) {
      await client.query(
        `SELECT pg_advisory_unlock(hashtext('youngo-email-scheduler'))`,
      )
    }
    client.release()
  }
}
