/**
 * Integration-test fixture helpers: accounts are provisioned straight into
 * the test database via the Payload local API, with generated emails and
 * per-run passwords. Nothing about the test identities lives in source.
 */
import type { AccountLike } from '../../src/lib/domain'
import crypto from 'node:crypto'
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'
import { applyAccountSpec, type AccountSpec } from '../../scripts/lib/accountSpec'
import { assertTestDatabase } from '../dbGuard'

let payload: Payload

// The server the tests talk to must use the same disposable database as this process, or the
// writes it receives could land somewhere real. No server running means no HTTP writes to check.
let serverChecked: Promise<void> | undefined
function assertServerDatabase(): Promise<void> {
  serverChecked ??= (async () => {
    const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
    let res: Response
    try {
      res = await fetch(`${base}/api/test-target`)
    } catch {
      return
    }
    if (res.status === 404)
      throw new Error(
        `The server at ${base} was not started with HUB_DISABLE_RATE_LIMIT=1, so it cannot confirm which database it uses. Start the test server that way (see AGENTS.md).`,
      )
    const { database } = (await res.json()) as { database: string }
    const own = new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '')
    if (database !== own)
      throw new Error(`The server at ${base} uses database "${database}", the tests use "${own}".`)
    assertTestDatabase(process.env.DATABASE_URL)
  })()
  return serverChecked
}

export async function testPayload(): Promise<Payload> {
  assertTestDatabase()
  await assertServerDatabase()
  if (!payload) payload = await getPayload({ config: await config })
  return payload
}

export type TestSpec = Omit<AccountSpec, 'email' | 'password' | 'name'>

export async function provisionAccount(
  spec: TestSpec,
): Promise<{ account: AccountLike; email: string; password: string }> {
  const email = `it-${crypto.randomBytes(8).toString('hex')}@test.invalid`
  const password = `T!${crypto.randomBytes(12).toString('base64url')}`
  const account = await applyAccountSpec(await testPayload(), {
    ...spec,
    email,
    password,
    name: `IT ${email}`,
  })
  return { account, email, password }
}
