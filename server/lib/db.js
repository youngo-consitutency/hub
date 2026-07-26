// Lazily create the PostgreSQL pool from DATABASE_URL. Returning null keeps
// fixture mode available. Railway's internal hostname does not require SSL;
// external database proxy connections do.
import pg from 'pg'

let pool = null

export function hasDb() {
  return !!process.env.DATABASE_URL
}

/**
 * TLS settings for a database connection.
 *
 * Loopback and Railway's private network never leave the host or the project's
 * internal network, so they carry no TLS. Every other connection crosses the
 * public internet and its certificate is verified: set `DATABASE_CA_CERT` to
 * pin the provider's root, or fall back to the system trust store.
 *
 * `DATABASE_SSL_INSECURE=true` disables verification. It exists only for
 * providers whose proxy presents an untrusted certificate; it makes the
 * connection interceptable, so it must never be set in production.
 */
export function databaseSsl(url, env = process.env) {
  const hostname = new URL(url).hostname
  const isLocal = ['localhost', '127.0.0.1', '::1'].includes(hostname)
  const isRailwayInternal = hostname.endsWith('.railway.internal')
  if (isLocal || isRailwayInternal) return false

  const ca = String(env.DATABASE_CA_CERT || '').trim()
  if (ca) return { ca, rejectUnauthorized: true }
  if (String(env.DATABASE_SSL_INSECURE || '') === 'true') {
    console.warn(
      '[db] DATABASE_SSL_INSECURE=true — the database certificate is not being verified.',
    )
    return { rejectUnauthorized: false }
  }
  return { rejectUnauthorized: true }
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
