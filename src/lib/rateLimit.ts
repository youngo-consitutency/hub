import { RateLimiterMemory } from 'rate-limiter-flexible'
import type { PayloadRequest } from 'payload'
import { getPgPool } from './pg'
import { ApiError } from './respond'

// Fixed-window limiter with Postgres counters shared across instances, falling
// back to per-process memory without a database. Tests opt out via HUB_DISABLE_RATE_LIMIT.
const DISABLED = process.env.HUB_DISABLE_RATE_LIMIT === '1'

/** Who is calling; forwarded-for is trusted only behind Vercel or TRUST_PROXY=1 (last entry). */
export function clientId(req: PayloadRequest): string {
  const forwarded = req.headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
  if (process.env.VERCEL && forwarded?.[0]) return forwarded[0]
  if (process.env.TRUST_PROXY === '1' && forwarded?.length) return forwarded[forwarded.length - 1]
  return 'local'
}

// one UPSERT: start a new window when the old one has ended, else count within it
const CONSUME = `
  INSERT INTO rate_limits (key, count, reset_at)
  VALUES ($1, 1, now() + make_interval(secs => $2))
  ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN rate_limits.reset_at <= now() THEN 1 ELSE rate_limits.count + 1 END,
    reset_at = CASE WHEN rate_limits.reset_at <= now()
      THEN now() + make_interval(secs => $2) ELSE rate_limits.reset_at END
  RETURNING count`

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
  const seconds = Math.ceil(windowMs / 1000)
  const fallback = new RateLimiterMemory({ points: max, duration: seconds, keyPrefix: scope })
  const tooMany = () =>
    new ApiError(429, 'rate_limited', 'Too many requests. Please wait and try again.')

  return async (req: PayloadRequest) => {
    const id = `${scope}:${key ? key(req) : clientId(req)}`
    const pool = getPgPool()
    if (pool) {
      try {
        const { rows } = await pool.query<{ count: number }>(CONSUME, [id, seconds])
        if (rows[0].count > max) throw tooMany()
        // expired windows are harmless but pile up: sweep now and then
        if (Math.random() < 0.01)
          // cleanup is best effort: its failure must neither reach the caller nor trigger a second
          // count through the memory fallback below
          pool
            .query(`DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day'`)
            .catch(() => {})
        return
      } catch (error) {
        if (error instanceof ApiError) throw error
        // database unreachable: use the memory limiter below
      }
    }
    try {
      await fallback.consume(id)
    } catch {
      throw tooMany()
    }
  }
}
