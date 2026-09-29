/**
 * Pre-production smoke check, run against a started server (npm start):
 * verifies the health endpoint, then exercises the critical authentication
 * flow with a generated throwaway account — nothing is hardcoded.
 *
 *   npm start &           # built app on DATABASE_URL
 *   npx tsx scripts/ci/smoke.ts
 */
import crypto from 'node:crypto'
import dotenv from 'dotenv'
import { getPayload } from 'payload'

// Config reads env at module scope — dotenv must run before it is imported.
dotenv.config({ path: ['.env.local', '.env'] })
const { default: config } = await import('../../src/payload.config')
const { applyAccountSpec } = await import('../lib/accountSpec')

const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`smoke failed: ${message}`)
}

async function main() {
  // 1. Liveness — the process and its routes are up.
  const health = await fetch(`${BASE}/healthz`)
  assert(health.status === 200, `GET /healthz → ${health.status}`)
  assert((await health.json()).ok === true, 'GET /healthz body ok:true')

  // 2. The auth gate rejects anonymous member reads.
  const anonymous = await fetch(`${BASE}/api/member/profile`)
  assert(
    anonymous.status === 401,
    `GET /api/member/profile anonymous → ${anonymous.status}, expected 401`,
  )

  // 3. A generated account can sign in and reach a member endpoint.
  const email = `smoke-${crypto.randomBytes(8).toString('hex')}@test.invalid`
  const password = `S!${crypto.randomBytes(12).toString('base64url')}`
  const payload = await getPayload({ config: await config })
  await applyAccountSpec(payload, { email, password, name: 'Smoke Check' })

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert(login.status === 200, `POST /api/auth/login → ${login.status}`)
  const cookie = (login.headers.get('set-cookie') || '').split(';')[0]
  assert(cookie.startsWith('payload-token='), 'login did not set a session cookie')

  const profile = await fetch(`${BASE}/api/member/profile`, {
    headers: { Cookie: cookie },
  })
  assert(profile.status === 200, `GET /api/member/profile authenticated → ${profile.status}`)

  // 4. The uniform error contract holds on a 4xx.
  const body = await anonymous.json()
  assert(
    body?.error?.code === 'unauthorized',
    `error contract on anonymous read: ${JSON.stringify(body)}`,
  )

  console.log('smoke: healthz, auth gate, login and member read all passed')
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
