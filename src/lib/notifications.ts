import { createHmac, timingSafeEqual } from 'node:crypto'
import { getPgPool } from './pg'
import { toCamelCase } from './case'
import { emailConfigured, sendEmail } from './email'
import { deliverPush, listSubscriptionsForAccounts } from './push'
import { getDocument } from './documents'
import { appBaseUrl } from './env'

// Port of server/lib/notifications/{store,templates,transport,unsubscribe}.js
// — the announcement broadcast surface (preview/send/outbox). The queue rows
// live in `notification_outbox`; eligibility reads the v2 notification_prefs
// model ({email:{digest,deadline,announcement}}) instead of per-channel rows.

export const OPTIONAL_EMAIL_CATEGORIES = ['digest', 'deadline', 'announcement']

// ── Templates ────────────────────────────────────────────────────

const escapeHtml = (value: any) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const singleLine = (value: any, max = 160) =>
  String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max)

const safeUrl = (value: any) => {
  const text = String(value || '').trim()
  if (!text) return null
  try {
    const url = new URL(text)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

const paragraphs = (value: any) =>
  String(value || '')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(
      (item) =>
        `<p style="font-size:16px;line-height:1.6;color:#24342d;margin:0 0 14px">${escapeHtml(item).replaceAll('\n', '<br />')}</p>`,
    )
    .join('\n')

function templateContent(templateKey: string, data: any = {}) {
  const actionUrl = safeUrl(data.actionUrl)
  const actionLabel = escapeHtml(singleLine(data.actionLabel || 'Open YOUNGO Hub', 80))
  const action = actionUrl
    ? `<p style="margin:18px 0 0"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#087f5b;color:#ffffff;border-radius:8px;font-weight:700;padding:12px 22px;text-decoration:none">${actionLabel}</a></p>`
    : ''

  if (templateKey === 'password-reset') {
    return {
      subject: 'Reset your YOUNGO Hub password',
      eyebrow: 'Account security',
      title: 'Reset your password',
      body: paragraphs(
        'A password reset was requested for your YOUNGO Hub account. Use the button below within one hour.\n\nIf you did not request this, you can ignore this email.',
      ),
      action,
      text: `A password reset was requested for your YOUNGO Hub account. Use this link within one hour:\n\n${data.actionUrl}\n\nIf you did not request this, you can ignore this email.`,
    }
  }

  if (templateKey === 'verify-email') {
    return {
      subject: 'Verify your email for YOUNGO Hub updates',
      eyebrow: 'Email preferences',
      title: 'Verify your email address',
      body: paragraphs(
        'Confirm that this address belongs to you before enabling optional YOUNGO Hub email. The link expires after 24 hours.\n\nNo digest, deadline alert, or announcement will be sent until you enable it in your Profile.',
      ),
      action,
      text: `Verify your email address for YOUNGO Hub updates:\n\n${data.actionUrl}\n\nThe link expires after 24 hours. Optional email remains off until you enable it in your Profile.`,
    }
  }

  if (templateKey === 'invitation') {
    return {
      subject: 'You have been invited to YOUNGO Hub',
      eyebrow: 'Organisation invitation',
      title: 'Join an organisation team in YOUNGO Hub',
      body: paragraphs(
        `You have been invited to join an organisation team with the ${String(data.seatRole || 'representative')} role. Sign in with this same email address before accepting.\n\nThe invitation link expires after seven days and can be used once.`,
      ),
      action,
      text: `You have been invited to join an organisation team in YOUNGO Hub with the ${String(data.seatRole || 'representative')} role. Sign in with this same email address, then open this link within seven days:\n\n${data.actionUrl}`,
    }
  }

  if (templateKey === 'membership-activated') {
    const firstName = singleLine(data.firstName || 'there', 40)
    const social: { label: string; url: string }[] = (
      Array.isArray(data.socialLinks) ? data.socialLinks : []
    ).filter((link: any) => link?.url)
    const socialHtml = social
      .map(
        (link) =>
          `<a href="${escapeHtml(link.url)}" style="color:#087f5b;font-weight:700;text-decoration:none">${escapeHtml(link.label)}</a>`,
      )
      .join(' &nbsp;·&nbsp; ')
    const socialText = social.map((link) => `${link.label}: ${link.url}`).join('\n')
    return {
      subject: 'Welcome — your YOUNGO membership is active',
      eyebrow: 'YOUNGO membership',
      title: `${firstName}, you are in`,
      body: `${paragraphs(
        `The Membership Team has activated your YOUNGO Hub membership.\n\nYOUNGO is the children and youth constituency to the UN climate process. The Hub is where members find working groups, calls, and the work happening now.\n\nA good next step is to open the Hub, join a working group, and add a photo on your profile.`,
      )}${socialHtml ? `<p style="font-size:13px;line-height:1.6;color:#65736d;margin:8px 0 0">Stay in touch<br />${socialHtml}</p>` : ''}`,
      action,
      text: `${firstName}, you are in.\n\nThe Membership Team has activated your YOUNGO Hub membership. Open the Hub to join a working group and add a photo on your profile.${data.actionUrl ? `\n\n${data.actionUrl}` : ''}${socialText ? `\n\nStay in touch\n${socialText}` : ''}`,
    }
  }

  const title = singleLine(data.title || 'YOUNGO Hub update')
  const message = String(data.message || '').slice(0, 4000)
  const labels: Record<string, string> = {
    announcement: 'Announcement',
    digest: 'Your weekly digest',
    deadline: 'Deadline reminder',
  }
  return {
    subject: title,
    eyebrow: labels[templateKey] || 'YOUNGO Hub',
    title,
    body: paragraphs(message),
    action,
    text: `${title}\n\n${message}${data.actionUrl ? `\n\n${data.actionUrl}` : ''}`,
  }
}

// Same content as the legacy mjml renderer, emitted as a fixed, responsive
// table layout so no html-minifier dependency is needed.
export function renderEmailTemplate(
  templateKey: string,
  data: any = {},
  { unsubscribeUrl = null }: { unsubscribeUrl?: string | null } = {},
) {
  const content = templateContent(templateKey, data)
  const unsubscribe = unsubscribeUrl ? safeUrl(unsubscribeUrl) : null
  const footer = unsubscribe
    ? `You received this because you enabled this category in YOUNGO Hub. <a href="${escapeHtml(unsubscribe)}" style="color:#087f5b">Unsubscribe from this category</a>.`
    : 'This account message was sent by YOUNGO Hub.'

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f2f6f3;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f6f3"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#087f5b;height:8px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:32px 28px 20px">
<p style="color:#087f5b;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px">${escapeHtml(content.eyebrow)}</p>
<p style="color:#14251d;font-size:28px;line-height:1.2;font-weight:700;margin:0 0 14px">${escapeHtml(content.title)}</p>
${content.body}
${content.action}
</td></tr>
<tr><td style="padding:18px 28px"><p style="text-align:center;font-size:12px;line-height:1.5;color:#65736d;margin:0">${footer}</p></td></tr>
</table></td></tr></table>
</body></html>`

  return {
    subject: content.subject,
    html,
    text: `${content.text}${unsubscribe ? `\n\nUnsubscribe from this category: ${unsubscribeUrl}` : ''}`,
  }
}

// ── Unsubscribe links ────────────────────────────────────────────

// PAYLOAD_SECRET is required at boot, so a key always exists. Set
// EMAIL_UNSUBSCRIBE_SECRET to rotate unsubscribe links independently.
const unsubscribeSecret = () =>
  String(process.env.EMAIL_UNSUBSCRIBE_SECRET || '').trim() || process.env.PAYLOAD_SECRET!

export function createUnsubscribeToken(accountId: any, category: string) {
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

export function unsubscribeUrl(accountId: any, category: string) {
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
  data?: any
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
  const rendered = renderEmailTemplate(templateKey, data, {
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

function publicOutbox(row: any) {
  if (!row) return null
  const r = toCamelCase<Record<string, any>>(row)
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

export const NOTIFICATION_CHANNELS = ['email', 'push']

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
  accountId: any
  channel?: string
  category?: string | null
  templateKey: string
  sourceType?: string | null
  sourceId?: string | null
  deduplicationKey: string
  payload?: any
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

export async function markNotificationSent(id: any) {
  const pool = getPgPool()!
  await pool.query(
    `UPDATE notification_outbox
     SET status='sent', sent_at=now(), attempts=attempts+1,
         lease_until=NULL, updated_at=now()
     WHERE id=$1`,
    [id],
  )
}

export async function markNotificationFailed(id: any, code: string) {
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

// Terminal after five delivery attempts; earlier failures back off
// exponentially (30s → 30m cap) so a slow gateway doesn't stall the queue.
const MAX_DELIVERY_ATTEMPTS = 5
const retryDelayMs = (attempts: number) => Math.min(30_000 * 2 ** attempts, 30 * 60_000)

// Claim due rows with a short lease so concurrent drains (after() tasks, the
// cron endpoint, overlapping deployments) never double-deliver the same row.
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
export async function rescheduleNotification(row: any, code: string) {
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

async function deliverOutboxRow(req: any, row: any, connectBody: any) {
  if (row.channel === 'push') {
    const subscriptions = await listSubscriptionsForAccounts([row.account_id])
    if (!subscriptions.length)
      throw Object.assign(new Error('No active push subscriptions.'), {
        code: 'no_subscriptions',
      })
    const payload =
      typeof row.payload === 'string' ? row.payload : JSON.stringify(row.payload || {})
    const result = await deliverPush(subscriptions, payload)
    // deliverPush prunes dead endpoints itself; zero reachable devices means
    // the member has nothing left to deliver to — retrying is pointless.
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

// Bounded batch so a single invocation stays well under the platform's
// request duration budget; whatever remains is picked up by the next drain
// (another enqueue's after() task or the cron endpoint).
export async function drainNotificationOutbox(req: any, { limit = 50 } = {}) {
  const connectBody = (await getDocument(req, 'connect').catch(() => null))?.body
  const claimed = await claimNotificationBatch(limit)
  const results = { claimed: claimed.length, sent: 0, retried: 0, failed: 0 }
  for (const row of claimed) {
    try {
      await deliverOutboxRow(req, row, connectBody)
      await markNotificationSent(row.id)
      results.sent += 1
    } catch (error: any) {
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
     JOIN notification_prefs p ON p.account_id=a.id
       AND (p.email->>$1)::boolean = true
     WHERE a.email_verified_at IS NOT NULL
       AND a.hub_access_status='active'
       AND a.membership_status NOT IN ('expired','terminated','rejected')
       AND ${filters[scope.type]}`,
    scope.type === 'all_active' ? [category] : [category, ids],
  )
  return rows.map((row: any) => String(row.id))
}

export { emailConfigured }
