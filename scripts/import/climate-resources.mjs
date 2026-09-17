// Read the source's literal data array with TypeScript's parser, never execute it.
// Usage: node scripts/import/climate-resources.mjs /path/to/source-checkout
import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { canonicalResourceUrl } from '../../shared/resourceHub.js'
import { validateEditableContent } from '../../shared/contentValidation.js'

const source = process.argv[2]
if (!source) throw new Error('Pass the source checkout directory.')
const file = ts.createSourceFile(
  'data.ts',
  readFileSync(path.join(source, 'src/data.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
)
let entries
for (const statement of file.statements)
  if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations.find(
      (d) => d.name.getText(file) === 'resources',
    )
    if (declaration) entries = declaration.initializer
  }
if (!entries || !ts.isArrayLiteralExpression(entries))
  throw new Error('Expected a literal resources array.')
const rows = entries.elements.map((element) => {
  if (!ts.isObjectLiteralExpression(element))
    throw new Error('Non-literal source resource.')
  return Object.fromEntries(
    element.properties.map((p) => {
      if (!ts.isPropertyAssignment(p) || !ts.isStringLiteral(p.initializer))
        throw new Error('Non-literal source field.')
      return [p.name.getText(file), p.initializer.text]
    }),
  )
})
const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim()
const repository = 'https://github.com/unnobatroo/climate-resource-hub'
const provenance = { repository, commit, path: 'src/data.ts' }
const topics = {
  General: 'Climate basics',
  'Water resources': 'Water and oceans',
  Agriculture: 'Nature and food',
  CO2: 'Mitigation',
  Forestry: 'Nature and food',
  'Green energy': 'Energy',
  Marine: 'Water and oceans',
  Policy: 'Policy',
  'Tech for climate': 'Technology',
  Datasets: 'Data and monitoring',
  'Jupyter notebooks': 'Data and monitoring',
  'Climate basics': 'Climate basics',
  'Media and explainers': 'Climate basics',
  'Data and monitoring': 'Data and monitoring',
  'Learning hubs': 'Climate basics',
  'Youth and community': 'Youth and community',
  'Teaching resources': 'Climate basics',
  'Courses and certifications': 'Climate basics',
  'Funds and organizations': 'Climate finance',
}
const pathways = {
  Career: 'career',
  Research: 'research',
  Education: 'education',
  Invest: 'investment',
}
const target = new URL('../../data/resource-hub.json', import.meta.url)
const baseline = JSON.parse(readFileSync(target, 'utf8'))
const byUrl = new Map(baseline.map((r) => [canonicalResourceUrl(r.url), r]))
let added = 0,
  merged = 0
for (const row of rows) {
  const url = canonicalResourceUrl(row.url)
  if (!topics[row.subtopic] || !pathways[row.topic])
    throw new Error(`Unmapped category ${row.topic}/${row.subtopic}`)
  const existing = byUrl.get(url)
  const topic =
    row.subtopic === 'General' && row.topic === 'Career'
      ? 'Youth and community'
      : topics[row.subtopic]
  const type =
    row.subtopic === 'Datasets'
      ? 'dataset'
      : row.subtopic === 'Jupyter notebooks'
        ? 'toolkit'
        : row.subtopic === 'Courses and certifications'
          ? 'course'
          : row.subtopic === 'Teaching resources'
            ? 'toolkit'
            : row.subtopic === 'Media and explainers'
              ? 'article'
              : 'platform'
  const item = existing || {
    slug: `climate-${row.title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(
        0,
        62,
      )}-${createHash('sha256').update(url).digest('hex').slice(0, 8)}`,
    title: row.title,
    url,
    summary: row.summary,
    publisher: null,
    pathway: pathways[row.topic],
    type,
    topic,
    region: 'global',
    language: 'English',
  }
  item.topics = [...new Set([...(item.topics || [item.topic]), topic])]
  item.source = {
    ...provenance,
    originalUrl: row.url,
    category: row.topic,
    subcategory: row.subtopic,
    listedAt: row.date,
  }
  if (existing) merged++
  else added++
  const validation = validateEditableContent('resource', item)
  if (!validation.ok)
    throw new Error(`${row.title}: ${JSON.stringify(validation.errors)}`)
  byUrl.set(url, item)
}
const items = [...byUrl.values()].sort((a, b) => a.title.localeCompare(b.title))
writeFileSync(target, JSON.stringify(items, null, 2) + '\n')
writeFileSync(
  new URL('../../data/resource-import.json', import.meta.url),
  JSON.stringify(
    {
      ...provenance,
      sourceCount: rows.length,
      sourceUrls: rows.map((r) => canonicalResourceUrl(r.url)),
      catalogueCount: items.length,
      verification:
        'Imported records require human verification; source dates are not link-check dates.',
    },
    null,
    2,
  ) + '\n',
)
console.log(
  JSON.stringify({
    sourceCount: rows.length,
    added,
    merged,
    total: items.length,
    commit,
  }),
)
