import crypto from 'node:crypto'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { applyAccountSpec } from '../../scripts/lib/accountSpec'
import { testPayload } from '../int/provision'

/**
 * Provision a member account and missing content and working-group fixtures
 * for the browser specs. Write the generated member credentials to the
 * gitignored .credentials.json file for the test workers.
 */
export default async function globalSetup() {
  const payload = await testPayload()

  const memberEmail = `e2e-${crypto.randomBytes(6).toString('hex')}@test.invalid`
  const memberPassword = `T!${crypto.randomBytes(12).toString('base64url')}`
  await applyAccountSpec(payload, {
    email: memberEmail,
    password: memberPassword,
    name: `E2E ${memberEmail}`,
  })

  // The public-site specs assert rendered copy, so the `site` content
  // document is provisioned like any other test fixture — nothing in the
  // repository carries real content.
  const ensureDoc = async (slug: string, title: string, body: any) => {
    const existing = await payload.find({
      collection: 'content-documents',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
      pagination: false,
    })
    if (!existing.docs[0]) {
      await payload.create({
        collection: 'content-documents',
        data: { slug, title, body } as any,
        overrideAccess: true,
      })
    }
  }

  await ensureDoc('site', 'Public site copy', {
    home: { hero: { title: 'Your place in global climate action.' } },
  })

  // The join flow gates on the membership-policy document; a fresh test
  // database has none. Provision the shape only — fields present, content
  // empty — so no copy lives in the repository.
  await ensureDoc('membership-policy', 'Membership Policy', {
    POLICY_VERSION: `e2e-${crypto.randomBytes(4).toString('hex')}`,
    MANDATE_ANALYSIS: { title: '', lede: '', points: [] },
    POLICY_META: {
      name: '',
      issue: '',
      updatedOn: '',
      contactEmail: '',
      translations: [],
    },
    POLICY_SECTIONS: [],
  })

  // The registration spec opens the gender selector, whose options come
  // from a staff-editable document — seed a generated entry so the list
  // is non-empty without storing vocabulary in the repository.
  await ensureDoc('registration-options', 'Registration options', {
    genders: [`E2E ${crypto.randomBytes(4).toString('hex')}`],
  })

  // The registration spec opens the working-group selector, which lists
  // live records — an empty database needs at least one active group.
  const groups = await payload.find({
    collection: 'working-groups',
    limit: 1,
    overrideAccess: true,
    pagination: false,
  })
  if (!groups.docs[0]) {
    const suffix = crypto.randomBytes(4).toString('hex')
    await payload.create({
      collection: 'working-groups',
      data: {
        slug: `e2e-group-${suffix}`,
        name: `E2E Group ${suffix}`,
      } as any,
      overrideAccess: true,
    })
  }

  writeFileSync(
    path.resolve(import.meta.dirname, '.credentials.json'),
    JSON.stringify({
      memberEmail,
      memberPassword,
    }),
  )
}
