import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testPayload } from './provision'

// the suite normally runs with limits switched off, so re-import the module with them on
async function limiterModule() {
  vi.stubEnv('HUB_DISABLE_RATE_LIMIT', '0')
  vi.resetModules()
  return import('../../src/lib/rateLimit')
}

const request = (headers: Record<string, string> = {}) =>
  ({ headers: new Headers(headers) }) as unknown as PayloadRequest

describe('rate limiter', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('counts in Postgres, so separate limiter instances share one budget', async () => {
    await testPayload()
    const { rateLimit } = await limiterModule()
    const scope = `it-${Math.random().toString(36).slice(2, 8)}`
    const options = { windowMs: 60_000, max: 2, scope, key: () => 'same-caller' }
    const first = rateLimit(options)
    const second = rateLimit(options)
    await first(request())
    await second(request())
    await expect(first(request())).rejects.toMatchObject({ status: 429 })
  })

  it('starts a fresh window once the old one has ended', async () => {
    const { rateLimit } = await limiterModule()
    const scope = `it-${Math.random().toString(36).slice(2, 8)}`
    const limit = rateLimit({ windowMs: 1000, max: 1, scope, key: () => 'caller' })
    await limit(request())
    await expect(limit(request())).rejects.toMatchObject({ status: 429 })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    await expect(limit(request())).resolves.toBeUndefined()
  })

  it('ignores a spoofed forwarded-for header unless behind a trusted proxy', async () => {
    const { clientId } = await limiterModule()
    vi.stubEnv('TRUST_PROXY', '')
    vi.stubEnv('VERCEL', '')
    expect(clientId(request({ 'x-forwarded-for': '203.0.113.9' }))).toBe('local')
    vi.stubEnv('TRUST_PROXY', '1')
    expect(clientId(request({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }))).toBe('203.0.113.9')
  })
})
