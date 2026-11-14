import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { applyAccountSpec } from '../../scripts/lib/accountSpec'
import { testPayload } from '../int/provision'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

// side panels are modal <dialog>s, which make everything outside them inert;
// a combobox popover inside one has to portal into the dialog to stay usable
test('a combobox inside a side panel opens and selects', async ({ page }) => {
  const email = `e2e-operator-${crypto.randomBytes(6).toString('hex')}@test.invalid`
  const password = `T!${crypto.randomBytes(12).toString('base64url')}`
  await applyAccountSpec(await testPayload(), {
    email,
    password,
    name: 'E2E Operator',
    // officer roles only count while constituency work is active
    membershipTrack: 'constituency_work',
    records: [{ role: 'gct.internal', scopeType: 'team', scopeId: 'gct' }],
  })

  await page.goto(`${BASE}/signin`)
  await page.locator('input[type="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.locator('button[type="submit"]').first().click()
  await expect(page.locator('input[type="email"]').first()).toBeHidden({ timeout: 15000 })

  await page.goto(`${BASE}/admin`)
  await page.getByRole('button', { name: 'Manage' }).first().click()
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()

  const lifecycle = panel.getByRole('combobox', { name: 'Membership lifecycle' })
  await panel.getByRole('button', { name: 'Show suggestions Membership lifecycle' }).click()
  const option = panel.getByRole('listbox').getByRole('option').last()
  const label = (await option.innerText()).trim()
  await option.click()
  await expect(lifecycle).toHaveValue(label)
})
