import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// The synthetic fixture lives under gitignored openspec/ demo data, so it is
// absent on clean checkouts (CI); these tests skip there and run locally.
const fixture = await readFile(
  new URL(
    '../openspec/changes/add-negotiation-workspace/fixtures/s0-negotiation-sources.json',
    import.meta.url,
  ),
  'utf8',
)
  .then((text) => JSON.parse(text))
  .catch(() => null)

const SKIP_FIXTURE = fixture
  ? false
  : 'synthetic negotiation fixture is not bundled in this checkout'

test(
  'negotiation S0 evidence is unmistakably synthetic and contains no account data',
  { skip: SKIP_FIXTURE },
  () => {
    assert.equal(fixture.fixtureOnly, true)
    assert.match(fixture.notice, /Synthetic/)
    const serialized = JSON.stringify(fixture).toLowerCase()
    for (const forbidden of [
      'password_hash',
      'password_salt',
      'session_token',
      'guardian',
      'minority',
      'account_email',
      'account_phone',
    ]) {
      assert.equal(serialized.includes(forbidden), false, forbidden)
    }
  },
)

test(
  'same-URL replacement retains distinct immutable source versions',
  { skip: SKIP_FIXTURE },
  () => {
    const document = fixture.documents[0]
    assert.equal(
      document.sourceUrl,
      'https://example.invalid/fixture/brief.pdf',
    )
    assert.equal(document.versions.length, 2)
    assert.notEqual(
      document.versions[0].contentHash,
      document.versions[1].contentHash,
    )
    assert.equal(
      document.versions[1].supersedesVersionId,
      document.versions[0].id,
    )
  },
)

test(
  'agenda lineage preserves both session-specific item numbers',
  { skip: SKIP_FIXTURE },
  () => {
    const [earlier, later] = fixture.agendaItems
    assert.equal(earlier.item, '5')
    assert.equal(later.item, '7')
    assert.deepEqual(later.lineageFrom, [earlier.id])
    assert.deepEqual(later.trackIds, earlier.trackIds)
  },
)

test(
  'date-only deadline does not invent a time or timezone',
  { skip: SKIP_FIXTURE },
  () => {
    const deadline = fixture.calls[0].externalDeadline
    assert.deepEqual(deadline, {
      date: '2026-10-15',
      precision: 'date',
      time: null,
      timezone: null,
    })
  },
)

test(
  'failed source check retains last success and reports stale coverage',
  { skip: SKIP_FIXTURE },
  () => {
    const health = fixture.documents[0].health
    assert.equal(health.lastAttemptStatus, 'failed')
    assert.equal(health.coverageState, 'stale')
    assert.ok(health.lastSuccessfulCheckAt)
    assert.ok(health.lastAttemptAt > health.lastSuccessfulCheckAt)
  },
)

test(
  'group evidence is not inherited as a member Party position',
  { skip: SKIP_FIXTURE },
  () => {
    const party = fixture.actors.find((actor) => actor.type === 'party')
    const directPartyClaims = fixture.positionClaims.filter(
      (claim) => claim.actorId === party.id,
    )
    assert.equal(directPartyClaims.length, 0)
    assert.equal(fixture.positionClaims[0].actorId, 'fixture-group')
  },
)
