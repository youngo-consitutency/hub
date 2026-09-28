import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { PayloadRequest } from 'payload'
import { ApiError } from './respond'

// rate-limiter-flexible fixed-window limiter. Single-process deployments use
// the memory store here; a distributed deployment swaps RateLimiterMemory for
// RateLimiterRedis/Postgres without touching the call sites.
//
// Tests drive far more auth requests than any real client — the suite opts
// out via HUB_DISABLE_RATE_LIMIT on the local/CI test server only.
const DISABLED = process.env.HUB_DISABLE_RATE_LIMIT === '1'

export function rateLimit({
  windowMs,
  max,
  key,
  scope,
}: {
  windowMs: number
  max: number
  key?: (req: PayloadRequest) => string
  scope: string
}) {
  if (DISABLED) return async () => {}
  const limiter = new RateLimiterMemory({
    points: max,
    duration: Math.ceil(windowMs / 1000),
    keyPrefix: scope,
  })
  return async (req: PayloadRequest) => {
    const id = key
      ? key(req)
      : req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'local'
    try {
      await limiter.consume(id)
    } catch {
      throw new ApiError(
        429,
        'rate_limited',
        'Too many requests. Please wait and try again.',
      )
    }
  }
}
