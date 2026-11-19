/**
 * Design tokens -> CSS.
 *
 *   design/tokens/*.json  (edited in Figma via Tokens Studio, or by hand; W3C DTCG format)
 *        |  Style Dictionary 5 + @tokens-studio/sd-transforms
 *        v
 *   src/member/styles/tokens.generated.css   (never edit; imported by app.css)
 *
 * Outputs
 *   1. core tokens as CSS custom properties, names unchanged (color.bg-page -> --bg-page), plus
 *      every working-group family as --wg-<family>-<role>
 *   2. [data-wg='<slug>'] rules from design/wg-map.json; the brand colours are the fallback, so a
 *      group with no mapping is still correct
 *
 * Guard: the build FAILS if any pair in contrast.json or any working-group family is below WCAG
 * 2.2, or if a colour cannot be resolved to an opaque sRGB value. The check runs on RESOLVED,
 * PARSED values (references, rgb(), hsl(), oklch and 8-digit hex included), so a token edited in
 * Figma in any notation cannot slip through.
 *
 *   npm run design:build    generate
 *   npm run design:check    verify only (CI)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, wcagContrast } from 'culori'
import StyleDictionary from 'style-dictionary'
import { getTransforms, register } from '@tokens-studio/sd-transforms'

const here = dirname(fileURLToPath(import.meta.url))
const readJson = (...p) => JSON.parse(readFileSync(join(here, ...p), 'utf8'))
const OUT = join(here, '..', 'src', 'member', 'styles', 'tokens.generated.css')
const checkOnly = process.argv.includes('--check')

const wgMap = readJson('wg-map.json').groups
const pairs = readJson('tokens', 'contrast.json').pairs
const failures = []

// ── resolve every token through Style Dictionary first ───────────────────
register(StyleDictionary)
StyleDictionary.registerTransform({
  name: 'name/css-var-flat',
  type: 'name',
  // drop the category: color.bg-page -> bg-page, space.4 -> space-4, wg.ocean.accent -> wg-ocean-accent
  transform: (token) => (token.path[0] === 'color' ? token.path.slice(1) : token.path).join('-'),
})
StyleDictionary.registerFormat({
  name: 'css/hub-root',
  format: ({ dictionary }) =>
    `:root {\n${dictionary.allTokens.map((t) => `  --${t.name}: ${t.$value ?? t.value};`).join('\n')}\n}\n`,
})
const sd = new StyleDictionary({
  source: [join(here, 'tokens', 'core.json'), join(here, 'tokens', 'wg.json')],
  usesDtcg: true,
  log: { verbosity: 'silent' },
  platforms: {
    css: {
      transforms: [...getTransforms({ platform: 'css' }), 'name/css-var-flat'],
      buildPath: join(here, '.build') + '/',
      files: [{ destination: 'core.css', format: 'css/hub-root' }],
    },
  },
})
const resolved = await sd.exportPlatform('css')
const value = (path) => {
  const token = path.reduce((node, key) => node?.[key], resolved)
  return token?.$value ?? token?.value
}

// ── WCAG 2.2 contrast on parsed, opaque colours ──────────────────────────
const colour = (label, raw) => {
  const c = typeof raw === 'string' ? parse(raw) : undefined
  if (!c) {
    failures.push(`${label}: "${raw}" is not a colour the build can read`)
    return null
  }
  if ((c.alpha ?? 1) < 1) {
    failures.push(`${label}: "${raw}" is translucent, so its contrast depends on what is behind it`)
    return null
  }
  return c
}
const check = (label, fg, bg, min) => {
  if (!fg || !bg) return
  const ratio = wcagContrast(fg, bg)
  if (!Number.isFinite(ratio) || ratio < min) {
    failures.push(
      `${label} = ${Number.isFinite(ratio) ? ratio.toFixed(2) : 'NaN'}:1, needs ${min}:1`,
    )
  }
}
const core = (name) => colour(`color.${name}`, value(['color', name]))

for (const [fg, bg, min] of pairs) {
  check(`${fg} on ${bg}`, core(fg), core(bg), min)
}

const families = resolved.wg ?? {}
const page = core('bg-page')
const card = core('bg-card')
const raised = core('bg-raised')
const onAccent = core('on-accent')
for (const name of Object.keys(families)) {
  const get = (role) => colour(`wg.${name}.${role}`, value(['wg', name, role]))
  const [accent, tint, onTint] = [get('accent'), get('tint'), get('on-tint')]
  check(`theme "${name}": accent on page`, accent, page, 4.5)
  check(`theme "${name}": accent on card`, accent, card, 4.5)
  check(`theme "${name}": on-accent on accent`, onAccent, accent, 4.5)
  check(`theme "${name}": on-tint on tint`, onTint, tint, 4.5)
  check(`theme "${name}": on-tint on card`, onTint, card, 4.5)
  check(`theme "${name}": accent on tint`, accent, tint, 4.5)
  // non-text UI (focus rings, icons, control edges): 1.4.11 / 2.4.13
  check(`theme "${name}": accent as UI on raised`, accent, raised, 3)
}
for (const [slug, family] of Object.entries(wgMap)) {
  if (!/^[a-z0-9-]+$/.test(slug))
    failures.push(`wg-map: "${slug}" is not a safe slug ([a-z0-9-] only)`)
  if (!families[family]) failures.push(`wg-map: "${slug}" uses unknown family "${family}"`)
}

if (failures.length) {
  console.error('Design tokens failed accessibility checks:\n  ' + failures.join('\n  '))
  process.exit(1)
}

// ── emit ─────────────────────────────────────────────────────────────────
mkdirSync(join(here, '.build'), { recursive: true })
await sd.buildAllPlatforms()
const coreCss = readFileSync(join(here, '.build', 'core.css'), 'utf8')
const themeVars = (family) =>
  `  --wg-accent: var(--wg-${family}-accent);\n  --wg-tint: var(--wg-${family}-tint);\n  --wg-on-tint: var(--wg-${family}-on-tint);\n`
const groupCss = Object.entries(wgMap)
  .map(([slug, family]) => `[data-wg='${slug}'] {\n${themeVars(family)}}\n`)
  .join('\n')

const css = `/* GENERATED by design/build.mjs from design/tokens/*.json. Do not edit; run \`npm run design:build\`. */
${coreCss}
/* working-group themes. The fallback is the brand, so an unmapped or new group is still correct. */
:root {
  --wg-accent: var(--accent);
  --wg-tint: var(--accent-tint);
  --wg-on-tint: var(--on-accent-tint);
}

${groupCss}`

if (checkOnly) {
  console.log(
    `design tokens OK: ${pairs.length} pairs, ${Object.keys(families).length} themes, ${Object.keys(wgMap).length} groups`,
  )
} else {
  writeFileSync(OUT, css)
  console.log(`wrote ${OUT}`)
}
