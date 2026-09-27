import type { PayloadRequest } from 'payload'
import { ApiError } from './respond'

// In-memory fixed-window limiter, same behaviour as server/lib/rateLimit.js.
// Single-process deployments only; a distributed deployment would swap this
// for a shared store (e.g. Redis) without changing call sites.
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

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
  if (DISABLED) return () => {}
  return (req: PayloadRequest) => {
    const id = key
      ? key(req)
      : req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'local'
    const bucketKey = `${scope}:${id}`
    const now = Date.now()
    if (!buckets.has(bucketKey) && buckets.size >= MAX_BUCKETS) {
      for (const [bucketId, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketId)
      }
      while (buckets.size >= MAX_BUCKETS) {
        buckets.delete(buckets.keys().next().value!)
      }
    }
    let bucket = buckets.get(bucketKey)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(bucketKey, bucket)
    }
    bucket.count += 1
    if (bucket.count > max) {
      throw new ApiError(
        429,
        'rate_limited',
        'Too many requests. Please wait and try again.',
      )
    }
  }
}
