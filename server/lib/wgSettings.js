import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from './db.js'
import { readJson, writeJson } from './jsonFile.js'

const settingsPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/wg-settings.json',
)

export async function getWgSettings(wgSlug) {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT wg_slug, public_space, updated_at FROM wg_settings WHERE wg_slug = $1',
      [wgSlug],
    )
    const row = rows[0]
    if (!row) return { wgSlug, publicSpace: false, updatedAt: null }
    return {
      wgSlug: row.wg_slug,
      publicSpace: Boolean(row.public_space),
      updatedAt: row.updated_at,
    }
  }
  const row = readJson(settingsPath, []).find((item) => item.wg_slug === wgSlug)
  return {
    wgSlug,
    publicSpace: Boolean(row?.public_space),
    updatedAt: row?.updated_at || null,
  }
}

export async function listWgSettings() {
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      'SELECT wg_slug, public_space, updated_at FROM wg_settings',
    )
    return new Map(
      rows.map((row) => [
        row.wg_slug,
        {
          publicSpace: Boolean(row.public_space),
          updatedAt: row.updated_at,
        },
      ]),
    )
  }
  return new Map(
    readJson(settingsPath, []).map((row) => [
      row.wg_slug,
      {
        publicSpace: Boolean(row.public_space),
        updatedAt: row.updated_at || null,
      },
    ]),
  )
}

export async function setWgPublicSpace(wgSlug, publicSpace, updatedBy) {
  const now = new Date().toISOString()
  const value = Boolean(publicSpace)
  const pool = getPool()
  if (pool) {
    const { rows } = await pool.query(
      `INSERT INTO wg_settings (wg_slug, public_space, updated_by, updated_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (wg_slug) DO UPDATE SET
         public_space=EXCLUDED.public_space,
         updated_by=EXCLUDED.updated_by,
         updated_at=now()
       RETURNING wg_slug, public_space, updated_at`,
      [wgSlug, value, updatedBy || null],
    )
    const row = rows[0]
    return {
      wgSlug: row.wg_slug,
      publicSpace: Boolean(row.public_space),
      updatedAt: row.updated_at,
    }
  }
  const rows = readJson(settingsPath, [])
  const index = rows.findIndex((item) => item.wg_slug === wgSlug)
  const row = {
    wg_slug: wgSlug,
    public_space: value,
    updated_by: updatedBy || null,
    updated_at: now,
  }
  if (index >= 0) rows[index] = row
  else rows.push(row)
  writeJson(settingsPath, rows)
  return { wgSlug, publicSpace: value, updatedAt: now }
}
