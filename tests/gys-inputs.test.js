import test from 'node:test'
import assert from 'node:assert/strict'
import { unlinkSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateEditableContent } from '../shared/contentValidation.js'
import {
  contributionsFromCsv,
  detectColumnMap,
  parseCsv,
  previewCsvImport,
} from '../server/lib/gysImport.js'
import { synthesizeGysContributions } from '../server/lib/gysSynthesis.js'

const SAMPLE_CSV = `Timestamp,Email Address,Full Name,Country,Region,Organisation,Type of submission,Theme,Policy recommendation
2026-07-01 10:00:00,youth@example.org,Ada Youth,Kenya,Africa,Sunrise Youth,Individual,NDCs,Parties must submit 1.5C-aligned NDCs with youth participation.
2026-07-02 11:00:00,lcoy@example.org,LCOY Host,Brazil,Latin America,LCOY Brasil,LCOY,Finance,Climate finance must be grant-based and accessible to youth organisations.
`

const workflowFile = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data/gys-workflow.json',
)

test('announcement CTA fields validate and serialize', () => {
  const ok = validateEditableContent('announcement', {
    slug: 'gys-2026-inputs-closing',
    title: 'GYS 2026 call for inputs closes 31 July',
    body: 'Shape the children and youth policy demands for COP31 through the official form.',
    pinned: true,
    ctaUrl: 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
    ctaLabel: 'Submit inputs',
    ctaDeadlineAt: '2026-07-31T23:59:00.000Z',
  })
  assert.equal(ok.ok, true)
  assert.equal(ok.value.ctaUrl, 'https://forms.gle/7Hw2ZQoxPvWzaotL9')
  assert.equal(ok.value.ctaLabel, 'Submit inputs')
  assert.equal(ok.value.ctaDeadlineAt, '2026-07-31T23:59:00.000Z')

  const missingLabel = validateEditableContent('announcement', {
    slug: 'needs-label',
    title: 'Needs a CTA label',
    body: 'This announcement has a URL but no label for the button.',
    ctaUrl: 'https://forms.gle/7Hw2ZQoxPvWzaotL9',
  })
  assert.equal(missingLabel.ok, false)
  assert.match(missingLabel.errors.ctaLabel, /label/i)

  const badUrl = validateEditableContent('announcement', {
    slug: 'bad-url',
    title: 'Bad CTA URL',
    body: 'This announcement has an invalid call to action URL value.',
    ctaUrl: 'not-a-url',
    ctaLabel: 'Submit',
  })
  assert.equal(badUrl.ok, false)
  assert.match(badUrl.errors.ctaUrl, /http/i)
})

test('CSV parser and column heuristics map Google Form exports', () => {
  const { headers, rows } = parseCsv(SAMPLE_CSV)
  assert.equal(headers.includes('Policy recommendation'), true)
  assert.equal(rows.length, 2)

  const map = detectColumnMap(headers)
  assert.equal(map.body, 'Policy recommendation')
  assert.equal(map.theme, 'Theme')
  assert.equal(map.country, 'Country')
  assert.equal(map.submitterType, 'Type of submission')

  const preview = previewCsvImport(SAMPLE_CSV)
  assert.equal(preview.ok, true)
  assert.equal(preview.rowCount, 2)
  assert.equal(preview.preview[0].theme, 'NDCs')

  const parsed = contributionsFromCsv(SAMPLE_CSV)
  assert.equal(parsed.contributions.length, 2)
  assert.match(parsed.contributions[0].body, /1\.5C-aligned NDCs/)
  assert.equal(parsed.contributions[0].source, 'google_form_csv')
  assert.ok(parsed.contributions[0].externalId)

  const again = contributionsFromCsv(SAMPLE_CSV)
  assert.equal(
    again.contributions[0].externalId,
    parsed.contributions[0].externalId,
  )
})

test('extractive synthesis cites contribution IDs', () => {
  const parsed = contributionsFromCsv(SAMPLE_CSV)
  const contributions = parsed.contributions.map((item, index) => ({
    id: `contrib-${index + 1}`,
    status: 'submitted',
    ...item,
  }))
  const synthesis = synthesizeGysContributions(contributions)
  assert.equal(synthesis.counts.total, 2)
  assert.ok(synthesis.counts.byTheme.some((item) => item.label === 'NDCs'))
  assert.ok(synthesis.bullets.length >= 1)
  assert.equal(
    synthesis.bullets[0].citations[0].contributionId,
    contributions[0].id,
  )
  assert.match(synthesis.caveat, /review/i)
})

test('fixture-mode CSV import is idempotent', async (t) => {
  const previousDatabaseUrl = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  t.after(() => {
    if (previousDatabaseUrl == null) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousDatabaseUrl
    if (existsSync(workflowFile)) unlinkSync(workflowFile)
  })

  const { importGysContributionsFromCsv, getGysWorkflow } = await import(
    '../server/lib/gysWorkflow.js'
  )

  const first = await importGysContributionsFromCsv({
    csvText: SAMPLE_CSV,
    authorId: null,
  })
  assert.equal(first.imported, 2)
  assert.equal(first.skipped, 0)

  const second = await importGysContributionsFromCsv({
    csvText: SAMPLE_CSV,
    authorId: null,
  })
  assert.equal(second.imported, 0)
  assert.equal(second.skipped, 2)

  const workflow = await getGysWorkflow()
  assert.equal(workflow.cycle.status, 'synthesis')
  assert.ok(workflow.synthesis.counts.total >= 2)
})
