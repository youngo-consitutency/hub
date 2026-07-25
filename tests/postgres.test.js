import test from 'node:test'
import assert from 'node:assert/strict'
import { readdir } from 'node:fs/promises'
import pg from 'pg'

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

test('PostgreSQL migrations produce the security-critical schema', {
  skip: databaseUrl ? false : 'DATABASE_URL is not set',
}, async (t) => {
  const pool = new pg.Pool({ connectionString: databaseUrl })
  t.after(() => pool.end())

  const migrationFiles = (await readdir(new URL('../migrations/', import.meta.url)))
    .filter((file) => file.endsWith('.sql'))
    .sort()
  const applied = await pool.query(
    'SELECT name FROM schema_migrations ORDER BY name',
  )
  assert.deepEqual(applied.rows.map((row) => row.name), migrationFiles)

  const columns = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (
         (table_name = 'hub_accounts' AND column_name IN ('password_hash', 'password_salt', 'role', 'member_status'))
         OR (table_name = 'hub_sessions' AND column_name IN ('token', 'expires_at'))
         OR (table_name = 'password_reset_tokens' AND column_name IN ('token_hash', 'expires_at', 'used_at'))
         OR (table_name = 'ngo_seats' AND column_name IN ('invite_token_hash', 'invite_expires_at', 'seat_role', 'status'))
       )`,
  )
  const actualColumns = new Set(
    columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
  )
  const requiredColumns = [
    'hub_accounts.password_hash',
    'hub_accounts.password_salt',
    'hub_accounts.role',
    'hub_accounts.member_status',
    'hub_sessions.token',
    'hub_sessions.expires_at',
    'password_reset_tokens.token_hash',
    'password_reset_tokens.expires_at',
    'password_reset_tokens.used_at',
    'ngo_seats.invite_token_hash',
    'ngo_seats.invite_expires_at',
    'ngo_seats.seat_role',
    'ngo_seats.status',
  ]
  for (const column of requiredColumns) {
    assert.ok(actualColumns.has(column), `missing migrated column: ${column}`)
  }

  const indexes = await pool.query(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname IN (
         'idx_ngo_seats_invite_hash',
         'idx_ngo_seats_active_member',
         'password_reset_tokens_token_hash_key'
       )`,
  )
  assert.deepEqual(
    new Set(indexes.rows.map((row) => row.indexname)),
    new Set([
      'idx_ngo_seats_invite_hash',
      'idx_ngo_seats_active_member',
      'password_reset_tokens_token_hash_key',
    ]),
  )
})
