// Postgres pool, lazily created from DATABASE_URL. Returns null in fixture mode so
// the store can branch (tasks.md 2.5). Railway's internal host needs no SSL; the
// public proxy host does.
import pg from 'pg'

let pool = null

export function hasDb() {
  return !!process.env.DATABASE_URL
}

export function getPool() {
  if (pool) return pool
  const url = process.env.DATABASE_URL
  if (!url) return null
  const isInternal = url.includes('.railway.internal')
  pool = new pg.Pool({
    connectionString: url,
    ssl: isInternal ? false : { rejectUnauthorized: false },
    max: 5,
  })
  return pool
}
