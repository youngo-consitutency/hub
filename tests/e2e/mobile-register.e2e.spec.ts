import { test, expect, devices, Page } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Touch-only emulation — taps must not rely on mouse/hover behaviour.
test.use({ ...devices['iPhone 13'], defaultBrowserType: 'chromium', hasTouch: true })

async function passMandateGate(page: Page) {
  await page.getByRole('button', { name: /read full membership policy/i }).tap()
  const policy = page.locator('#full-policy')
  await expect(policy).toBeVisible()
  await policy.locator('.mandateEndMark').scrollIntoViewIfNeeded()
  const check = page.locator('.mandateCheck input')
  await expect(check).toBeEnabled()
  await check.tap()
  await page.getByRole('button', { name: /continue to account/i }).tap()
  await expect(page.getByRole('heading', { name: /individual registration/i })).toBeVisible()
}

test('register: touch taps register option selections', async ({ page }) => {
  await page.goto(BASE + '/join')
  await passMandateGate(page)

  // SearchableSelect
  const gender = page.getByRole('combobox', { name: /gender/i })
  await gender.tap()
  const genderOption = page.getByRole('option').first()
  const genderLabel = (await genderOption.innerText()).trim()
  await genderOption.tap()
  await expect(gender).toHaveValue(genderLabel)

  // MultiSelectDropdown
  const wg = page.getByRole('combobox', { name: /working groups/i })
  await wg.tap()
  const wgOption = page.getByRole('option').first()
  const wgLabel = await wgOption.locator('span').innerText()
  await wgOption.tap()
  await expect(wg).toHaveAttribute('placeholder', new RegExp(wgLabel))
})
