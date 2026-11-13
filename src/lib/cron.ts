import { timingSafeEqual } from 'node:crypto'
import { fail } from './respond'

// vercel crons send CRON_SECRET as a bearer. fails closed when it is unset
export function requireCronSecret(req: { headers: Headers }) {
  const secret = String(process.env.CRON_SECRET || '')
  const supplied = String(req.headers.get('authorization') || '')
  const expected = `Bearer ${secret}`
  if (
    !secret ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw fail.unauthorized()
}
