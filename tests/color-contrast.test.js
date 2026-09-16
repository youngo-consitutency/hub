import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
)
const light = css.match(/:root\s*{([^}]+)}/)[1]
const dark = css.match(/\[data-theme='dark'\]\s*{([^}]+)}/)[1]

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => {
      const s = parseInt(value, 16) / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

for (const [theme, block] of [
  ['light', light],
  ['dark', dark],
]) {
  const tokens = Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((m) => [
      m[1],
      m[2],
    ]),
  )
  function contrast(foreground, background, minimum) {
    assert.ok(tokens[foreground], `${theme}: missing ${foreground}`)
    assert.ok(tokens[background], `${theme}: missing ${background}`)
    const a = luminance(tokens[foreground]),
      b = luminance(tokens[background])
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    assert.ok(
      ratio >= minimum,
      `${theme}: ${foreground} on ${background} = ${ratio.toFixed(2)}:1; expected ${minimum}:1`,
    )
  }
  test(`${theme} theme keeps text and meaningful field boundaries readable`, () => {
    for (const background of ['bg-page', 'bg-card', 'bg-raised']) {
      for (const text of ['text-1', 'text-2', 'text-3', 'accent'])
        contrast(text, background, 4.5)
    }
    contrast('on-accent', 'accent', 4.5)
    contrast('on-accent-tint', 'accent-tint', 4.5)
    contrast('border-strong', 'bg-card', 3)
  })
}
