import pg from 'pg'

// Shared pool for modules that bypass the ORM (platform, negotiations,
// binary blobs). Lazily created so builds without DATABASE_URL still work.
let pool: pg.Pool | null = null

export function getPgPool(): pg.Pool | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null
  if (!pool) pool = new pg.Pool({ connectionString })
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
