import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createApp } from '../server/app.js'
import {
  assertExpectedVersion,
  ContributionError,
  createSubmissionProject,
  normalizeAmendmentInput,
  normalizeAmendmentRevisionInput,
  normalizeDraftVersionInput,
  normalizeProjectInput,
  normalizeReconciliationConfirmationInput,
  normalizeReconciliationSuggestionInput,
} from '../server/lib/negotiationContributions.js'

const citation = {
  sourceVersionId: 'fixture-version-v2',
  location: { page: 1, paragraph: 'fixture-1' },
  quote: 'Synthetic evidence',
}

test('a proposal without a call is explicitly an initiative', () => {
  const project = normalizeProjectInput({
    idempotencyKey: 'project-1',
    trackId: 'fixture-track',
    title: 'Synthetic submission proposal',
    purpose: 'Test the member drafting contract without claiming a mandate.',
    contentText: 'Synthetic first immutable draft.',
    citations: [citation],
  })
  assert.equal(project.callId, null)
  assert.equal(project.isInitiative, true)
  assert.equal(project.intendedSubmittingEntity, null)
})

test('project and draft validation require immutable source citations', () => {
  assert.throws(
    () =>
      normalizeProjectInput({
        idempotencyKey: 'project-missing-citations',
        trackId: 'fixture-track',
        title: 'Synthetic proposal',
        purpose: 'Synthetic purpose',
        contentText: 'Synthetic draft',
        citations: [],
      }),
    (error) => error.code === 'citations_required',
  )
  assert.throws(
    () =>
      normalizeDraftVersionInput({
        idempotencyKey: 'draft-2',
        expectedVersion: 1,
        contentText: 'Second draft',
        citations: [{ sourceVersionId: 'v1' }],
      }),
    (error) => error.code === 'validation',
  )
})

test('member mutations require an explicit bounded idempotency key', () => {
  assert.throws(
    () =>
      normalizeProjectInput({
        trackId: 'fixture-track',
        title: 'Synthetic proposal',
        purpose: 'Synthetic purpose',
        contentText: 'Synthetic draft',
        citations: [citation],
      }),
    (error) => error.code === 'idempotency_required',
  )
})

test('stale draft writers receive a conflict instead of a silent merge', () => {
  assert.doesNotThrow(() => assertExpectedVersion(2, 2))
  assert.throws(
    () => assertExpectedVersion(2, 1),
    (error) =>
      error instanceof ContributionError &&
      error.status === 409 &&
      error.code === 'version_conflict',
  )
})

test('competing amendments can share an anchor and remain separate inputs', () => {
  const base = {
    idempotencyKey: 'amendment-base',
    targetType: 'official_document',
    targetDocumentVersionId: 'fixture-version-v2',
    stableAnchor: { page: 1, paragraph: 'fixture-1', quote: 'Original words' },
    operation: 'replace',
    originalText: 'Original words',
    rationale: 'Synthetic rationale with cited evidence.',
    citations: [citation],
  }
  const first = normalizeAmendmentInput({
    ...base,
    idempotencyKey: 'amendment-a',
    proposedText: 'Alternative wording A',
  })
  const second = normalizeAmendmentInput({
    ...base,
    idempotencyKey: 'amendment-b',
    proposedText: 'Alternative wording B',
  })
  assert.deepEqual(first.stableAnchor, second.stableAnchor)
  assert.notEqual(first.proposedText, second.proposedText)
})

test('delete amendments cannot smuggle replacement wording', () => {
  const amendment = normalizeAmendmentInput({
    idempotencyKey: 'amendment-delete',
    targetType: 'official_document',
    targetDocumentVersionId: 'fixture-version-v2',
    stableAnchor: { page: 1, paragraph: 'fixture-1' },
    operation: 'delete',
    originalText: 'Remove this synthetic paragraph',
    proposedText: 'This input is ignored for a delete',
    rationale: 'Synthetic deletion rationale.',
    citations: [citation],
  })
  assert.equal(amendment.proposedText, null)
})

test('amendment revisions are version-bound and remain evidence-backed', () => {
  const revision = normalizeAmendmentRevisionInput({
    idempotencyKey: 'amendment-revision-2',
    expectedVersion: 1,
    stableAnchor: { page: 2, paragraph: 'fixture-2' },
    operation: 'replace',
    originalText: 'Old wording',
    proposedText: 'Revised wording',
    rationale: 'The revised wording follows the cited evidence.',
    citations: [citation],
  })
  assert.equal(revision.expectedVersion, 1)
  assert.equal(revision.citations[0].sourceVersionId, citation.sourceVersionId)
})

test('reconciliation suggestions require bounded confidence and mapping evidence', () => {
  const suggestion = normalizeReconciliationSuggestionInput({
    idempotencyKey: 'mapping-1',
    expectedAmendmentVersion: 2,
    suggestedDocumentVersionId: 'fixture-version-v3',
    suggestedAnchor: { page: 3, paragraph: 'fixture-3' },
    mappingEvidence: {
      method: 'human-assisted',
      note: 'Same paragraph heading.',
    },
    confidence: 0.82,
  })
  assert.equal(suggestion.expectedAmendmentVersion, 2)
  assert.equal(suggestion.confidence, 0.82)
  assert.throws(
    () =>
      normalizeReconciliationSuggestionInput({
        ...suggestion,
        confidence: 1.1,
      }),
    (error) => error.code === 'validation',
  )
})

test('reconciliation confirmation requires a new evidence citation', () => {
  const confirmation = normalizeReconciliationConfirmationInput({
    idempotencyKey: 'mapping-confirm-1',
    expectedAmendmentVersion: 2,
    note: 'I verified the mapped paragraph against the new source version.',
    citations: [{ ...citation, sourceVersionId: 'fixture-version-v3' }],
  })
  assert.equal(confirmation.expectedAmendmentVersion, 2)
  assert.equal(confirmation.citations[0].sourceVersionId, 'fixture-version-v3')
})

test('fixture mode fails closed for member proposal persistence', async () => {
  await assert.rejects(
    createSubmissionProject({
      account: { id: 'fixture-member' },
      input: {
        idempotencyKey: 'fixture-project',
        trackId: 'fixture-track',
        title: 'Synthetic proposal',
        purpose: 'Synthetic purpose',
        contentText: 'Synthetic draft',
        citations: [citation],
      },
      pool: null,
    }),
    (error) => error.code === 'database_required',
  )
})

test('anonymous callers cannot create projects or amendments', async () => {
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  try {
    for (const path of [
      '/api/negotiations/projects',
      '/api/negotiations/amendments',
      '/api/negotiations/amendments/a1/versions',
      '/api/negotiations/amendments/a1/reconciliations',
      '/api/negotiations/amendments/a1/reconciliations/r1/confirm',
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      assert.equal(response.status, 401)
    }
    const privateRead = await fetch(
      `http://127.0.0.1:${port}/api/negotiations/projects`,
    )
    assert.equal(privateRead.status, 401)
    assert.equal(privateRead.headers.get('cache-control'), 'no-store')
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
})

test('migration 029 keeps projects, versions and amendments separate', async () => {
  const sql = await readFile(
    new URL('../migrations/029_negotiation_contributions.sql', import.meta.url),
    'utf8',
  )
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS negotiation_submission_projects/,
  )
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS negotiation_mutation_idempotency/,
  )
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS negotiation_submission_versions/,
  )
  assert.match(sql, /CREATE TABLE IF NOT EXISTS negotiation_amendments/)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS negotiation_amendment_versions/)
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS negotiation_amendment_reconciliations/,
  )
  assert.match(sql, /confirmed_by uuid REFERENCES hub_accounts/)
  assert.match(sql, /target_type='official_document'/)
  assert.doesNotMatch(sql, /UPDATE\s+negotiation_document_versions/i)
  assert.doesNotMatch(sql, /ALTER TABLE submissions/i)
})

test('member UI labels initiatives and official-text proposals honestly', async () => {
  const [submissionPage, amendmentPage, workspacePage, app] = await Promise.all(
    [
      readFile(
        new URL('../src/pages/SubmissionProposal.jsx', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/AmendmentProposal.jsx', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/pages/SubmissionWorkspace.jsx', import.meta.url),
        'utf8',
      ),
      readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    ],
  )
  assert.match(submissionPage, /No call — save as an initiative/)
  assert.match(submissionPage, /does not claim YOUNGO endorsement/)
  assert.match(amendmentPage, /never modifies the cited official\s+source/)
  assert.match(
    amendmentPage,
    /Competing alternatives remain separate proposals/,
  )
  assert.match(
    workspacePage,
    /not an endorsed position and cannot be transmitted/,
  )
  assert.match(workspacePage, /expectedVersion: project\.currentVersion/)
  assert.match(workspacePage, /Someone saved a newer version/)
  assert.ok(
    app.indexOf('/^\\/submissions\\/workspace\\/(.+)$/') <
      app.indexOf('/^\\/submissions\\/(.+)$/'),
    'private workspace route must precede the legacy submission detail route',
  )
})
