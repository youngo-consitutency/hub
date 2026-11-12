import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPgPool } from './pg'
import { toCamelCase } from './case'
import { sendEmail } from './email'
import { deliverPush, listSubscriptionsForAccounts } from './push'
import { getDocument } from './documents'
import { appBaseUrl } from './env'
import { renderEmailTemplate } from './emailTemplate'
import type { Doc, AnyValue } from './domain'

// Announcement broadcast surface (preview/send/outbox). Queue rows live in
// `notification_outbox`; eligibility reads the notification_prefs model.

const OPTIONAL_EMAIL_CATEGORIES = ['digest', 'deadline', 'announcement', 'group_mail']
// Mail from a group the member belongs to is on unless they turn it off;
// the other categories stay opt-in.
const OPT_OUT_EMAIL_CATEGORIES = ['group_mail']

export function emailPreferences(stored: AnyValue) {
  return Object.fromEntries(
    OPTIONAL_EMAIL_CATEGORIES.map((category) => [
      category,
      OPT_OUT_EMAIL_CATEGORIES.includes(category)
        ? stored?.[category] !== false
        : Boolean(stored?.[category]),
    ]),
  ) as Record<string, boolean>
}

export { renderEmailTemplate }

// ── Unsubscribe links ────────────────────────────────────────────

// PAYLOAD_SECRET is required at boot, so a key always exists. Set
// EMAIL_UNSUBSCRIBE_SECRET to rotate unsubscribe links independently.
const unsubscribeSecret = () =>
  String(process.env.EMAIL_UNSUBSCRIBE_SECRET || '').trim() || process.env.PAYLOAD_SECRET!

export function createUnsubscribeToken(accountId: AnyValue, category: string) {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category))
    throw new Error('Invalid unsubscribe category.')
  const payload = Buffer.from(
    JSON.stringify({ v: 1, accountId: String(accountId), category }),
  ).toString('base64url')
  const signature = createHmac('sha256', unsubscribeSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyUnsubscribeToken(token: string) {
  const [payload, supplied] = String(token || '').split('.')
  if (!payload || !supplied) return null
  const expected = createHmac('sha256', unsubscribeSecret()).update(payload).digest('base64url')
  const left = Buffer.from(supplied)
  const right = Buffer.from(expected)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (parsed.v !== 1 || !parsed.accountId || !OPTIONAL_EMAIL_CATEGORIES.includes(parsed.category))
      return null
    return { accountId: String(parsed.accountId), category: parsed.category }
  } catch {
    return null
  }
}

export function unsubscribeUrl(accountId: AnyValue, category: string) {
  return `${appBaseUrl()}/api/notifications/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(accountId, category))}`
}

// ── Transport ────────────────────────────────────────────────────

export async function sendTemplatedEmail({
  to,
  templateKey,
  data,
  unsubscribe: unsubUrl = null,
}: {
  to: string
  templateKey: string
  data?: AnyValue
  unsubscribe?: string | null
}) {
  const allowlist = String(process.env.EMAIL_RECIPIENT_ALLOWLIST || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length && !allowlist.includes(String(to).trim().toLowerCase())) {
    throw Object.assign(new Error('Recipient is not in the email delivery allowlist.'), {
      code: 'recipient_not_allowlisted',
    })
  }
  const rendered = await renderEmailTemplate(templateKey, data, {
    unsubscribeUrl: unsubUrl,
  })
  const result = await sendEmail({
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  })
  if (!result.delivered)
    throw Object.assign(new Error('Email delivery is not configured.'), {
      code: 'email_not_configured',
    })
  return result
}

// ── Outbox ───────────────────────────────────────────────────────

function publicOutbox(row: Doc) {
  if (!row) return null
  const r = toCamelCase<Doc>(row)
  return {
    id: r.id,
    accountId: r.accountId,
    channel: r.channel || 'email',
    category: r.category,
    templateKey: r.templateKey,
    sourceType: r.sourceType ?? null,
    sourceId: r.sourceId ?? null,
    deduplicationKey: r.deduplicationKey ?? null,
    payload: r.payload || {},
    status: r.status,
    attempts: Number(r.attempts || 0),
    availableAt: r.availableAt,
    leaseUntil: r.leaseUntil ?? null,
    providerMessageId: r.providerMessageId ?? null,
    lastErrorCode: r.lastErrorCode ?? null,
    createdAt: r.createdAt,
    sentAt: r.sentAt ?? null,
  }
}

const NOTIFICATION_CHANNELS = ['email', 'push']

export async function enqueueNotification({
  accountId,
  channel = 'email',
  category,
  templateKey,
  sourceType = null,
  sourceId = null,
  deduplicationKey,
  payload = {},
  availableAt = new Date(),
}: {
  accountId: AnyValue
  channel?: string
  category?: string | null
  templateKey: string
  sourceType?: string | null
  sourceId?: string | null
  deduplicationKey: string
  payload?: AnyValue
  availableAt?: Date
}) {
  if (!NOTIFICATION_CHANNELS.includes(channel)) throw new Error('Invalid notification channel.')
  if (channel === 'email' && !OPTIONAL_EMAIL_CATEGORIES.includes(category!))
    throw new Error('Invalid notification category.')
  if (channel === 'push' && category != null)
    throw new Error('Push notifications have no preference category.')
  if (!accountId || !templateKey || !deduplicationKey)
    throw new Error('Notification account, template, and deduplication key are required.')
  const pool = getPgPool()!
  const { rows } = await pool.query(
    `INSERT INTO notification_outbox(
       account_id,channel,category,template_key,source_type,source_id,
       deduplication_key,payload,available_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT(deduplication_key) DO NOTHING
     RETURNING *`,
    [
      accountId,
      channel,
      channel === 'push' ? null : category,
      templateKey,
      sourceType,
      sourceId ? String(sourceId) : null,
      deduplicationKey,
      payload,
      availableAt.toISOString(),
    ],
  )
  return { created: Boolean(rows[0]), item: publicOutbox(rows[0]) }
}

export async function markNotificationSent(id: AnyValue) {
  const pool = getPgPool()!
  await pool.query(
    `UPDATE notification_outbox
     SET status='sent', sent_at=now(), attempts=attempts+1,
         lease_until=NULL, updated_at=now()
     WHERE id=$1`,
    [id],
  )
}

export async function markNotificationFailed(id: AnyValue, code: string) {
  const pool = getPgPool()!
  await pool.query(
    `UPDATE notification_outbox
     SET status='failed', last_error_code=$2, attempts=attempts+1,
         lease_until=NULL, updated_at=now()
     WHERE id=$1`,
    [id, String(code || 'send_failed').slice(0, 80)],
  )
}

// ── Worker ───────────────────────────────────────────────────────

// Terminal after five attempts; earlier failures back off exponentially.
const MAX_DELIVERY_ATTEMPTS = 5
const retryDelayMs = (attempts: number) => Math.min(30_000 * 2 ** attempts, 30 * 60_000)

// Claim due rows under a short lease so concurrent drains never double-deliver.
export async function claimNotificationBatch(limit = 50) {
  const pool = getPgPool()!
  const { rows } = await pool.query(
    `UPDATE notification_outbox o
     SET lease_until = now() + interval '2 minutes', updated_at = now()
     WHERE o.id = ANY(
       SELECT id FROM notification_outbox
       WHERE status = 'queued'
         AND available_at <= now()
         AND (lease_until IS NULL OR lease_until < now())
       ORDER BY available_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING o.*`,
    [Math.max(1, Math.min(Number(limit) || 50, 200))],
  )
  return rows
}

// Requeue with backoff; rows past the attempt ceiling go terminal instead.
export async function rescheduleNotification(row: Doc, code: string) {
  const pool = getPgPool()!
  const attempts = Number(row.attempts || 0) + 1
  if (attempts >= MAX_DELIVERY_ATTEMPTS) return markNotificationFailed(row.id, code)
  await pool.query(
    `UPDATE notification_outbox
     SET attempts = attempts + 1,
         last_error_code = $2,
         lease_until = NULL,
         available_at = now() + ($3::bigint * interval '1 millisecond'),
         updated_at = now()
     WHERE id = $1`,
    [row.id, String(code || 'send_failed').slice(0, 80), retryDelayMs(attempts)],
  )
}

async function deliverOutboxRow(req: AnyValue, row: Doc, connectBody: AnyValue) {
  if (row.channel === 'push') {
    const subscriptions = await listSubscriptionsForAccounts([row.account_id])
    if (!subscriptions.length)
      throw Object.assign(new Error('No active push subscriptions.'), {
        code: 'no_subscriptions',
      })
    const payload =
      typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload || {})
    const result = await deliverPush(subscriptions, payload)
    // Zero reachable devices after pruning means nothing to retry.
    if (!result.sent && result.failed)
      throw Object.assign(new Error(`Push delivery failed (${result.failed}/${result.total}).`), {
        code: 'push_delivery_failed',
      })
    return result
  }
  const pool = getPgPool()!
  const { rows } = await pool.query('SELECT email FROM accounts WHERE id=$1', [row.account_id])
  if (!rows[0]?.email)
    throw Object.assign(new Error('Recipient account has no email.'), {
      code: 'recipient_missing',
    })
  return sendTemplatedEmail({
    to: rows[0].email,
    templateKey: row.template_key,
    data: {
      ...(row.payload || {}),
      socialLinks: connectBody?.SOCIAL_LINKS || [],
    },
    unsubscribe: unsubscribeUrl(row.account_id, row.category),
  })
}

// Bounded batch; the next drain picks up whatever remains.
export async function drainNotificationOutbox(req: AnyValue, { limit = 50 } = {}) {
  const connectBody = (await getDocument(req, 'connect').catch(() => null))?.body
  const claimed = await claimNotificationBatch(limit)
  const results = { claimed: claimed.length, sent: 0, retried: 0, failed: 0 }
  for (const row of claimed) {
    try {
      await deliverOutboxRow(req, row, connectBody)
      await markNotificationSent(row.id)
      results.sent += 1
    } catch (error: AnyValue) {
      const attempts = Number(row.attempts || 0) + 1
      await rescheduleNotification(row, error.code || 'send_failed')
      if (attempts >= MAX_DELIVERY_ATTEMPTS) results.failed += 1
      else results.retried += 1
    }
  }
  return results
}

export async function listQueuedNotifications() {
  const pool = getPgPool()!
  const { rows } = await pool.query(
    'SELECT * FROM notification_outbox ORDER BY created_at DESC LIMIT 200',
  )
  return rows.map(publicOutbox)
}

export async function listEligibleNotificationAccountIds({
  category,
  scope,
}: {
  category: string
  scope: { type: string; ids: string[] }
}) {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category))
    throw new Error('Invalid notification category.')
  if (!scope || !['all_active', 'working_group', 'team', 'account_ids'].includes(scope.type))
    throw new Error('Invalid notification scope.')
  const ids = Array.isArray(scope.ids) ? scope.ids.map(String) : []
  const filters: Record<string, string> = {
    all_active: 'true',
    working_group: 'a.wg_interests ?| $2::text[]',
    team: `EXISTS(SELECT 1 FROM authority_records ar WHERE ar.account_id=a.id AND ar.scope_type='team' AND ar.scope_id = ANY($2::text[]) AND ar.status='active' AND ar.starts_at<=now() AND (ar.ends_at IS NULL OR ar.ends_at>now()))`,
    account_ids: 'a.id::text = ANY($2::text[])',
  }
  const pool = getPgPool()!
  const { rows } = await pool.query(
    `SELECT a.id
     FROM accounts a
     LEFT JOIN notification_prefs p ON p.account_id=a.id
     WHERE COALESCE((p.email->>$1)::boolean, ${OPT_OUT_EMAIL_CATEGORIES.includes(category)})
       AND a.email_verified_at IS NOT NULL
       AND a.hub_access_status='active'
       AND a.membership_status NOT IN ('expired','terminated','rejected')
       AND ${filters[scope.type]}`,
    scope.type === 'all_active' ? [category] : [category, ids],
  )
  return rows.map((row: Doc) => String(row.id))
}
