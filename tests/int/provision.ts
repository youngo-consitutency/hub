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

let payload: Payload

export async function testPayload(): Promise<Payload> {
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
