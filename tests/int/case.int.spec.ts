import { describe, expect, it } from 'vitest'
import { toCamelCase, toCamelCaseRows } from '../../src/lib/case'

describe('toCamelCase row normalisation', () => {
  it('converts snake_case keys and preserves values verbatim', () => {
    const row = toCamelCase<any>({
      account_id: 'a1',
      first_name: 'Name',
      created_at: '2026-01-01T00:00:00Z',
      is_verified: false,
      score: 0,
      note: null,
    })
    expect(row).toEqual({
      accountId: 'a1',
      firstName: 'Name',
      createdAt: '2026-01-01T00:00:00Z',
      isVerified: false,
      score: 0,
      note: null,
    })
  })

  it('leaves camelCase keys and underscore-prefixed internals untouched', () => {
    const row = toCamelCase<any>({ displayName: 'X', _order: 2, _parent_id: 'p' })
    expect(row).toEqual({ displayName: 'X', _order: 2, _parent_id: 'p' })
  })

  it('is null-safe and handles empty rows', () => {
    expect(toCamelCase<any>(null)).toEqual({})
    expect(toCamelCase<any>(undefined)).toEqual({})
    expect(toCamelCase<any>({})).toEqual({})
  })

  it('keeps dual spellings readable — explicit ?? resolves precedence', () => {
    const row = toCamelCase<any>({ review_note: 'snake', reviewerNote: 'camel' })
    expect(row.reviewNote).toBe('snake')
    expect(row.reviewerNote).toBe('camel')
  })

  it('does not recurse into nested values', () => {
    const row = toCamelCase<any>({ meta_json: { inner_key: 'v' } })
    expect(row.metaJson).toEqual({ inner_key: 'v' })
  })

  it('keeps the populated value when spellings collide — camel then snake', () => {
    const row = toCamelCase<any>({ firstName: 'Ada', first_name: null })
    expect(row.firstName).toBe('Ada')
  })

  it('keeps the populated value when spellings collide — snake then camel', () => {
    const row = toCamelCase<any>({ first_name: null, firstName: 'Ada' })
    expect(row.firstName).toBe('Ada')
    expect(toCamelCase<any>({ first_name: 'Ada', firstName: null }).firstName).toBe('Ada')
  })
})

describe('toCamelCaseRows', () => {
  it('maps every row', () => {
    const rows = toCamelCaseRows<any>([{ a_b: 1 }, { a_b: 2 }])
    expect(rows).toEqual([{ aB: 1 }, { aB: 2 }])
  })
})
