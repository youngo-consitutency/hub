import pg from 'pg'
import type { Payload, PayloadRequest } from 'payload'
import type { Doc } from './domain'

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

type TransactionID = string | number

// drizzle handle for an open payload tx, so raw sql joins it. a missing
// session means the caller forgot to begin one, fail loud not silently
export function txHandle(payload: Payload, transactionID: TransactionID) {
  const tx = (payload.db as Doc).sessions?.[transactionID]?.db
  if (!tx) throw new Error('This write requires an open database transaction.')
  return tx
}

// Run fn in a payload transaction: joins an open req transaction (its owner
// commits), else begins one and rolls back on throw.
export async function withTransaction<T>(
  req: PayloadRequest,
  fn: (transactionID: TransactionID) => Promise<T>,
): Promise<T> {
  // Payload types the id as possibly a promise; at runtime it is already resolved
  if (req.transactionID != null) return fn(await req.transactionID)
  const transactionID = await req.payload.db.beginTransaction()
  if (transactionID == null) throw new Error('Database transactions are unavailable.')
  req.transactionID = transactionID
  try {
    const result = await fn(transactionID)
    await req.payload.db.commitTransaction(transactionID)
    return result
  } catch (error) {
    await req.payload.db.rollbackTransaction(transactionID)
    throw error
  } finally {
    delete req.transactionID
  }
}

// Unique violations surface as raw 23505 in the cause chain or a converted
// ValidationError (data.collection = slug). Accept both shapes.
interface ErrorNode {
  code?: string
  name?: string
  message?: string
  cause?: ErrorNode | null
  data?: { collection?: string; errors?: { tableName?: string; message?: string }[] }
}

export function isUniqueViolation(error: unknown, collection: string, table: string): boolean {
  let current = error as ErrorNode | null | undefined
  while (current) {
    if (current?.code === '23505') return true
    if (
      current?.name === 'ValidationError' &&
      current?.data?.collection === collection &&
      (current.data.errors || []).some(
        (e) => e?.tableName === table || /unique/i.test(e?.message || ''),
      )
    )
      return true
    current = current.cause === current ? null : current.cause
  }
  return false
}
// Dual-shape rows normalise via src/lib/case.ts — read camelCase after
// `toCamelCase(row)`.
