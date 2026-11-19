import { describe, expect, it } from 'vitest'
import { mergeAccount, withoutAccess } from '../../src/member/lib/accountState'
import type { Account } from '../../src/member/lib/types'

// these tests only exercise the merge rules, so a partial account stands in for a full one
const acct = (partial: Record<string, unknown>) => partial as unknown as Account

const access = { ngo: null }

describe('account state', () => {
  it('keeps loaded access across a bare refresh of the same account', () => {
    const next = mergeAccount(acct({ id: 1, access }), acct({ id: 1, name: 'A' }))
    expect(next).toEqual({ id: 1, name: 'A', access })
  })

  it('keeps a failed access check so the retry stays reachable', () => {
    const next = mergeAccount(acct({ id: 1, accessFailed: true }), acct({ id: 1, name: 'A' }))
    expect(next).toEqual({ id: 1, name: 'A', accessFailed: true })
  })

  it('never carries access across accounts, or past an explicit one', () => {
    expect(mergeAccount(acct({ id: 1, access }), acct({ id: 2 }))).toEqual({ id: 2 })
    expect(mergeAccount(acct({ id: 1, access }), acct({ id: 1, access: { ngo: true } }))).toEqual({
      id: 1,
      access: { ngo: true },
    })
    expect(mergeAccount(acct({ id: 1, access }), null)).toBeNull()
    expect(mergeAccount(null, acct({ id: 1 }))).toEqual({ id: 1 })
  })

  it('drops stale access on reload and clears the failure flag', () => {
    expect(withoutAccess(acct({ id: 1, access, accessFailed: true }))).toEqual({
      id: 1,
      accessFailed: false,
    })
    expect(withoutAccess(null)).toBeNull()
  })
})
