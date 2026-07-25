import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRuntimeConfig, appOrigin } from '../server/lib/config.js'

test('production requires PostgreSQL and an explicit application origin', () => {
  assert.throws(
    () => validateRuntimeConfig({ NODE_ENV: 'production' }),
    /DATABASE_URL, APP_ORIGIN/,
  )
  assert.doesNotThrow(() => validateRuntimeConfig({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://example.invalid/youngo',
    APP_ORIGIN: 'https://hub.example.org',
  }))
})

test('development keeps an explicit local origin without trusting Host', () => {
  assert.doesNotThrow(() => validateRuntimeConfig({ NODE_ENV: 'development' }))
  assert.equal(appOrigin({ NODE_ENV: 'development' }), 'http://localhost:5173')
  assert.equal(appOrigin({ APP_ORIGIN: 'https://hub.example.org/' }), 'https://hub.example.org')
})

