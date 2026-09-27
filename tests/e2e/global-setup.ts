import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { applyAccountSpec } from '../../scripts/lib/accountSpec'
import { testPayload } from '../int/provision'

// Provision the member account and console user the browser specs sign in
// with. Credentials are generated per run and written to a gitignored file
// for the workers — nothing is hardcoded.
export default async function globalSetup() {
  const payload = await testPayload()

  const memberEmail = `e2e-${crypto.randomBytes(6).toString('hex')}@test.invalid`
  const memberPassword = `T!${crypto.randomBytes(12).toString('base64url')}`
  await applyAccountSpec(payload, {
    email: memberEmail,
    password: memberPassword,
    name: `E2E ${memberEmail}`,
  })

  const consoleEmail = `e2e-console-${crypto.randomBytes(6).toString('hex')}@test.invalid`
  const consolePassword = `T!${crypto.randomBytes(12).toString('base64url')}`
  await payload.create({
    collection: 'users',
    data: { email: consoleEmail, password: consolePassword } as any,
    overrideAccess: true,
  })

  writeFileSync(
    path.resolve(__dirname, '.credentials.json'),
    JSON.stringify({
      memberEmail,
      memberPassword,
      consoleEmail,
      consolePassword,
    }),
  )
}
