import { createHmac, randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findAccountById } from '../accounts.js'
import { getPool } from '../db.js'
import { readJson, writeJson } from '../jsonFile.js'

export const OPTIONAL_EMAIL_CATEGORIES = ['digest', 'deadline', 'announcement']

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../../data')
const preferencesPath = path.join(dataDir, 'notification-preferences.json')
const settingsPath = path.join(dataDir, 'notification-settings.json')
const outboxPath = path.join(dataDir, 'notification-outbox.json')
const attemptsPath = path.join(dataDir, 'notification-attempts.json')
const suppressionsPath = path.join(dataDir, 'email-suppressions.json')

const FORBIDDEN_PAYLOAD_KEY =
  /email|phone|password|token|secret|credential|session|guardian|minority/i

function iso(value = new Date()) {
  return new Date(value).toISOString()
}

function rawEmailVerified(account) {
  return account?.email_verified_at ?? account?.emailVerifiedAt ?? null
}

function rawAccessStatus(account) {
  return account?.hub_access_status ?? account?.hubAccessStatus ?? null
}

function rawMembershipStatus(account) {
  return account?.membership_status ?? account?.membershipStatus ?? null
}

function safePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return {}
  const inspect = (value) => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach(inspect)
      return
    }
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_PAYLOAD_KEY.test(key)) {
        throw new Error(`Notification payload contains forbidden key: ${key}`)
      }
      inspect(nested)
    }
  }
  inspect(payload)
  const encoded = JSON.stringify(payload)
  if (Buffer.byteLength(encoded, 'utf8') > 8 * 1024) {
    throw new Error('Notification payload must be 8KB or smaller.')
  }
  return JSON.parse(encoded)
}

function publicOutbox(row) {
  if (!row) return null
  return {
    id: row.id,
    accountId: row.account_id ?? row.accountId,
    category: row.category,
    templateKey: row.template_key ?? row.templateKey,
    sourceType: row.source_type ?? row.sourceType ?? null,
    sourceId: row.source_id ?? row.sourceId ?? null,
    deduplicationKey: row.deduplication_key ?? row.deduplicationKey ?? null,
    payload: row.payload || {},
    status: row.status,
    attempts: Number(row.attempts || 0),
    availableAt: row.available_at ?? row.availableAt,
    leaseUntil: row.lease_until ?? row.leaseUntil ?? null,
    providerMessageId: row.provider_message_id ?? row.providerMessageId ?? null,
    lastErrorCode: row.last_error_code ?? row.lastErrorCode ?? null,
    createdAt: row.created_at ?? row.createdAt,
    sentAt: row.sent_at ?? row.sentAt ?? null,
  }
}

export function defaultNotificationPreferences(accountId) {
  return {
    accountId,
    timezone: 'UTC',
    digestDay: 1,
    digestHourUtc: 6,
    email: Object.fromEntries(
      OPTIONAL_EMAIL_CATEGORIES.map((category) => [category, false]),
    ),
  }
}

export async function getNotificationPreferences(accountId) {
  const result = defaultNotificationPreferences(accountId)
  const pool = getPool()
  if (pool) {
    const [settings, preferences] = await Promise.all([
      pool.query('SELECT * FROM notification_settings WHERE account_id=$1', [
        accountId,
      ]),
      pool.query(
        `SELECT category, enabled FROM notification_preferences
         WHERE account_id=$1 AND channel='email'`,
        [accountId],
      ),
    ])
    if (settings.rows[0]) {
      result.timezone = settings.rows[0].timezone
      result.digestDay = settings.rows[0].digest_day
      result.digestHourUtc = settings.rows[0].digest_hour_utc
    }
    for (const row of preferences.rows) result.email[row.category] = row.enabled
    return result
  }

  const setting = readJson(settingsPath, []).find(
    (row) => String(row.accountId) === String(accountId),
  )
  if (setting) {
    result.timezone = setting.timezone || 'UTC'
    result.digestDay = Number(setting.digestDay ?? 1)
    result.digestHourUtc = Number(setting.digestHourUtc ?? 6)
  }
  for (const row of readJson(preferencesPath, [])) {
    if (
      String(row.accountId) === String(accountId) &&
      row.channel === 'email' &&
      OPTIONAL_EMAIL_CATEGORIES.includes(row.category)
    ) {
      result.email[row.category] = Boolean(row.enabled)
    }
  }
  return result
}

export async function updateNotificationPreferences(accountId, input) {
  const timezone = String(input?.timezone || 'UTC').trim()
  const digestDay = Number(input?.digestDay ?? 1)
  const digestHourUtc = Number(input?.digestHourUtc ?? 6)
  if (!timezone || timezone.length > 80) throw new Error('Invalid timezone.')
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format()
  } catch {
    throw new Error('Invalid timezone.')
  }
  if (!Number.isInteger(digestDay) || digestDay < 0 || digestDay > 6)
    throw new Error('Digest day must be between 0 and 6.')
  if (
    !Number.isInteger(digestHourUtc) ||
    digestHourUtc < 0 ||
    digestHourUtc > 23
  )
    throw new Error('Digest hour must be between 0 and 23.')

  const enabled = {}
  for (const category of OPTIONAL_EMAIL_CATEGORIES) {
    enabled[category] = Boolean(input?.email?.[category])
  }

  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO notification_settings(account_id,timezone,digest_day,digest_hour_utc)
         VALUES($1,$2,$3,$4)
         ON CONFLICT(account_id) DO UPDATE SET timezone=EXCLUDED.timezone,
           digest_day=EXCLUDED.digest_day,digest_hour_utc=EXCLUDED.digest_hour_utc,
           updated_at=now()`,
        [accountId, timezone, digestDay, digestHourUtc],
      )
      for (const category of OPTIONAL_EMAIL_CATEGORIES) {
        await client.query(
          `INSERT INTO notification_preferences(account_id,channel,category,enabled)
           VALUES($1,'email',$2,$3)
           ON CONFLICT(account_id,channel,category) DO UPDATE
           SET enabled=EXCLUDED.enabled,updated_at=now()`,
          [accountId, category, enabled[category]],
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } else {
    const settings = readJson(settingsPath, [])
    const settingIndex = settings.findIndex(
      (row) => String(row.accountId) === String(accountId),
    )
    const setting = {
      accountId,
      timezone,
      digestDay,
      digestHourUtc,
      updatedAt: iso(),
    }
    if (settingIndex >= 0) settings[settingIndex] = setting
    else settings.push(setting)
    writeJson(settingsPath, settings)

    const preferences = readJson(preferencesPath, [])
    for (const category of OPTIONAL_EMAIL_CATEGORIES) {
      const index = preferences.findIndex(
        (row) =>
          String(row.accountId) === String(accountId) &&
          row.channel === 'email' &&
          row.category === category,
      )
      const row = {
        accountId,
        channel: 'email',
        category,
        enabled: enabled[category],
        updatedAt: iso(),
      }
      if (index >= 0) preferences[index] = row
      else preferences.push(row)
    }
    writeJson(preferencesPath, preferences)
  }
  return getNotificationPreferences(accountId)
}

export async function setEmailPreference(accountId, category, enabled) {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category)) {
    throw new Error('Invalid email notification category.')
  }
  const current = await getNotificationPreferences(accountId)
  return updateNotificationPreferences(accountId, {
    ...current,
    email: { ...current.email, [category]: Boolean(enabled) },
  })
}

export async function enqueueNotification({
  accountId,
  category,
  templateKey,
  sourceType = null,
  sourceId = null,
  deduplicationKey,
  payload = {},
  availableAt = new Date(),
}) {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category))
    throw new Error('Invalid notification category.')
  if (!accountId || !templateKey || !deduplicationKey)
    throw new Error(
      'Notification account, template, and deduplication key are required.',
    )
  const storedPayload = safePayload(payload)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO notification_outbox(
         account_id,category,template_key,source_type,source_id,
         deduplication_key,payload,available_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(deduplication_key) DO NOTHING
       RETURNING *`,
      [
        accountId,
        category,
        templateKey,
        sourceType,
        sourceId ? String(sourceId) : null,
        deduplicationKey,
        storedPayload,
        iso(availableAt),
      ],
    )
    return { created: Boolean(rows[0]), item: publicOutbox(rows[0]) }
  }

  const list = readJson(outboxPath, [])
  const existing = list.find((row) => row.deduplicationKey === deduplicationKey)
  if (existing) return { created: false, item: publicOutbox(existing) }
  const row = {
    id: randomUUID(),
    accountId,
    category,
    templateKey,
    sourceType,
    sourceId: sourceId ? String(sourceId) : null,
    deduplicationKey,
    payload: storedPayload,
    status: 'queued',
    attempts: 0,
    availableAt: iso(availableAt),
    leaseUntil: null,
    createdAt: iso(),
    sentAt: null,
  }
  list.push(row)
  writeJson(outboxPath, list)
  return { created: true, item: publicOutbox(row) }
}

export async function claimDueNotifications({
  limit = 25,
  leaseMs = 5 * 60 * 1000,
  now = new Date(),
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100)
  const leaseUntil = new Date(new Date(now).getTime() + leaseMs)
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `WITH due AS (
           SELECT item.id
           FROM notification_outbox item
           JOIN hub_accounts account ON account.id=item.account_id
           WHERE item.status IN ('queued','retry') AND item.available_at <= $1
             AND NOT EXISTS (
               SELECT 1 FROM notification_outbox active
               WHERE active.account_id=item.account_id AND active.status='sending'
             )
             AND NOT EXISTS (
               SELECT 1 FROM notification_outbox earlier
               WHERE earlier.account_id=item.account_id
                 AND earlier.status IN ('queued','retry')
                 AND earlier.available_at <= $1
                 AND (earlier.available_at,earlier.created_at,earlier.id)
                   < (item.available_at,item.created_at,item.id)
             )
           ORDER BY item.available_at,item.created_at,item.id
           LIMIT $2
           FOR UPDATE OF item,account SKIP LOCKED
         )
         UPDATE notification_outbox AS item
         SET status='sending', attempts=item.attempts+1, lease_until=$3
         FROM due WHERE item.id=due.id
         RETURNING item.*`,
        [iso(now), safeLimit, iso(leaseUntil)],
      )
      await client.query('COMMIT')
      return rows.map(publicOutbox)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  const list = readJson(outboxPath, [])
  const sendingAccounts = new Set(
    list
      .filter((row) => row.status === 'sending')
      .map((row) => String(row.accountId)),
  )
  const selectedAccounts = new Set()
  const due = list
    .filter(
      (row) =>
        ['queued', 'retry'].includes(row.status) &&
        new Date(row.availableAt) <= new Date(now) &&
        !sendingAccounts.has(String(row.accountId)),
    )
    .sort((a, b) => new Date(a.availableAt) - new Date(b.availableAt))
    .filter((row) => {
      const accountId = String(row.accountId)
      if (selectedAccounts.has(accountId)) return false
      selectedAccounts.add(accountId)
      return true
    })
    .slice(0, safeLimit)
  for (const row of due) {
    row.status = 'sending'
    row.attempts = Number(row.attempts || 0) + 1
    row.leaseUntil = iso(leaseUntil)
  }
  writeJson(outboxPath, list)
  return due.map(publicOutbox)
}

export async function requeueExpiredLeases(now = new Date()) {
  const pool = getPool()
  if (pool) {
    const { rowCount } = await pool.query(
      `UPDATE notification_outbox SET status='retry',available_at=now(),lease_until=NULL,
         last_error_code='lease_expired',last_error_at=now()
       WHERE status='sending' AND lease_until < $1`,
      [iso(now)],
    )
    return rowCount
  }
  const list = readJson(outboxPath, [])
  let count = 0
  for (const row of list) {
    if (row.status === 'sending' && new Date(row.leaseUntil) < new Date(now)) {
      row.status = 'retry'
      row.availableAt = iso(now)
      row.leaseUntil = null
      row.lastErrorCode = 'lease_expired'
      row.lastErrorAt = iso(now)
      count += 1
    }
  }
  if (count) writeJson(outboxPath, list)
  return count
}

function frequencyWindows(category, now) {
  const timestamp = new Date(now).getTime()
  return {
    totalSince: new Date(timestamp - 7 * 24 * 60 * 60 * 1000),
    categorySince: new Date(
      timestamp -
        (category === 'digest' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
    ),
  }
}

async function sentCounts(accountId, category, now) {
  const { totalSince, categorySince } = frequencyWindows(category, now)
  const pool = getPool()
  const sent = pool
    ? (
        await pool.query(
          `SELECT category,sent_at FROM notification_outbox
       WHERE account_id=$1 AND status='sent' AND sent_at > $2 ORDER BY sent_at DESC`,
          [accountId, iso(totalSince)],
        )
      ).rows
    : readJson(outboxPath, []).filter(
        (row) =>
          String(row.accountId) === String(accountId) && row.status === 'sent',
      )
  const dates = sent
    .map((row) => ({
      category: row.category,
      at: new Date(row.sent_at ?? row.sentAt).getTime(),
    }))
    .filter((row) => row.at > totalSince.getTime())
    .sort((a, b) => b.at - a.at)
  const categoryDates = dates.filter(
    (row) => row.category === category && row.at > categorySince.getTime(),
  )
  const weeklyRetry = dates.length >= 3 ? dates[2].at + 7 * 86400000 : 0
  const categoryRetry = categoryDates.length
    ? categoryDates[0].at + (category === 'digest' ? 7 : 1) * 86400000
    : 0
  return {
    total: dates.length,
    category: categoryDates.length,
    retryAt: iso(Math.max(weeklyRetry, categoryRetry)),
  }
}

async function isSuppressed(accountId) {
  const pool = getPool()
  if (pool) {
    const { rowCount } = await pool.query(
      'SELECT 1 FROM email_suppressions WHERE account_id=$1 LIMIT 1',
      [accountId],
    )
    return rowCount > 0
  }
  return readJson(suppressionsPath, []).some(
    (row) => String(row.accountId) === String(accountId),
  )
}

export async function deliveryDecision(item, now = new Date()) {
  const expiry = Date.parse(item.payload?.expiresAt)
  if (item.category === 'deadline' && !Number.isFinite(expiry))
    return { allowed: false, reason: 'deadline_expiry_missing' }
  if (Number.isFinite(expiry) && expiry <= new Date(now).getTime())
    return { allowed: false, reason: 'content_expired' }
  const account = await findAccountById(item.accountId)
  if (!account) return { allowed: false, reason: 'account_missing' }
  if (!rawEmailVerified(account))
    return { allowed: false, reason: 'email_unverified' }
  if (
    rawAccessStatus(account) !== 'active' ||
    ['expired', 'terminated', 'rejected'].includes(rawMembershipStatus(account))
  )
    return { allowed: false, reason: 'account_inactive' }
  if (await isSuppressed(item.accountId))
    return { allowed: false, reason: 'address_suppressed' }
  const preferences = await getNotificationPreferences(item.accountId)
  if (!preferences.email[item.category])
    return { allowed: false, reason: 'preference_disabled' }
  const counts = await sentCounts(item.accountId, item.category, now)
  if (
    (counts.total >= 3 || counts.category >= 1) &&
    Number.isFinite(expiry) &&
    Date.parse(counts.retryAt) >= expiry
  )
    return { allowed: false, reason: 'expires_before_delivery' }
  if (counts.total >= 3)
    return {
      allowed: false,
      reason: 'weekly_frequency_cap',
      retryAt: counts.retryAt,
    }
  if (counts.category >= 1)
    return {
      allowed: false,
      reason: 'category_frequency_cap',
      retryAt: counts.retryAt,
    }
  return {
    allowed: true,
    account: {
      id: account.id,
      email: account.email,
      name: account.name || null,
    },
  }
}

async function addAttempt(item, outcome, details = {}) {
  const responseCode = String(details.responseCode || '').slice(0, 80) || null
  const providerMessageId =
    String(details.providerMessageId || '').slice(0, 255) || null
  const pool = getPool()
  if (pool) {
    await pool.query(
      `INSERT INTO notification_delivery_attempts(
         outbox_id,attempt_number,outcome,provider_message_id,response_code
       ) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT(outbox_id,attempt_number) DO NOTHING`,
      [item.id, item.attempts, outcome, providerMessageId, responseCode],
    )
    return
  }
  const attempts = readJson(attemptsPath, [])
  if (
    !attempts.some(
      (row) => row.outboxId === item.id && row.attemptNumber === item.attempts,
    )
  ) {
    attempts.push({
      id: randomUUID(),
      outboxId: item.id,
      attemptNumber: item.attempts,
      outcome,
      providerMessageId,
      responseCode,
      attemptedAt: iso(),
    })
    writeJson(attemptsPath, attempts)
  }
}

async function updateOutbox(item, changes) {
  const pool = getPool()
  if (pool) {
    const columns = {
      status: 'status',
      availableAt: 'available_at',
      leaseUntil: 'lease_until',
      providerMessageId: 'provider_message_id',
      lastErrorCode: 'last_error_code',
      lastErrorAt: 'last_error_at',
      sentAt: 'sent_at',
    }
    const entries = Object.entries(changes).filter(([key]) => columns[key])
    const values = entries.map(([, value]) => value)
    const sets = entries.map(([key], index) => `${columns[key]}=$${index + 1}`)
    values.push(item.id, item.attempts)
    const result = await pool.query(
      `UPDATE notification_outbox SET ${sets.join(',')} WHERE id=$${values.length - 1}
       AND attempts=$${values.length} AND status='sending' AND lease_until > now()`,
      values,
    )
    return result.rowCount > 0
  }
  const list = readJson(outboxPath, [])
  const row = list.find(
    (entry) =>
      entry.id === item.id &&
      entry.attempts === item.attempts &&
      entry.status === 'sending' &&
      new Date(entry.leaseUntil) > new Date(),
  )
  if (!row) return false
  Object.assign(row, changes)
  writeJson(outboxPath, list)
  return true
}

export async function notificationClaimIsCurrent(item) {
  const pool = getPool()
  if (pool) {
    const result = await pool.query(
      `SELECT 1 FROM notification_outbox WHERE id=$1 AND attempts=$2 AND status='sending' AND lease_until > now()`,
      [item.id, item.attempts],
    )
    return result.rowCount > 0
  }
  return readJson(outboxPath, []).some(
    (row) =>
      row.id === item.id &&
      row.attempts === item.attempts &&
      row.status === 'sending' &&
      new Date(row.leaseUntil) > new Date(),
  )
}

export async function deferNotification(item, retryAt, reason) {
  return updateOutbox(item, {
    status: 'retry',
    availableAt: retryAt,
    leaseUntil: null,
    lastErrorCode: reason,
    lastErrorAt: iso(),
  })
}

export async function markNotificationSent(item, providerMessageId) {
  const sentAt = iso()
  const updated = await updateOutbox(item, {
    status: 'sent',
    leaseUntil: null,
    providerMessageId: String(providerMessageId || '').slice(0, 255) || null,
    sentAt,
  })
  if (!updated) return false
  await addAttempt(item, 'accepted', { providerMessageId })
  return true
}

export async function markNotificationSuppressed(item, reason) {
  const updated = await updateOutbox(item, {
    status: 'suppressed',
    leaseUntil: null,
    lastErrorCode: String(reason || 'suppressed').slice(0, 80),
    lastErrorAt: iso(),
  })
  if (!updated) return false
  await addAttempt(item, 'suppressed', { responseCode: reason })
  return true
}

export async function markNotificationFailed(
  item,
  { code = 'delivery_failed', permanent = false } = {},
) {
  const exhausted = item.attempts >= 5
  const status = permanent || exhausted ? 'failed' : 'retry'
  const delayMinutes = Math.min(2 ** Math.max(item.attempts - 1, 0), 120)
  const updated = await updateOutbox(item, {
    status,
    availableAt:
      status === 'retry'
        ? iso(Date.now() + delayMinutes * 60 * 1000)
        : item.availableAt,
    leaseUntil: null,
    lastErrorCode: String(code).slice(0, 80),
    lastErrorAt: iso(),
  })
  if (!updated) return false
  await addAttempt(item, permanent || exhausted ? 'rejected' : 'deferred', {
    responseCode: code,
  })
  return true
}

function accountInScope(account, scope) {
  if (scope.type === 'all_active') return true
  const ids = scope.ids.map(String)
  if (scope.type === 'working_group') {
    const interests = account.wg_interests ?? account.wgInterests ?? []
    return interests.some((value) => ids.includes(String(value)))
  }
  if (scope.type === 'team') {
    const roles = account.team_roles ?? account.teamRoles ?? []
    return roles.some((value) => ids.includes(String(value)))
  }
  return ids.includes(String(account.id))
}

export async function listEligibleNotificationAccountIds({ category, scope }) {
  if (!OPTIONAL_EMAIL_CATEGORIES.includes(category)) {
    throw new Error('Invalid notification category.')
  }
  if (
    !scope ||
    !['all_active', 'working_group', 'team', 'account_ids'].includes(scope.type)
  ) {
    throw new Error('Invalid notification scope.')
  }
  const ids = Array.isArray(scope.ids) ? scope.ids.map(String) : []
  const pool = getPool()
  if (pool) {
    const filters = {
      all_active: 'true',
      working_group: 'a.wg_interests && $2::text[]',
      team: 'a.team_roles && $2::text[]',
      account_ids: 'a.id::text = ANY($2::text[])',
    }
    const { rows } = await pool.query(
      `SELECT a.id
       FROM hub_accounts a
       JOIN notification_preferences p ON p.account_id=a.id
         AND p.channel='email' AND p.category=$1 AND p.enabled=true
       LEFT JOIN email_suppressions x ON x.account_id=a.id
       WHERE a.email_verified_at IS NOT NULL
         AND a.hub_access_status='active'
         AND a.membership_status NOT IN ('expired','terminated','rejected')
         AND x.account_id IS NULL
         AND ${filters[scope.type]}`,
      scope.type === 'all_active' ? [category] : [category, ids],
    )
    return rows.map((row) => String(row.id))
  }

  const preferences = readJson(preferencesPath, [])
  const enabled = new Set(
    preferences
      .filter(
        (row) =>
          row.channel === 'email' &&
          row.category === category &&
          row.enabled === true,
      )
      .map((row) => String(row.accountId)),
  )
  const suppressed = new Set(
    readJson(suppressionsPath, []).map((row) => String(row.accountId)),
  )
  return readJson(path.join(dataDir, 'hub-accounts.json'), [])
    .filter(
      (account) =>
        rawEmailVerified(account) &&
        rawAccessStatus(account) === 'active' &&
        !['expired', 'terminated', 'rejected'].includes(
          rawMembershipStatus(account),
        ) &&
        enabled.has(String(account.id)) &&
        !suppressed.has(String(account.id)) &&
        accountInScope(account, { ...scope, ids }),
    )
    .map((account) => String(account.id))
}

export function emailAddressHash(email, env = process.env) {
  const secret =
    env.EMAIL_ADDRESS_HASH_SECRET ||
    env.EMAIL_UNSUBSCRIBE_SECRET ||
    'youngo-development-address-hash'
  return createHmac('sha256', secret)
    .update(
      String(email || '')
        .trim()
        .toLowerCase(),
    )
    .digest('hex')
}

export async function suppressAccountEmail({
  accountId,
  email,
  reason,
  providerEventId = null,
}) {
  if (!['hard_bounce', 'complaint', 'manual'].includes(reason))
    throw new Error('Invalid suppression reason.')
  const addressHash = emailAddressHash(email)
  const pool = getPool()
  if (pool) {
    await pool.query(
      `INSERT INTO email_suppressions(account_id,address_hash,reason,provider_event_id)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(account_id) DO UPDATE SET address_hash=EXCLUDED.address_hash,
         reason=EXCLUDED.reason,provider_event_id=EXCLUDED.provider_event_id,
         created_at=now()`,
      [accountId, addressHash, reason, providerEventId],
    )
    return
  }
  const list = readJson(suppressionsPath, [])
  const index = list.findIndex(
    (row) => String(row.accountId) === String(accountId),
  )
  const row = {
    accountId,
    addressHash,
    reason,
    providerEventId,
    createdAt: iso(),
  }
  if (index >= 0) list[index] = row
  else list.push(row)
  writeJson(suppressionsPath, list)
}

export async function listQueuedNotifications() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT * FROM notification_outbox ORDER BY created_at DESC LIMIT 200',
    )
    return rows.map(publicOutbox)
  }
  return readJson(outboxPath, [])
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 200)
    .map(publicOutbox)
}

export async function countSentNotificationsSince(since) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT count(*) AS count FROM notification_outbox
       WHERE status='sent' AND sent_at >= $1`,
      [iso(since)],
    )
    return Number(rows[0]?.count || 0)
  }
  return readJson(outboxPath, []).filter(
    (row) => row.status === 'sent' && new Date(row.sentAt) >= new Date(since),
  ).length
}
