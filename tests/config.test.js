import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRuntimeConfig, appOrigin } from '../server/lib/config.js'
import { databaseSsl } from '../server/lib/db.js'

test('production requires PostgreSQL and an explicit application origin', () => {
  assert.throws(
    () => validateRuntimeConfig({ NODE_ENV: 'production' }),
    /DATABASE_URL, APP_ORIGIN/,
  )
  assert.doesNotThrow(() =>
    validateRuntimeConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://example.invalid/youngo',
      APP_ORIGIN: 'https://hub.example.org',
    }),
  )
})

test('development keeps an explicit local origin without trusting Host', () => {
  assert.doesNotThrow(() => validateRuntimeConfig({ NODE_ENV: 'development' }))
  assert.equal(appOrigin({ NODE_ENV: 'development' }), 'http://localhost:5173')
  assert.equal(
    appOrigin({ APP_ORIGIN: 'https://hub.example.org/' }),
    'https://hub.example.org',
  )
})

test('database TLS is disabled only for local and Railway-internal connections', () => {
  assert.equal(databaseSsl('postgres://postgres@127.0.0.1:5432/youngo'), false)
  assert.equal(databaseSsl('postgres://postgres@localhost:5432/youngo'), false)
  assert.equal(
    databaseSsl('postgres://postgres@db.railway.internal:5432/youngo'),
    false,
  )
  assert.deepEqual(
    databaseSsl('postgres://postgres@public.proxy.example:5432/youngo', {}),
    { rejectUnauthorized: true },
  )
})

test('a pinned CA certificate is used to verify the database connection', () => {
  assert.deepEqual(
    databaseSsl('postgres://postgres@public.proxy.example:5432/youngo', {
      DATABASE_CA_CERT: '-----BEGIN CERTIFICATE-----abc',
    }),
    { ca: '-----BEGIN CERTIFICATE-----abc', rejectUnauthorized: true },
  )
})

test('certificate verification is skipped only when explicitly opted out', () => {
  assert.deepEqual(
    databaseSsl('postgres://postgres@public.proxy.example:5432/youngo', {
      DATABASE_SSL_INSECURE: 'true',
    }),
    { rejectUnauthorized: false },
  )
  // Anything other than the exact opt-out keeps verification on.
  assert.deepEqual(
    databaseSsl('postgres://postgres@public.proxy.example:5432/youngo', {
      DATABASE_SSL_INSECURE: 'yes',
    }),
    { rejectUnauthorized: true },
  )
})
