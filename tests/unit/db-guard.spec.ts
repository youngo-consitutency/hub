import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertTestDatabase } from '../dbGuard'

const url = (db: string) => `postgres://postgres:postgres@localhost:5433/${db}`

describe('test database guard', () => {
  // the documented ALLOW_TEST_DB=1 override would make every refusal below pass silently
  beforeEach(() => vi.stubEnv('ALLOW_TEST_DB', '0'))
  afterEach(() => vi.unstubAllEnvs())

  it('lets the documented override through', () => {
    vi.stubEnv('ALLOW_TEST_DB', '1')
    expect(() => assertTestDatabase(url('youngo_dev'))).not.toThrow()
  })

  it.each(['youngo_ci', 'youngo_smoke', 'youngo_test', 'youngo_design', 'scratch'])(
    'allows the disposable database %s',
    (db) => expect(() => assertTestDatabase(url(db))).not.toThrow(),
  )

  it.each(['youngo_dev', 'hub', 'production', 'youngo_testing'])(
    'refuses %s, which may hold real data',
    (db) => expect(() => assertTestDatabase(url(db))).toThrow(/Refusing to run tests/),
  )

  it('refuses a missing or malformed URL', () => {
    expect(() => assertTestDatabase('')).toThrow(/disposable database/)
  })
})
