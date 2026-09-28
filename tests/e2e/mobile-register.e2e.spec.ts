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
  await expect(
    page.getByRole('heading', { name: /individual registration/i }),
  ).toBeVisible()
}

test('register: SearchableSelect option tap registers selection', async ({
  page,
}) => {
  await page.goto(BASE + '/join')
  await passMandateGate(page)

  const gender = page.getByRole('combobox', { name: /gender/i })
  await gender.tap()
  const option = page.getByRole('option').first()
  const label = (await option.innerText()).trim()
  await option.tap()
  await expect(gender).toHaveValue(label)
})

test('register: MultiSelectDropdown option tap registers selection', async ({
  page,
}) => {
  await page.goto(BASE + '/join')
  await passMandateGate(page)

  const wg = page.getByRole('combobox', { name: /working groups/i })
  await wg.tap()
  const option = page.getByRole('option').first()
  const label = await option.locator('span').innerText()
  await option.tap()
  await expect(wg).toHaveAttribute('placeholder', new RegExp(label))
})
