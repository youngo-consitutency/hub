import pg from 'pg'
import { describe, expect, it } from 'vitest'

import { databaseConnection } from '../../src/lib/dbSsl'

const CA = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'
const BASE = 'postgres://user:p%40ss@db.example.com:6543/postgres'

/** What node-postgres will actually use for TLS once it has merged the URL into the options. */
// connectionParameters is real but not in the published types
const sslOf = (config: object) =>
  (new pg.Client(config) as unknown as { connectionParameters: { ssl: unknown } })
    .connectionParameters.ssl

describe('databaseConnection', () => {
  it('uses the URL untouched when no CA is set', () => {
    expect(databaseConnection(`${BASE}?sslmode=require`, undefined)).toEqual({
      connectionString: `${BASE}?sslmode=require`,
    })
  })

  it('has no connection string to adjust when DATABASE_URL is unset', () => {
    expect(databaseConnection('', CA)).toEqual({ connectionString: '' })
  })

  it('pins the CA for a URL with no query', () => {
    expect(databaseConnection(BASE, CA)).toEqual({ connectionString: BASE, ssl: { ca: CA } })
  })

  it('removes ssl settings from the URL but keeps every other parameter and the credentials', () => {
    const { connectionString, ssl } = databaseConnection(
      `${BASE}?sslmode=require&connect_timeout=10&sslrootcert=x&uselibpqcompat=true&application_name=hub`,
      CA,
    )
    expect(connectionString).toBe(`${BASE}?connect_timeout=10&application_name=hub`)
    expect(ssl).toEqual({ ca: CA })
  })

  it('drops the query string entirely when only ssl settings were in it', () => {
    expect(databaseConnection(`${BASE}?sslmode=verify-full`, CA).connectionString).toBe(BASE)
  })

  // node-postgres replaces the `ssl` option with whatever the URL says, which is how the pinned
  // certificate went missing and production builds failed with "self-signed certificate in chain"
  it('documents the pg behaviour this guards against', () => {
    const ssl = sslOf({ connectionString: `${BASE}?sslmode=require`, ssl: { ca: CA } })
    expect(ssl).not.toHaveProperty('ca')
  })

  it.each(['require', 'prefer', 'verify-ca', 'verify-full', 'disable'])(
    'keeps the pinned CA and TLS on for sslmode=%s',
    (mode) => {
      const ssl = sslOf(databaseConnection(`${BASE}?sslmode=${mode}`, CA))
      expect(ssl).toMatchObject({ ca: CA })
    },
  )
})
