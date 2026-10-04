import pg from 'pg'
import type { Doc, AnyValue } from './domain'

// Shared pool for modules that bypass the ORM (platform, negotiations,
// binary blobs). Lazily created so builds without DATABASE_URL still work.
let pool: pg.Pool | null = null

export function getPgPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null
  if (!pool)
    pool = new pg.Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // TCP keepalive so idle connections survive proxies and Neon suspends.
      keepAlive: true,
    })
  return pool
}

export function requirePgPool(): pg.Pool {
  const found = getPgPool()
  if (!found) {
    const error = new Error('A database connection is required for this feature.') as Doc
    error.status = 503
    error.code = 'database_required'
    throw error
  }
  return found
}

// Unique violations surface as raw 23505 in the cause chain or a converted
// ValidationError (data.collection = slug). Accept both shapes.
export function isUniqueViolation(error: AnyValue, collection: string, table: string): boolean {
  let current: AnyValue = error
  while (current) {
    if (current?.code === '23505') return true
    if (
      current?.name === 'ValidationError' &&
      current?.data?.collection === collection &&
      (current.data.errors || []).some(
        (e: AnyValue) => e?.tableName === table || /unique/i.test(e?.message || ''),
      )
    )
      return true
    current = current.cause === current ? null : current.cause
  }
  return false
}
// Dual-shape rows normalise via src/lib/case.ts — read camelCase after
// `toCamelCase(row)`.
