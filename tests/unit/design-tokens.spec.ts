/** The token build is an accessibility gate: each case breaks one thing in a copy of design/ and expects `build.mjs --check` to fail. */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

const designDir = join(process.cwd(), 'design')
// the copy lives inside design/ so node resolves culori and style-dictionary from the repo
const scratch = mkdtempSync(join(designDir, '.test-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function run(mutate?: (dir: string) => void) {
  const dir = mkdtempSync(join(scratch, 'case-'))
  cpSync(join(designDir, 'tokens'), join(dir, 'tokens'), { recursive: true })
  cpSync(join(designDir, 'wg-map.json'), join(dir, 'wg-map.json'))
  cpSync(join(designDir, 'build.mjs'), join(dir, 'build.mjs'))
  mutate?.(dir)
  const res = spawnSync('node', [join(dir, 'build.mjs'), '--check'], { encoding: 'utf8' })
  return { code: res.status, out: `${res.stdout}${res.stderr}` }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixture JSON of arbitrary shape
type Json = Record<string, any>
const editJson = (dir: string, file: string, edit: (json: Json) => void) => {
  const path = join(dir, file)
  const json = JSON.parse(readFileSync(path, 'utf8'))
  edit(json)
  writeFileSync(path, JSON.stringify(json))
}

describe('design token guard', () => {
  it('passes on the real tokens', () => {
    const { code, out } = run()
    expect(out).toContain('design tokens OK')
    expect(code).toBe(0)
  })

  it('fails a low-contrast text colour', () => {
    const { code, out } = run((d) =>
      editJson(d, 'tokens/core.json', (j) => (j.color['text-3'].$value = '#a8c0b2')),
    )
    expect(code).toBe(1)
    expect(out).toMatch(/text-3 on bg-page = 1\.\d+:1, needs 4\.5:1/)
  })

  it('resolves references instead of letting them pass', () => {
    const { code, out } = run((d) =>
      editJson(d, 'tokens/core.json', (j) => (j.color['text-3'].$value = '{color.bg-page}')),
    )
    expect(code).toBe(1)
    expect(out).toContain('1.00:1')
  })

  it('rejects translucent colours', () => {
    const { code, out } = run((d) =>
      editJson(d, 'tokens/core.json', (j) => (j.color['text-3'].$value = 'rgba(0,0,0,0.5)')),
    )
    expect(code).toBe(1)
    expect(out).toContain('translucent')
  })

  it('rejects values it cannot parse (NaN must not pass)', () => {
    const { code, out } = run((d) =>
      editJson(d, 'tokens/core.json', (j) => (j.color['text-3'].$value = 'notacolor')),
    )
    expect(code).toBe(1)
    expect(out).toContain('is not a colour the build can read')
  })

  it('fails a working-group family with unreadable text on its tint', () => {
    const { code, out } = run((d) =>
      editJson(d, 'tokens/wg.json', (j) => (j.wg.ocean['on-tint'].$value = '#bae6fd')),
    )
    expect(code).toBe(1)
    expect(out).toContain('theme "ocean"')
  })

  it('refuses unsafe slugs and unknown families in the group map', () => {
    const unsafe = run((d) => editJson(d, 'wg-map.json', (j) => (j.groups["x']{}"] = 'forest')))
    expect(unsafe.code).toBe(1)
    expect(unsafe.out).toContain('not a safe slug')
    const unknown = run((d) => editJson(d, 'wg-map.json', (j) => (j.groups.oceans = 'nope')))
    expect(unknown.code).toBe(1)
    expect(unknown.out).toContain('unknown family')
  })
})
