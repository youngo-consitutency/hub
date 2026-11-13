import { describe, expect, it } from 'vitest'
import { mergeAccount, withoutAccess } from '../../src/member/lib/accountState'

const access = { ngo: false }

describe('account state', () => {
  it('keeps loaded access across a bare refresh of the same account', () => {
    const next = mergeAccount({ id: 1, access }, { id: 1, name: 'A' })
    expect(next).toEqual({ id: 1, name: 'A', access })
  })

  it('keeps a failed access check so the retry stays reachable', () => {
    const next = mergeAccount({ id: 1, accessFailed: true }, { id: 1, name: 'A' })
    expect(next).toEqual({ id: 1, name: 'A', accessFailed: true })
  })

  it('never carries access across accounts, or past an explicit one', () => {
    expect(mergeAccount({ id: 1, access }, { id: 2 })).toEqual({ id: 2 })
    expect(mergeAccount({ id: 1, access }, { id: 1, access: { ngo: true } })).toEqual({
      id: 1,
      access: { ngo: true },
    })
    expect(mergeAccount({ id: 1, access }, null)).toBeNull()
    expect(mergeAccount(null, { id: 1 })).toEqual({ id: 1 })
  })

  it('drops stale access on reload and clears the failure flag', () => {
    expect(withoutAccess({ id: 1, access, accessFailed: true })).toEqual({
      id: 1,
      accessFailed: false,
    })
    expect(withoutAccess(null)).toBeNull()
  })
})
