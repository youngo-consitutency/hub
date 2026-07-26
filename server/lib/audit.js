import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'

const auditPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/governance-audit.json',
)

export async function recordAudit({
  actorId,
  action,
  targetType,
  targetId,
  before = null,
  after = null,
  reason = null,
  requestId = null,
}) {
  const entry = {
    actorId,
    action,
    targetType,
    targetId: targetId ? String(targetId) : null,
    before,
    after,
    reason,
    requestId,
    createdAt: new Date().toISOString(),
  }
  const pool = getPool()
  if (pool) {
    await pool.query(
      `INSERT INTO governance_audit(actor_id, action, target_type, target_id, before_data, after_data, reason, request_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        actorId || null,
        action,
        targetType,
        entry.targetId,
        before,
        after,
        reason,
        requestId,
      ],
    )
    return entry
  }
  let list = []
  try {
    if (existsSync(auditPath))
      list = JSON.parse(readFileSync(auditPath, 'utf8'))
  } catch {
    list = []
  }
  list.unshift(entry)
  mkdirSync(path.dirname(auditPath), { recursive: true })
  writeFileSync(auditPath, JSON.stringify(list.slice(0, 2000), null, 2))
  return entry
}

export async function listAudit({ limit = 200, targetType = null } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT g.*, a.email AS actor_email, a.name AS actor_name
       FROM governance_audit g LEFT JOIN hub_accounts a ON a.id=g.actor_id
       WHERE ($1::text IS NULL OR g.target_type=$1)
       ORDER BY g.created_at DESC LIMIT $2`,
      [targetType, safeLimit],
    )
    return rows
  }
  let list = []
  try {
    if (existsSync(auditPath))
      list = JSON.parse(readFileSync(auditPath, 'utf8'))
  } catch {
    list = []
  }
  return list
    .filter((item) => !targetType || item.targetType === targetType)
    .slice(0, safeLimit)
}
