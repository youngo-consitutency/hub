import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { applyAccountSpec } from '../../scripts/lib/accountSpec'
import { testPayload } from '../int/provision'

// Provision the member account the browser specs sign in with. Credentials
// are generated per run and written to a gitignored file for the workers.
export default async function globalSetup() {
  const email = `e2e-${crypto.randomBytes(6).toString('hex')}@test.invalid`
  const password = `T!${crypto.randomBytes(12).toString('base64url')}`
  await applyAccountSpec(await testPayload(), {
    email,
    password,
    name: `E2E ${email}`,
  })
  writeFileSync(
    path.resolve(__dirname, '.credentials.json'),
    JSON.stringify({ email, password }),
  )
}
