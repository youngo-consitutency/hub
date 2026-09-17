import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')
const draftsDir = path.join(root, 'data/wg-sections')
const fixturesPath = path.join(root, 'data/fixtures.json')
const onboardingPath = path.join(root, 'src/content/wgOnboarding.js')

const GROUP_KEYS = [
  'slug',
  'name',
  'monogram',
  'focusLine',
  'tags',
  'cadenceNote',
  'whatsappUrl',
  'driveUrl',
  'groupUrl',
  'resources',
  'taskForces',
  'publicSpace',
]

function pickGroup(draft) {
  const group = {}
  for (const key of GROUP_KEYS) {
    if (draft[key] != null && draft[key] !== '') group[key] = draft[key]
  }
  if (!Array.isArray(group.resources)) group.resources = []
  if (!Array.isArray(group.tags) || !group.tags.length) {
    throw new Error(`${draft.slug || 'unknown'} is missing tags`)
  }
  return group
}

function upsertDirectory(directory, draft) {
  const entry = draft.directory
  if (!entry || !draft.slug) return directory
  const next = {
    group: 'wg_contacts',
    roleTitle: entry.roleTitle,
    wg: draft.slug,
    description: entry.description,
    ...(entry.publicEmail ? { publicEmail: entry.publicEmail } : {}),
  }
  const index = directory.findIndex(
    (item) => item.group === 'wg_contacts' && item.wg === draft.slug,
  )
  if (index >= 0) {
    const copy = [...directory]
    copy[index] = next
    return copy
  }
  return [...directory, next]
}

function renderOnboarding(map) {
  const blocks = Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, value]) => {
      const presentation = JSON.stringify(value.presentation, null, 6).replace(
        /\n/g,
        '\n    ',
      )
      const rules = JSON.stringify(value.rules, null, 6).replace(/\n/g, '\n    ')
      return `  ${JSON.stringify(slug)}: {
    presentation: ${presentation},
    rules: ${rules},
  },`
    })
    .join('\n')

  return `/** Per-WG workspace onboarding copy (presentation + rules). */

export const WG_ONBOARDING = {
${blocks}
}

export function getWgOnboarding(slug) {
  const base = WG_ONBOARDING.default
  const specific = slug === 'default' ? {} : WG_ONBOARDING[slug] || {}
  return {
    presentation: specific.presentation || base.presentation,
    rules: [...(specific.rules || []), ...base.rules],
  }
}
`
}

const files = (await readdir(draftsDir)).filter((name) => name.endsWith('.json'))
const drafts = []
for (const name of files) {
  const raw = JSON.parse(await readFile(path.join(draftsDir, name), 'utf8'))
  if (!raw.slug) throw new Error(`${name} missing slug`)
  drafts.push(raw)
}

const fixtures = JSON.parse(await readFile(fixturesPath, 'utf8'))
const bySlug = new Map(fixtures.groups.map((group) => [group.slug, group]))
for (const draft of drafts) {
  const merged = { ...(bySlug.get(draft.slug) || {}), ...pickGroup(draft) }
  bySlug.set(draft.slug, merged)
}
fixtures.groups = [...bySlug.values()]
let directory = fixtures.directory
for (const draft of drafts) directory = upsertDirectory(directory, draft)
fixtures.directory = directory

const onboarding = {
  default: {
    presentation: [
      'This Working Group coordinates thematic work inside YOUNGO — drafting, campaigns, and inputs to UNFCCC processes.',
      'Contact Points (CPs) facilitate calls and channels. Members contribute in good faith and respect YOUNGO policies.',
      'After you accept the rules, you unlock the WG module: WhatsApp (where available), CP contacts, and WG activities.',
    ],
    rules: [
      'Follow the YOUNGO Code of Conduct and Safeguarding policies in all WG spaces.',
      'Do not share private channel links outside YOUNGO membership without CP approval.',
      'Credit collective work; do not speak for the whole WG unless mandated.',
      'Flag conflicts of interest to the CP when relevant.',
    ],
  },
}
for (const draft of drafts) {
  if (draft.onboarding?.presentation && draft.onboarding?.rules) {
    onboarding[draft.slug] = {
      presentation: draft.onboarding.presentation,
      rules: draft.onboarding.rules,
    }
  }
}

await writeFile(fixturesPath, `${JSON.stringify(fixtures, null, 2)}\n`)
await writeFile(onboardingPath, renderOnboarding(onboarding))
console.log(
  JSON.stringify(
    {
      event: 'wg_sections_merged',
      drafts: drafts.length,
      groups: fixtures.groups.length,
      directory: fixtures.directory.length,
      onboarding: Object.keys(onboarding).length,
    },
    null,
    2,
  ),
)
