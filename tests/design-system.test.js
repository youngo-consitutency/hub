import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

function luminance(hex) {
  const channels = hex
    .match(/[a-f\d]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

test('component styles use the shared colour tokens', async () => {
  const directory = new URL('../src/styles/parts/', import.meta.url)
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith('.css'),
  )
  const rawColour = /#[\da-f]{3,8}\b|rgba?\(/i

  for (const file of files) {
    const css = await read(`src/styles/parts/${file}`)
    assert.equal(rawColour.test(css), false, `${file} contains a raw colour`)
  }
})

test('primary action colours meet WCAG AA contrast for text', async () => {
  const css = await read('src/styles/tokens.css')
  const accent = css.match(/--accent:\s*(#[\da-f]{6})/i)?.[1]
  const onAccent = css.match(/--on-accent:\s*(#[\da-f]{6})/i)?.[1]

  assert.ok(accent && onAccent, 'primary action tokens must be defined')
  assert.ok(
    contrast(accent, onAccent) >= 4.5,
    'primary action contrast must be at least 4.5:1',
  )
})

test('access gates use document scrolling and popovers stay out of layout flow', async () => {
  const css = await read('src/styles/parts/gates.css')
  const gateRule = css.match(/\.mandateGate\s*{([^}]+)}/)?.[1] || ''
  const menuRule = css.match(/\.comboMenu\s*{([^}]+)}/)?.[1] || ''

  assert.match(gateRule, /position:\s*relative/)
  assert.match(gateRule, /overflow:\s*visible/)
  assert.doesNotMatch(gateRule, /overflow-y:\s*auto/)
  assert.match(menuRule, /position:\s*absolute/)
})

test('labelled sections clear any preceding page block', async () => {
  const css = await read('src/styles/parts/layout.css')
  const sectionSpacing = css.match(
    /\.section:not\(:first-child\)\s*{([^}]+)}/,
  )?.[1]

  assert.match(sectionSpacing || '', /margin-top:\s*var\(--section-gap\)/)
  assert.doesNotMatch(css, /\.section\s*\+\s*\.section\s*{/)
})

test('the UI uses the operating system font stack', async () => {
  const [entry, manifest, tokens] = await Promise.all([
    read('src/main.jsx'),
    read('package.json'),
    read('src/styles/tokens.css'),
  ])

  assert.doesNotMatch(entry, /@fontsource/)
  assert.doesNotMatch(manifest, /@fontsource/)
  assert.match(tokens, /--font-ui:\s*\n?\s*system-ui/)
})

test('catalog controls keep expanded filters below search and sort', async () => {
  const css = await read('src/styles/parts/layout.css')
  const popover = css.match(/(?:^|\n)\.filterMenuPanel\s*{([^}]+)}/)?.[1] || ''
  const searchRow = css.match(/\.catalogSearchRow\s*{([^}]+)}/)?.[1] || ''

  assert.match(popover, /position:\s*static/)
  assert.match(popover, /width:\s*fit-content/)
  assert.match(searchRow, /grid-template-columns:\s*minmax\(0, 1fr\) auto/)
  assert.doesNotMatch(css, /\.sortControlLabel/)
  assert.match(
    css,
    /\.catalogFilterRow \.filterMenuPanel\s*{[\s\S]*?width:\s*fit-content/,
  )
})

test('mobile navigation lives in the top bar instead of a bottom tab bar', async () => {
  const shell = await read('src/components/Shell.jsx')

  assert.match(shell, /className={`btn btn-ghost btn-sm mobileMenuButton/)
  assert.match(shell, /id="mobile-navigation"/)
  assert.match(shell, /className="sheetSearch"/)
  assert.doesNotMatch(shell, /ThemeToggle/)
  assert.doesNotMatch(shell, /⌘K/)
  assert.match(shell, /className="navItem sidebarSearch"/)
  assert.match(shell, /aria-modal="true"/)
  assert.match(shell, /menuButtonRef\.current\?\.focus\(\)/)
  assert.doesNotMatch(shell, /className="tabbar"/)
})

test('wide catalogue and directory grids share the four-card contract', async () => {
  const [layout, shell] = await Promise.all([
    read('src/styles/parts/layout.css'),
    read('src/styles/parts/shell.css'),
  ])

  assert.match(layout, /\.cardGrid\s*{[\s\S]*?var\(--catalog-columns\)/)
  assert.match(
    shell,
    /\.directoryLayer-middle \.directoryContacts\s*{[\s\S]*?var\(--catalog-columns\)/,
  )
  assert.match(
    shell,
    /\.directoryLayer-base \.directoryContacts\s*{[\s\S]*?var\(--catalog-columns\)/,
  )
})

test('working-group contact cards keep their icon beside the group name', async () => {
  const [cards, css] = await Promise.all([
    read('src/components/cards.jsx'),
    read('src/styles/parts/cards.css'),
  ])

  assert.match(cards, /className="workingGroupContactTitle"/)
  assert.match(cards, /className="workingGroupContactIcon"/)
  assert.match(css, /\.workingGroupContactTitle\s*{[\s\S]*?display:\s*flex/)
})

test('continuous decorative animations stay disabled', async () => {
  const directory = new URL('../src/styles/parts/', import.meta.url)
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith('.css'),
  )

  for (const file of files) {
    const css = await read(`src/styles/parts/${file}`)
    assert.doesNotMatch(css, /animation:(?!\s*none\b)[^;]+;/, file)
  }
})

test('calendar agenda keeps four content-safe card slots and snaps by card', async () => {
  const css = await read('src/styles/parts/calendar.css')
  const cardRule = css.match(
    /\.calendarAgendaList\s*>\s*\.entityCard\s*{([^}]+)}/,
  )?.[1]

  assert.match(cardRule || '', /flex:\s*0 0 calc\(\(100% - 24px\) \/ 4\)/)
  assert.match(cardRule || '', /height:\s*auto/)
  assert.match(cardRule || '', /min-height:\s*164px/)
  assert.match(cardRule || '', /grid-template-rows:\s*auto auto/)
  assert.match(cardRule || '', /overflow:\s*visible/)
  assert.match(css, /scroll-snap-stop:\s*always/)
})

test('statement processes and archive use four compact desktop columns', async () => {
  const css = await read('src/styles/parts/pages.css')
  const steps = css.match(/\.gysSteps\s*{([^}]+)}/)?.[1] || ''
  const archive = css.match(/\.gysArchiveGrid\s*{([^}]+)}/)?.[1] || ''

  assert.match(steps, /repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(archive, /repeat\(4, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(steps, /overflow-x/)
  assert.doesNotMatch(archive, /overflow-x/)
})
