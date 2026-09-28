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

  // The public-site specs assert rendered copy, so the `site` content
  // document is provisioned like any other test fixture — nothing in the
  // repository carries real content.
  const siteDoc = await payload.find({
    collection: 'content-documents',
    where: { slug: { equals: 'site' } },
    limit: 1,
    overrideAccess: true,
    pagination: false,
  })
  if (!siteDoc.docs[0]) {
    await payload.create({
      collection: 'content-documents',
      data: {
        slug: 'site',
        title: 'Public site copy',
        body: {
          home: {
            hero: { title: 'Your place in global climate action.' },
          },
        },
      } as any,
      overrideAccess: true,
    })
  }

  writeFileSync(
    path.resolve(import.meta.dirname, '.credentials.json'),
    JSON.stringify({
      memberEmail,
      memberPassword,
      consoleEmail,
      consolePassword,
    }),
  )
}
