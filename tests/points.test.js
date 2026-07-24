import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  POINT_REASONS,
  awardOrgPoints,
  getOrgPointsBalance,
  listAwardSuggestions,
  listOrgPointsLedger,
  listPublicRecognitionBoard,
  reasonFromNgoRequestKind,
  tiersForBalance,
} from '../server/lib/points.js'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ORG = 'org-points-test-1'
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data')
const ledgerFile = path.join(dataDir, 'ngo-point-ledger.json')
const requestsFile = path.join(dataDir, 'ngo-requests.json')
let originalLedger = null
let originalRequests = null

describe('NGO contribution points', () => {
  before(() => {
    originalLedger = existsSync(ledgerFile) ? readFileSync(ledgerFile, 'utf8') : null
    originalRequests = existsSync(requestsFile) ? readFileSync(requestsFile, 'utf8') : null
  })

  after(() => {
    if (originalLedger != null) writeFileSync(ledgerFile, originalLedger)
    if (originalRequests != null) writeFileSync(requestsFile, originalRequests)
  })

  before(async () => {
    // Clear fixture ledger for this org by awarding net-zero via void isn't available —
    // tests use unique titles and assert balance deltas where possible.
  })

  it('defines default points for badge and UNFCCC support', () => {
    assert.equal(POINT_REASONS.badge_support.defaultPoints, 10)
    assert.equal(POINT_REASONS.unfccc_submission.defaultPoints, 15)
    assert.equal(reasonFromNgoRequestKind('endorse'), 'endorse_document')
    assert.equal(reasonFromNgoRequestKind('submit'), 'unfccc_submission')
    assert.equal(reasonFromNgoRequestKind('badge_support'), 'badge_support')
  })

  it('computes recognition tiers from balance', () => {
    assert.equal(tiersForBalance(0).current, null)
    assert.equal(tiersForBalance(25).current.id, 'contributor')
    assert.equal(tiersForBalance(55).current.id, 'active_partner')
    assert.equal(tiersForBalance(55).next.id, 'core_partner')
    assert.equal(tiersForBalance(55).pointsToNext, 45)
  })

  it('awards points and updates balance in fixture mode', async () => {
    const before = await getOrgPointsBalance(ORG)
    const result = await awardOrgPoints({
      orgAccountId: ORG,
      reasonCode: 'badge_support',
      title: 'Supported COP badge pool allocation',
      points: 10,
      awardedBy: 'staff-1',
    })
    assert.equal(result.entry.points, 10)
    assert.equal(result.entry.reasonCode, 'badge_support')
    assert.equal(result.balance, before + 10)

    const unfccc = await awardOrgPoints({
      orgAccountId: ORG,
      reasonCode: 'unfccc_submission',
      title: 'Co-supported GGA indicators submission',
      awardedBy: 'staff-1',
    })
    assert.equal(unfccc.entry.points, 15)
    assert.equal(unfccc.balance, before + 25)

    const ledger = await listOrgPointsLedger(ORG, { limit: 10 })
    assert.ok(ledger.some((e) => e.title.includes('badge pool')))
    assert.ok(ledger.some((e) => e.reasonCode === 'unfccc_submission'))
  })

  it('rejects invalid reason codes and zero points without defaults', async () => {
    await assert.rejects(
      () => awardOrgPoints({ orgAccountId: ORG, reasonCode: 'not_real', title: 'x' }),
      /Unknown contribution/,
    )
    await assert.rejects(
      () => awardOrgPoints({ orgAccountId: ORG, reasonCode: 'adjustment', title: 'noop', points: 0 }),
      /non-zero/,
    )
  })

  it('suggests awards for done requests and drops them after linked award', async () => {
    mkdirSync(dataDir, { recursive: true })
    const requestId = `req-suggest-${Date.now()}`
    writeFileSync(path.join(dataDir, 'ngo-requests.json'), JSON.stringify([{
      id: requestId,
      org_account_id: ORG,
      kind: 'badge_support',
      title: 'Helped with pool badge allocation',
      status: 'done',
      created_at: new Date().toISOString(),
    }], null, 2))

    const before = await listAwardSuggestions({ limit: 50 })
    assert.ok(before.some((s) => s.requestId === requestId))

    await awardOrgPoints({
      orgAccountId: ORG,
      reasonCode: 'badge_support',
      title: 'Helped with pool badge allocation',
      points: 10,
      relatedType: 'ngo_request',
      relatedId: requestId,
      awardedBy: 'staff-1',
    })

    const after = await listAwardSuggestions({ limit: 50 })
    assert.ok(!after.some((s) => s.requestId === requestId))
  })

  it('builds a public recognition board without emails', async () => {
    const board = await listPublicRecognitionBoard({ limit: 20 })
    assert.ok(Array.isArray(board))
    for (const row of board) {
      assert.ok(row.rank >= 1)
      assert.ok(row.balance > 0)
      assert.equal(row.email, undefined)
    }
  })
})
