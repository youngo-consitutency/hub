import { describe, expect, it } from 'vitest'
import { assertTestDatabase } from '../dbGuard'

const url = (db: string) => `postgres://postgres:postgres@localhost:5433/${db}`

describe('test database guard', () => {
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
