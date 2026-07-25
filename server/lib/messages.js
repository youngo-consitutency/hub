import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { getPool } from './db.js'
import { findAccountById, publicAccount } from './accounts.js'
import { getAccessProfile } from './access.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '../../data')
const accountsPath = path.join(dataDir, 'hub-accounts.json')
const progressPath = path.join(dataDir, 'wg-progress.json')
const conversationsPath = path.join(dataDir, 'message-conversations.json')
const messagesPath = path.join(dataDir, 'messages.json')

const MANDATE_ROLES = new Set([
  'focal_point',
  'wg_contact',
  'ngo_admin',
  'admin',
])
const WG_MANDATE_ROLES = new Set(['contact', 'lead'])
const MAX_BODY = 4000

function readJson(file, fallback) {
  try {
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    /* empty */
  }
  return fallback
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data, null, 2))
}

function normalizePair(a, b) {
  return [String(a), String(b)].sort()
}

function normalizeConversation(row) {
  if (!row) return null
  return {
    id: row.id,
    participantA: row.participant_a ?? row.participantA,
    participantB: row.participant_b ?? row.participantB,
    createdBy: row.created_by ?? row.createdBy,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    lastMessageAt:
      row.last_message_at ??
      row.lastMessageAt ??
      row.updated_at ??
      row.updatedAt,
    lastMessagePreview:
      row.last_message_preview ?? row.lastMessagePreview ?? null,
    otherParticipant:
      row.otherParticipant ||
      participantSummary(row.other_participant || row.otherParticipantRow),
  }
}

function normalizeMessage(row) {
  if (!row) return null
  return {
    id: row.id,
    conversationId: row.conversation_id ?? row.conversationId,
    senderAccountId: row.sender_account_id ?? row.senderAccountId,
    body: row.body,
    createdAt: row.created_at ?? row.createdAt,
    sender: row.sender || participantSummary(row.sender_row || row.senderRow),
  }
}

function participantSummary(row, mandate = null) {
  if (!row) return null
  const account = publicAccount(row)
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    organizationName: account.organizationName,
    country: account.country,
    isMandateHolder: mandate ?? Boolean(MANDATE_ROLES.has(account.role)),
  }
}

function cleanBody(body) {
  const text = String(body || '').trim()
  if (!text) {
    const err = new Error('Message body is required.')
    err.code = 'validation'
    throw err
  }
  if (text.length > MAX_BODY) {
    const err = new Error(`Message must be ${MAX_BODY} characters or fewer.`)
    err.code = 'validation'
    throw err
  }
  return text
}

export async function getMandateProfile(accountId) {
  const row = await findAccountById(accountId)
  if (!row) return null
  const account = publicAccount(row)
  const access = await getAccessProfile(account)
  const mandates = []
  if (MANDATE_ROLES.has(account.role))
    mandates.push({ type: 'platform', role: account.role })
  mandates.push(...access.teamRoles.map((role) => ({ type: 'team', role })))

  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT wg_slug, role_in_wg
       FROM wg_workspace_progress
       WHERE account_id = $1 AND status = 'active' AND role_in_wg IN ('contact', 'lead')
       ORDER BY wg_slug`,
      [account.id],
    )
    mandates.push(
      ...rows.map((r) => ({
        type: 'wg',
        wgSlug: r.wg_slug,
        role: r.role_in_wg,
      })),
    )
  } else {
    const progress = readJson(progressPath, [])
    mandates.push(
      ...progress
        .filter(
          (p) =>
            p.account_id === account.id &&
            p.status === 'active' &&
            WG_MANDATE_ROLES.has(p.role_in_wg),
        )
        .map((p) => ({ type: 'wg', wgSlug: p.wg_slug, role: p.role_in_wg })),
    )
  }

  return {
    account,
    isMandateHolder: access.isMandateHolder,
    mandates,
  }
}

export async function canStartConversation(senderId, recipientId) {
  if (String(senderId) === String(recipientId))
    return { ok: false, code: 'self_message' }
  const [sender, recipient] = await Promise.all([
    getMandateProfile(senderId),
    getMandateProfile(recipientId),
  ])
  if (!sender?.account || !recipient?.account)
    return { ok: false, code: 'not_found' }
  if (!sender.account.isVerified)
    return { ok: false, code: 'sender_unverified' }
  if (!recipient.account.isVerified)
    return { ok: false, code: 'recipient_unverified' }
  if (recipient.isMandateHolder) {
    return { ok: true, sender, recipient }
  }
  return { ok: false, code: 'recipient_not_mandate_holder', sender, recipient }
}

export async function listMessageContacts(accountId, { q = '' } = {}) {
  const requester = await getMandateProfile(accountId)
  if (!requester?.account) return []
  const needle = String(q || '')
    .trim()
    .toLowerCase()
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `WITH wg_mandates AS (
         SELECT account_id, jsonb_agg(jsonb_build_object('type','wg','wgSlug',wg_slug,'role',role_in_wg) ORDER BY wg_slug) AS mandates
         FROM wg_workspace_progress
         WHERE status = 'active' AND role_in_wg IN ('contact', 'lead')
         GROUP BY account_id
       )
       SELECT a.id, a.name, a.email, a.first_name, a.last_name, a.entity_type, a.organization_name,
              a.organization_type, a.is_unfccc_admitted, a.member_status, a.role, a.team_roles, a.country,
              a.created_at, COALESCE(w.mandates, '[]'::jsonb) AS wg_mandates
       FROM hub_accounts a
       LEFT JOIN wg_mandates w ON w.account_id = a.id
       WHERE a.id != $1
         AND (a.member_status = 'verified' OR a.role IN ('admin', 'focal_point'))
         AND (a.role IN ('focal_point','wg_contact','ngo_admin','admin') OR cardinality(a.team_roles) > 0 OR w.account_id IS NOT NULL)
         AND ($2 = '' OR lower(a.name) LIKE '%' || $2 || '%' OR lower(a.email) LIKE '%' || $2 || '%'
              OR lower(COALESCE(a.organization_name, '')) LIKE '%' || $2 || '%')
       ORDER BY a.name ASC
       LIMIT 100`,
      [accountId, needle],
    )
    return rows.map((r) => ({
      ...participantSummary(r, true),
      email: r.email,
      mandates: [
        ...(MANDATE_ROLES.has(r.role)
          ? [{ type: 'platform', role: r.role }]
          : []),
        ...(r.team_roles || []).map((role) => ({ type: 'team', role })),
        ...(Array.isArray(r.wg_mandates) ? r.wg_mandates : []),
      ],
    }))
  }

  const accounts = readJson(accountsPath, [])
  const progress = readJson(progressPath, [])
  return accounts
    .map((row) => {
      const account = publicAccount(row)
      const wgMandates = progress
        .filter(
          (p) =>
            p.account_id === account.id &&
            p.status === 'active' &&
            WG_MANDATE_ROLES.has(p.role_in_wg),
        )
        .map((p) => ({ type: 'wg', wgSlug: p.wg_slug, role: p.role_in_wg }))
      const mandates = [
        ...(MANDATE_ROLES.has(account.role)
          ? [{ type: 'platform', role: account.role }]
          : []),
        ...(account.teamRoles || []).map((role) => ({ type: 'team', role })),
        ...wgMandates,
      ]
      return { row, account, mandates }
    })
    .filter(
      ({ account, mandates }) =>
        account.id !== accountId && account.isVerified && mandates.length > 0,
    )
    .filter(({ account }) => {
      if (!needle) return true
      return [account.name, account.email, account.organizationName].some((v) =>
        String(v || '')
          .toLowerCase()
          .includes(needle),
      )
    })
    .sort((a, b) =>
      String(a.account.name).localeCompare(String(b.account.name)),
    )
    .slice(0, 100)
    .map(({ row, mandates }) => ({
      ...participantSummary(row, true),
      email: row.email,
      mandates,
    }))
}

export async function findOrCreateConversation(senderId, recipientId) {
  const allowed = await canStartConversation(senderId, recipientId)
  if (!allowed.ok) return allowed
  const [participantA, participantB] = normalizePair(senderId, recipientId)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO message_conversations (participant_a, participant_b, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (participant_a, participant_b)
       DO UPDATE SET updated_at = message_conversations.updated_at
       RETURNING *`,
      [participantA, participantB, senderId],
    )
    return {
      ok: true,
      conversation: normalizeConversation(rows[0]),
      sender: allowed.sender,
      recipient: allowed.recipient,
    }
  }
  const list = readJson(conversationsPath, [])
  let row = list.find(
    (c) => c.participant_a === participantA && c.participant_b === participantB,
  )
  if (!row) {
    row = {
      id: randomUUID(),
      participant_a: participantA,
      participant_b: participantB,
      created_by: senderId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_message_at: null,
      last_message_preview: null,
    }
    list.push(row)
    writeJson(conversationsPath, list)
  }
  return {
    ok: true,
    conversation: normalizeConversation(row),
    sender: allowed.sender,
    recipient: allowed.recipient,
  }
}

export async function listConversations(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT c.*,
              other_a.id AS other_id, other_a.email AS other_email, other_a.name AS other_name,
              other_a.first_name AS other_first_name, other_a.last_name AS other_last_name,
              other_a.entity_type AS other_entity_type, other_a.organization_name AS other_organization_name,
              other_a.organization_type AS other_organization_type, other_a.is_unfccc_admitted AS other_is_unfccc_admitted,
              other_a.member_status AS other_member_status, other_a.role AS other_role,
              other_a.country AS other_country, other_a.created_at AS other_created_at
       FROM message_conversations c
       JOIN hub_accounts other_a ON other_a.id = CASE WHEN c.participant_a = $1 THEN c.participant_b ELSE c.participant_a END
       WHERE c.participant_a = $1 OR c.participant_b = $1
       ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC
       LIMIT 100`,
      [accountId],
    )
    return rows.map((r) =>
      normalizeConversation({
        ...r,
        other_participant: {
          id: r.other_id,
          email: r.other_email,
          name: r.other_name,
          first_name: r.other_first_name,
          last_name: r.other_last_name,
          entity_type: r.other_entity_type,
          organization_name: r.other_organization_name,
          organization_type: r.other_organization_type,
          is_unfccc_admitted: r.other_is_unfccc_admitted,
          member_status: r.other_member_status,
          role: r.other_role,
          country: r.other_country,
          created_at: r.other_created_at,
        },
      }),
    )
  }
  const conversations = readJson(conversationsPath, [])
  const accounts = readJson(accountsPath, [])
  return conversations
    .filter(
      (c) => c.participant_a === accountId || c.participant_b === accountId,
    )
    .sort((a, b) =>
      String(b.last_message_at || b.updated_at).localeCompare(
        String(a.last_message_at || a.updated_at),
      ),
    )
    .slice(0, 100)
    .map((c) => {
      const otherId =
        c.participant_a === accountId ? c.participant_b : c.participant_a
      const otherParticipantRow = accounts.find((a) => a.id === otherId)
      return normalizeConversation({ ...c, otherParticipantRow })
    })
}

export async function getConversationForParticipant(conversationId, accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT * FROM message_conversations
       WHERE id = $1 AND (participant_a = $2 OR participant_b = $2)
       LIMIT 1`,
      [conversationId, accountId],
    )
    return normalizeConversation(rows[0] || null)
  }
  const row = readJson(conversationsPath, []).find(
    (c) =>
      c.id === conversationId &&
      (c.participant_a === accountId || c.participant_b === accountId),
  )
  return normalizeConversation(row || null)
}

export async function listMessages(conversationId, accountId) {
  const conversation = await getConversationForParticipant(
    conversationId,
    accountId,
  )
  if (!conversation) return null
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `WITH recent AS (
         SELECT *
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT 200
       )
       SELECT m.*, a.id AS sender_id, a.email AS sender_email, a.name AS sender_name,
              a.first_name AS sender_first_name, a.last_name AS sender_last_name,
              a.entity_type AS sender_entity_type, a.organization_name AS sender_organization_name,
              a.organization_type AS sender_organization_type, a.is_unfccc_admitted AS sender_is_unfccc_admitted,
              a.member_status AS sender_member_status, a.role AS sender_role,
              a.country AS sender_country, a.created_at AS sender_created_at
       FROM recent m
       JOIN hub_accounts a ON a.id = m.sender_account_id
       ORDER BY m.created_at ASC`,
      [conversationId],
    )
    return {
      conversation,
      items: rows.map((r) =>
        normalizeMessage({
          ...r,
          sender_row: {
            id: r.sender_id,
            email: r.sender_email,
            name: r.sender_name,
            first_name: r.sender_first_name,
            last_name: r.sender_last_name,
            entity_type: r.sender_entity_type,
            organization_name: r.sender_organization_name,
            organization_type: r.sender_organization_type,
            is_unfccc_admitted: r.sender_is_unfccc_admitted,
            member_status: r.sender_member_status,
            role: r.sender_role,
            country: r.sender_country,
            created_at: r.sender_created_at,
          },
        }),
      ),
    }
  }
  const messages = readJson(messagesPath, [])
  const accounts = readJson(accountsPath, [])
  return {
    conversation,
    items: messages
      .filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(-200)
      .map((m) =>
        normalizeMessage({
          ...m,
          senderRow: accounts.find((a) => a.id === m.sender_account_id),
        }),
      ),
  }
}

export async function addMessage(conversationId, senderId, body) {
  const conversation = await getConversationForParticipant(
    conversationId,
    senderId,
  )
  if (!conversation) return null
  const text = cleanBody(body)
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `INSERT INTO messages (conversation_id, sender_account_id, body)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [conversationId, senderId, text],
      )
      await client.query(
        `UPDATE message_conversations
         SET last_message_at = $2, last_message_preview = $3, updated_at = $2
         WHERE id = $1`,
        [conversationId, rows[0].created_at, text.slice(0, 180)],
      )
      await client.query('COMMIT')
      return normalizeMessage(rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
  const messages = readJson(messagesPath, [])
  const row = {
    id: randomUUID(),
    conversation_id: conversationId,
    sender_account_id: senderId,
    body: text,
    created_at: new Date().toISOString(),
  }
  messages.push(row)
  writeJson(messagesPath, messages)

  const conversations = readJson(conversationsPath, [])
  const idx = conversations.findIndex((c) => c.id === conversationId)
  if (idx >= 0) {
    conversations[idx].last_message_at = row.created_at
    conversations[idx].last_message_preview = text.slice(0, 180)
    conversations[idx].updated_at = row.created_at
    writeJson(conversationsPath, conversations)
  }
  return normalizeMessage(row)
}
