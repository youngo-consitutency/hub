import { afterEach, describe, expect, it } from 'vitest'

import { databaseSsl } from '../../src/lib/dbSsl'

describe('databaseSsl', () => {
  const original = process.env.DATABASE_CA
  afterEach(() => {
    if (original === undefined) delete process.env.DATABASE_CA
    else process.env.DATABASE_CA = original
  })

  it('leaves TLS to the connection string when no CA is set', () => {
    delete process.env.DATABASE_CA
    expect(databaseSsl()).toBeUndefined()
  })

  it('trusts the configured CA', () => {
    process.env.DATABASE_CA = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'
    expect(databaseSsl()).toEqual({ ca: process.env.DATABASE_CA })
  })
})
