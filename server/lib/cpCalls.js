import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import { readJson, writeJson } from './jsonFile.js'

const slotsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/cp-call-slots.json',
)

function overlaps(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart)
}

function publicSlot(row) {
  if (!row) return null
  return {
    id: row.id,
    hostAccountId: row.host_account_id ?? row.hostAccountId,
    hostLabel: row.host_label ?? row.hostLabel,
    startsAt: row.starts_at ?? row.startsAt,
    endsAt: row.ends_at ?? row.endsAt,
    status: row.status,
    bookedBy: row.booked_by ?? row.bookedBy ?? null,
    bookedAt: row.booked_at ?? row.bookedAt ?? null,
    wgSlug: row.wg_slug ?? row.wgSlug ?? null,
    notes: row.notes ?? null,
  }
}

export async function listOpenSlots() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT * FROM cp_call_slots
        WHERE status = 'open' AND starts_at > now()
        ORDER BY starts_at ASC`,
    )
    return rows.map(publicSlot)
  }
  return readJson(slotsPath, [])
    .filter(
      (row) => row.status === 'open' && new Date(row.starts_at) > new Date(),
    )
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
    .map(publicSlot)
}

export async function listHostSlots(hostAccountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT s.*, a.email AS booked_email, a.name AS booked_name
         FROM cp_call_slots s
         LEFT JOIN hub_accounts a ON a.id = s.booked_by
        WHERE s.host_account_id = $1 AND s.status <> 'cancelled'
        ORDER BY s.starts_at ASC`,
      [hostAccountId],
    )
    return rows.map((row) => ({
      ...publicSlot(row),
      bookedEmail: row.booked_email || null,
      bookedName: row.booked_name || null,
    }))
  }
  return readJson(slotsPath, [])
    .filter(
      (row) =>
        row.host_account_id === hostAccountId && row.status !== 'cancelled',
    )
    .map(publicSlot)
}

export async function listAllSlotsForAdmin() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT s.*, a.email AS booked_email, a.name AS booked_name
         FROM cp_call_slots s
         LEFT JOIN hub_accounts a ON a.id = s.booked_by
        WHERE s.status <> 'cancelled'
        ORDER BY s.starts_at ASC`,
    )
    return rows.map((row) => ({
      ...publicSlot(row),
      bookedEmail: row.booked_email || null,
      bookedName: row.booked_name || null,
    }))
  }
  return readJson(slotsPath, [])
    .filter((row) => row.status !== 'cancelled')
    .map(publicSlot)
}

export async function findBookingForAccount(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `SELECT * FROM cp_call_slots
        WHERE booked_by = $1 AND status = 'booked' AND starts_at > now()
        ORDER BY starts_at ASC
        LIMIT 1`,
      [accountId],
    )
    return publicSlot(rows[0] || null)
  }
  const row = readJson(slotsPath, []).find(
    (item) =>
      item.booked_by === accountId &&
      item.status === 'booked' &&
      new Date(item.starts_at) > new Date(),
  )
  return publicSlot(row || null)
}

export async function createSlot({
  hostAccountId,
  hostLabel,
  startsAt,
  endsAt,
}) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const err = new Error('Need a valid start and end time.')
    err.code = 'validation'
    throw err
  }
  if (end <= start) {
    const err = new Error('The slot has to end after it starts.')
    err.code = 'validation'
    throw err
  }
  const label =
    String(hostLabel || '')
      .trim()
      .slice(0, 40) || 'Host'
  const pool = getPool()
  if (pool) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO cp_call_slots
           (host_account_id, host_label, starts_at, ends_at, status)
         VALUES ($1,$2,$3,$4,'open')
         RETURNING *`,
        [hostAccountId, label, start.toISOString(), end.toISOString()],
      )
      return publicSlot(rows[0])
    } catch (error) {
      if (error.code === '23505') {
        const err = new Error('That time is already listed.')
        err.code = 'conflict'
        throw err
      }
      throw error
    }
  }
  const list = readJson(slotsPath, [])
  if (
    list.some(
      (row) =>
        row.host_account_id === hostAccountId &&
        row.starts_at === start.toISOString() &&
        row.status !== 'cancelled',
    )
  ) {
    const err = new Error('That time is already listed.')
    err.code = 'conflict'
    throw err
  }
  const row = {
    id: randomUUID(),
    host_account_id: hostAccountId,
    host_label: label,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: 'open',
    booked_by: null,
    booked_at: null,
    wg_slug: null,
    notes: null,
    created_at: new Date().toISOString(),
  }
  list.push(row)
  writeJson(slotsPath, list)
  return publicSlot(row)
}

export async function cancelSlot(id, hostAccountId, isAdmin) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE cp_call_slots
          SET status = 'cancelled'
        WHERE id = $1
          AND status <> 'cancelled'
          AND ($2 OR host_account_id = $3)
        RETURNING *`,
      [id, Boolean(isAdmin), hostAccountId],
    )
    return publicSlot(rows[0] || null)
  }
  const list = readJson(slotsPath, [])
  const row = list.find((item) => item.id === id)
  if (!row || row.status === 'cancelled') return null
  if (!isAdmin && row.host_account_id !== hostAccountId) return null
  row.status = 'cancelled'
  writeJson(slotsPath, list)
  return publicSlot(row)
}

export async function bookSlot({ slotId, accountId, wgSlug, notes }) {
  const existing = await findBookingForAccount(accountId)
  if (existing) {
    const err = new Error(
      'You already have a call booked. Cancel it first if you need a different time.',
    )
    err.code = 'conflict'
    throw err
  }
  const pool = getPool()
  if (pool) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query(
        `SELECT * FROM cp_call_slots
          WHERE id = $1 AND status = 'open' AND starts_at > now()
          FOR UPDATE`,
        [slotId],
      )
      if (!rows[0]) {
        const err = new Error('That slot is no longer available.')
        err.code = 'conflict'
        throw err
      }
      const { rows: booked } = await client.query(
        `UPDATE cp_call_slots
            SET status = 'booked',
                booked_by = $2,
                booked_at = now(),
                wg_slug = $3,
                notes = $4
          WHERE id = $1
          RETURNING *`,
        [slotId, accountId, wgSlug || null, notes || null],
      )
      await client.query('COMMIT')
      return publicSlot(booked[0])
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  const list = readJson(slotsPath, [])
  const row = list.find((item) => item.id === slotId)
  if (!row || row.status !== 'open' || new Date(row.starts_at) <= new Date()) {
    const err = new Error('That slot is no longer available.')
    err.code = 'conflict'
    throw err
  }
  row.status = 'booked'
  row.booked_by = accountId
  row.booked_at = new Date().toISOString()
  row.wg_slug = wgSlug || null
  row.notes = notes || null
  writeJson(slotsPath, list)
  return publicSlot(row)
}

export async function releaseBooking(accountId) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `UPDATE cp_call_slots
          SET status = 'open',
              booked_by = NULL,
              booked_at = NULL,
              wg_slug = NULL,
              notes = NULL
        WHERE booked_by = $1 AND status = 'booked' AND starts_at > now()
        RETURNING *`,
      [accountId],
    )
    return rows.map(publicSlot)
  }
  const list = readJson(slotsPath, [])
  const released = []
  for (const row of list) {
    if (
      row.booked_by === accountId &&
      row.status === 'booked' &&
      new Date(row.starts_at) > new Date()
    ) {
      row.status = 'open'
      row.booked_by = null
      row.booked_at = null
      row.wg_slug = null
      row.notes = null
      released.push(publicSlot(row))
    }
  }
  writeJson(slotsPath, list)
  return released
}

export { overlaps }
