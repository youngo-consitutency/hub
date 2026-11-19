import { timingSafeEqual } from 'node:crypto'
import { fail } from './respond'

// vercel crons send CRON_SECRET as a bearer. fails closed when it is unset
export function requireCronSecret(req: { headers: Headers }) {
  const secret = String(process.env.CRON_SECRET || '')
  const supplied = Buffer.from(String(req.headers.get('authorization') || ''))
  const expected = Buffer.from(`Bearer ${secret}`)
  // compare bytes, not characters: timingSafeEqual throws on buffers of different length
  if (!secret || supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
    throw fail.unauthorized()
}
