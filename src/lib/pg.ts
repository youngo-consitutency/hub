import pg from 'pg'

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
    const error = new Error('A database connection is required for this feature.') as any
    error.status = 503
    error.code = 'database_required'
    throw error
  }
  return found
}

// A unique-constraint violation surfaces two ways through Payload's drizzle
// adapter: the raw PostgreSQL 23505 somewhere in the cause chain, or a
// converted ValidationError (data.collection = collection slug). The field
// errors carry tableName when the constraint maps to a column, or only a
// 'must be unique' message when it does not — accept both.
export function isUniqueViolation(error: any, collection: string, table: string): boolean {
  let current: any = error
  while (current) {
    if (current?.code === '23505') return true
    if (
      current?.name === 'ValidationError' &&
      current?.data?.collection === collection &&
      (current.data.errors || []).some(
        (e: any) => e?.tableName === table || /unique/i.test(e?.message || ''),
      )
    )
      return true
    current = current.cause === current ? null : current.cause
  }
  return false
}
// Dual-shape rows (snake_case from raw SQL, camelCase from Payload docs) are
// normalised once at the boundary via src/lib/case.ts — read canonical
// camelCase fields after `toCamelCase(row)`.
