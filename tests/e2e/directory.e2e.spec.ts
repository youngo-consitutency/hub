import type { AnyValue } from '../../src/lib/domain'
import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { applyAccountSpec } from '../../scripts/lib/accountSpec'
import { testPayload } from '../int/provision'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

// the contacts directory names a group's contact points from authority
// records, so it can never disagree with the group page or the guards
test('working-group contacts show the current contact points', async ({ page }) => {
  const payload = await testPayload()
  const tag = crypto.randomBytes(4).toString('hex')
  const wg = await payload.create({
    collection: 'working-groups',
    data: { slug: `dir-${tag}`, name: `Directory group ${tag}`, isActive: true } as AnyValue,
    overrideAccess: true,
  })
  // the page groups rows into layers from the `directory` document
  const layers = await payload.find({
    collection: 'content-documents',
    where: { slug: { equals: 'directory' } },
    limit: 1,
    overrideAccess: true,
  })
  if (!layers.docs[0]) {
    await payload.create({
      collection: 'content-documents',
      data: {
        slug: 'directory',
        title: 'Directory',
        body: { DIRECTORY_LAYERS: [{ id: 'working-groups', level: 3, groups: ['wg_contacts'] }] },
      } as AnyValue,
      overrideAccess: true,
    })
  }
  await payload.create({
    collection: 'directory-contacts',
    data: {
      group: 'wg_contacts',
      roleTitle: `Directory group ${tag} contact point`,
      publicEmail: `dir-${tag}@test.invalid`,
      wg: wg.id,
    } as AnyValue,
    overrideAccess: true,
  })
  const holder = `Casey ${tag}`
  await applyAccountSpec(payload, {
    email: `dir-cp-${tag}@test.invalid`,
    password: `T!${crypto.randomBytes(12).toString('base64url')}`,
    name: holder,
    membershipTrack: 'constituency_work',
    wg: { slug: wg.slug, role: 'contact' },
  })
  const viewer = {
    email: `dir-viewer-${tag}@test.invalid`,
    password: `T!${crypto.randomBytes(12).toString('base64url')}`,
  }
  await applyAccountSpec(payload, { ...viewer, name: 'Directory Viewer' })

  await page.goto(`${BASE}/signin`)
  await page.locator('input[type="email"]').first().fill(viewer.email)
  await page.locator('input[type="password"]').first().fill(viewer.password)
  await page.locator('button[type="submit"]').first().click()
  await expect(page.locator('input[type="email"]').first()).toBeHidden({ timeout: 15000 })

  await page.goto(`${BASE}/directory`)
  const card = page.locator('.workingGroupContactCard', { hasText: wg.name })
  await expect(card).toContainText(`Contact Points: ${holder}`)
  await expect(card).toContainText(`dir-${tag}@test.invalid`)
})
