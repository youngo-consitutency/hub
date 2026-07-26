// Lazily create the PostgreSQL pool from DATABASE_URL. Returning null keeps
// fixture mode available. Railway's internal hostname does not require SSL;
// external database proxy connections do.
import pg from 'pg'

let pool = null

export function hasDb() {
  return !!process.env.DATABASE_URL
}

export function databaseSsl(url) {
  const hostname = new URL(url).hostname
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname)
  const isRailwayInternal = hostname.endsWith('.railway.internal')
  return isLocal || isRailwayInternal ? false : { rejectUnauthorized: false }
}

export function getPool() {
  if (pool) return pool
  const url = process.env.DATABASE_URL
  if (!url) return null
  pool = new pg.Pool({
    connectionString: url,
    ssl: databaseSsl(url),
    max: 5,
  })
  return pool
}
