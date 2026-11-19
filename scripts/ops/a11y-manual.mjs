/** Checks axe cannot make, on a LOCAL Hub: language, title, h1, skip link, focus indicators, text spacing. Needs A11Y_EMAIL and A11Y_PASSWORD. */
import { chromium } from '@playwright/test'

const base = process.env.A11Y_BASE || 'http://localhost:3000'
if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(base)) process.exit(1)
const SPACING = `*{line-height:1.5 !important;letter-spacing:.12em !important;word-spacing:.16em !important}
p{margin-bottom:2em !important}`
const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext()).newPage()
const problems = []
const note = (path, msg) => problems.push(`${path}: ${msg}`)

async function check(path) {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(base + path, { waitUntil: 'load', timeout: 90000 })
  await page.waitForTimeout(2500)
  const facts = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelectorAll('h1').length,
  }))
  if (!facts.lang) note(path, 'no <html lang>')
  if (!facts.title || facts.title.length < 3) note(path, 'empty <title>')
  if (facts.h1 !== 1) note(path, `${facts.h1} <h1> elements`)

  await page.evaluate(() => document.activeElement?.blur())
  await page.keyboard.press('Tab')
  const first = await page.evaluate(() => {
    const e = document.activeElement
    return { text: (e?.textContent || '').trim().slice(0, 30), href: e?.getAttribute('href') || '' }
  })
  if (!path.includes('#') && !/skip|main|content/i.test(first.text + first.href))
    note(path, `first tab stop is "${first.text}", not a skip link`)

  // focus indicator on the next 12 stops: some outline or ring must be painted
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    const seen = await page.evaluate(() => {
      const e = document.activeElement
      if (!e || e === document.body || e.tagName === 'NEXTJS-PORTAL') return null
      // the ring may sit on the element or on a card that wraps a stretched link (:has pattern)
      const painted = (el) => {
        const s = getComputedStyle(el)
        return {
          ring: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
          shadow: !!s.boxShadow && s.boxShadow !== 'none',
        }
      }
      let { ring, shadow } = painted(e)
      for (let a = e.parentElement, n = 0; a && n < 3 && !ring; a = a.parentElement, n++)
        ring = painted(a).ring
      return {
        ring,
        shadow,
        label: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 28),
      }
    })
    if (seen && !seen.ring && !seen.shadow) note(path, `no visible focus on "${seen.label}"`)
  }

  await page.addStyleTag({ content: SPACING })
  await page.waitForTimeout(400)
  const spaced = await page.evaluate(() => {
    const clipped = [...document.querySelectorAll('h1,h2,h3,p,a,button,label,li')].filter((e) => {
      const s = getComputedStyle(e)
      return (
        e.scrollHeight > e.clientHeight + 2 &&
        (s.overflowY === 'hidden' || s.overflow === 'hidden') &&
        e.clientHeight > 0 &&
        !e.classList.contains('srOnly')
      )
    })
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      clipped: clipped.slice(0, 4).map((e) => `${e.tagName}.${String(e.className).slice(0, 30)}`),
    }
  })
  if (spaced.overflow > 0) note(path, `text-spacing causes ${spaced.overflow}px sideways scroll`)
  if (spaced.clipped.length) note(path, `text-spacing clips: ${spaced.clipped.join(', ')}`)
}

for (const p of ['/', '/our-work', '/about', '/signin', '/join', '/privacy']) await check(p)
if (process.env.A11Y_EMAIL) {
  await page.goto(base + '/signin')
  await page.getByLabel(/email/i).fill(process.env.A11Y_EMAIL)
  await page.getByLabel(/password/i).fill(process.env.A11Y_PASSWORD || '')
  await page
    .getByRole('button', { name: /sign in/i })
    .last()
    .click()
  await page.waitForURL(/\/hub/)
  for (const p of ['/hub', '/hub#/calendar', '/hub#/groups', '/hub#/resources']) await check(p)
}
await browser.close()
console.log(problems.length ? problems.join('\n') : 'All manual checks passed.')
