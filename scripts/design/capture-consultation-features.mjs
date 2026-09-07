import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(here, '../../public/consultation/assets/features')
mkdirSync(outDir, { recursive: true })

const shots = [
  {
    file: 'membership.jpg',
    url: 'https://youngohub.org/',
    wait: 'text=Create a Hub account',
  },
  {
    file: 'groups.jpg',
    url: 'https://youngohub.org/about/working-groups',
    wait: 'h1',
  },
  {
    file: 'calendar.jpg',
    url: 'https://youngohub.org/about/coy',
    wait: 'h1',
  },
  {
    file: 'opportunities.jpg',
    url: 'https://youngohub.org/about/resources',
    wait: 'h1',
  },
  {
    file: 'organisations.jpg',
    url: 'https://youngohub.org/about',
    wait: 'h1',
  },
  {
    file: 'search.jpg',
    url: 'https://youngohub.org/',
    wait: 'text=Evidence over guesswork',
    scroll: '#trust',
  },
]

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})

try {
  for (const shot of shots) {
    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForSelector(shot.wait, { timeout: 20000 })
    if (shot.scroll) {
      await page.locator(shot.scroll).scrollIntoViewIfNeeded()
    }
    await page.waitForTimeout(500)
    const file = path.join(outDir, shot.file)
    await page.screenshot({ path: file, type: 'jpeg', quality: 72 })
    console.log('wrote', shot.file)
  }
} finally {
  await browser.close()
}
