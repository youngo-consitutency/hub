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

// react aria closes a combobox popover when the page scrolls, so bring the
// field into view first, then tap its toggle like a person would
async function openOptions(page: Page, label: string) {
  const field = page.getByRole('combobox', { name: label })
  await field.scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: `Show suggestions ${label}` }).tap()
  const option = page.getByRole('listbox').getByRole('option').first()
  // ios waits for the virtual keyboard before placing the popover
  await expect(option).toBeInViewport()
  return { field, option, label: (await option.innerText()).trim() }
}

test('register: touch taps register option selections', async ({ page }) => {
  await page.goto(BASE + '/join')
  await passMandateGate(page)

  // SearchableSelect
  const gender = await openOptions(page, 'Gender *')
  await gender.option.tap()
  await expect(gender.field).toHaveValue(gender.label)

  // MultiSelectDropdown keeps the list open and shows each choice as a tag
  const wg = await openOptions(page, 'Working groups')
  await wg.option.tap()
  await expect(wg.option).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.comboTag').first()).toContainText(wg.label)
})
