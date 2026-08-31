import { appOrigin } from './config.js'
import { getPool } from './db.js'
import { enqueueNotification } from './notificationStore.js'

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

async function digestItems(client, now) {
  const timestamp = new Date(now).toISOString()
  const [events, submissions, announcements] = await Promise.all([
    client.query(
      `SELECT e.title,e.starts_at,w.slug AS wg_slug
       FROM events e LEFT JOIN working_groups w ON w.id=e.wg_id
       WHERE e.starts_at >= $1 AND e.starts_at < $1::timestamptz + interval '7 days'
       ORDER BY e.starts_at LIMIT 100`,
      [timestamp],
    ),
    client.query(
      `SELECT s.title,s.deadline_at,w.slug AS wg_slug
       FROM submissions s LEFT JOIN working_groups w ON w.id=s.wg_id
       WHERE s.status IN ('open','drafting','internal_review')
         AND s.deadline_at >= $1
         AND s.deadline_at < $1::timestamptz + interval '7 days'
       ORDER BY s.deadline_at LIMIT 100`,
      [timestamp],
    ),
    client.query(
      `SELECT a.title,a.published_at,w.slug AS wg_slug
       FROM announcements a LEFT JOIN working_groups w ON w.id=a.wg_id
       WHERE a.published_at >= $1::timestamptz - interval '7 days'
         AND (a.expires_at IS NULL OR a.expires_at > $1)
       ORDER BY a.published_at DESC LIMIT 100`,
      [timestamp],
    ),
  ])
  return {
    events: events.rows,
    submissions: submissions.rows,
    announcements: announcements.rows,
  }
}

function digestMessage(items, interests) {
  const scoped = {
    events: items.events.filter((item) => withinScope(item, interests)),
    submissions: items.submissions.filter((item) =>
      withinScope(item, interests),
    ),
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
  if (scoped.submissions.length) {
    sections.push(
      `Closing submissions\n${scoped.submissions
        .slice(0, 8)
        .map((item) => `• ${item.title} — ${dateLabel(item.deadline_at)} UTC`)
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

async function scheduleDigests(client, now, env) {
  const [recipients, items] = await Promise.all([
    digestRecipients(client, now),
    digestItems(client, now),
  ])
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
        message,
        actionUrl: `${appOrigin(env)}/`,
        actionLabel: 'Open your Hub',
      },
    })
    if (result.created) queued += 1
  }
  return queued
}

async function deadlineItems(client, now) {
  const timestamp = new Date(now).toISOString()
  const { rows } = await client.query(
    `SELECT * FROM (
       SELECT 'submission' AS source_type,s.id,s.title,s.deadline_at AS due_at,
              w.slug AS wg_slug,'submissions' AS route
       FROM submissions s LEFT JOIN working_groups w ON w.id=s.wg_id
       WHERE s.status IN ('open','drafting','internal_review')
       UNION ALL
       SELECT 'decision',d.id,d.title,
              CASE WHEN d.status='objection_window' THEN d.objection_deadline
                   ELSE d.input_deadline END AS due_at,
              w.slug AS wg_slug,'council' AS route
       FROM dmp_decisions d LEFT JOIN working_groups w ON w.id=d.wg_id
       WHERE d.status IN ('open_for_input','objection_window')
     ) due
     WHERE due_at IS NOT NULL AND (
       (due_at > $1::timestamptz + interval '47 hours'
        AND due_at <= $1::timestamptz + interval '48 hours')
       OR
       (due_at > $1::timestamptz + interval '167 hours'
        AND due_at <= $1::timestamptz + interval '168 hours')
     )
     ORDER BY due_at`,
    [timestamp],
  )
  return rows
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

async function scheduleDeadlines(client, now, env) {
  const items = await deadlineItems(client, now)
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
      sourceId: dayKey(now),
      deduplicationKey: `deadline:${account.id}:${dayKey(now)}`,
      payload: {
        title:
          scoped.length === 1
            ? `Deadline reminder: ${scoped[0].title}`
            : `${scoped.length} YOUNGO deadlines are approaching`,
        message,
        actionUrl: `${appOrigin(env)}/submissions`,
        actionLabel: 'Review deadlines',
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
    return {
      digest: await scheduleDigests(client, now, env),
      deadline: await scheduleDeadlines(client, now, env),
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
