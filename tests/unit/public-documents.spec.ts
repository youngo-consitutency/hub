import { afterEach, describe, expect, it, vi } from 'vitest'

const getPayload = vi.fn()
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: (...args: unknown[]) => getPayload(...args) }))

import { loadPublicDocuments } from '../../src/lib/publicDocuments'

afterEach(() => {
  vi.useRealTimers()
  getPayload.mockReset()
})

describe('loadPublicDocuments', () => {
  it('keys documents the way the browser SWR cache does', async () => {
    getPayload.mockResolvedValue({
      find: async () => ({ docs: [{ slug: 'site', title: 'Site', body: { home: {} } }] }),
    })
    await expect(loadPublicDocuments(['site'])).resolves.toEqual({
      '/documents/site': { slug: 'site', title: 'Site', body: { home: {} } },
    })
  })

  it('returns nothing when the database is unavailable, so the page fetches in the browser', async () => {
    getPayload.mockRejectedValue(new Error('connect ECONNREFUSED'))
    await expect(loadPublicDocuments()).resolves.toEqual({})
  })

  it('gives up on a stalled connection instead of holding the render', async () => {
    vi.useFakeTimers()
    getPayload.mockReturnValue(new Promise(() => {})) // never settles
    const result = loadPublicDocuments()
    await vi.advanceTimersByTimeAsync(3000)
    await expect(result).resolves.toEqual({})
  })
})
