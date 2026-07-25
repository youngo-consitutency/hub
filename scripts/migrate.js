// Minimal forward-only migration runner: applies migrations/*.sql in filename order
// inside a transaction each, recording applied files in schema_migrations so re-runs
// are idempotent. Usage: DATABASE_URL=... node scripts/migrate.js
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPool } from '../server/lib/db.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(here, '../migrations')

async function main() {
  const pool = getPool()
  if (!pool) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL is required for production migrations.')
    }
    console.log('migrate: DATABASE_URL not set — skipping (fixture mode)')
    return
  }
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  )
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const file of files) {
    const applied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE name = $1',
      [file],
    )
    if (applied.rowCount) {
      console.log(`skip   ${file}`)
      continue
    }
    const sql = readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`apply  ${file}`)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [
        file,
      ])
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      console.error(`FAILED ${file}: ${err.message}`)
      process.exit(1)
    } finally {
      client.release()
    }
  }
  console.log('migrate: done')

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
