import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createApp } from '../server/app.js'
import {
  normalizeFollowPreferences,
  pagination,
} from '../server/lib/negotiations.js'

async function withApp(run) {
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}`)
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
  }
}

test('negotiation public list and detail expose only published fixture projections', async () => {
  await withApp(async (origin) => {
    const listResponse = await fetch(`${origin}/api/negotiations`)
    const list = await listResponse.json()
    assert.equal(listResponse.status, 200)
    assert.equal(list.total, 1)
    assert.equal(list.items[0].slug, 'fixture-community-resilience')
    assert.equal(Object.hasOwn(list.items[0], 'calls'), false)
    assert.equal(Object.hasOwn(list.items[0], 'followers'), false)
    assert.equal(Object.hasOwn(list.items[0], 'candidates'), false)

    const detail = await fetch(
      `${origin}/api/negotiations/fixture-community-resilience`,
    ).then((response) => response.json())
    assert.equal(detail.fixture, true)
    assert.equal(detail.agendaItems.length, 2)
    assert.equal(detail.documents[0].versionCount, 2)
    assert.equal(detail.documents[0].health.coverageState, 'stale')
    assert.equal(Object.hasOwn(detail, 'followerCount'), false)
  })
})

test('fixed negotiation collection routes take precedence over the slug route', async () => {
  await withApp(async (origin) => {
    const response = await fetch(`${origin}/api/negotiations/calls`)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].id, 'fixture-call-date-only')
  })
})

test('date-only call API retains precision without an invented time or timezone', async () => {
  await withApp(async (origin) => {
    const body = await fetch(`${origin}/api/negotiations/calls`).then(
      (response) => response.json(),
    )
    assert.deepEqual(body.items[0].externalDeadline, {
      date: '2026-10-15',
      precision: 'date',
    })
  })
})

test('immutable version endpoint exposes uncertainty and the exact hash', async () => {
  await withApp(async (origin) => {
    const response = await fetch(
      `${origin}/api/negotiations/documents/fixture-document-brief/versions/fixture-version-v2`,
    )
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.version.contentHash, 'sha256:fixture-version-two')
    assert.equal(body.extractionUncertain, true)
    assert.equal(body.version.supersedesVersionId, 'fixture-version-v1')
  })
})

test('anonymous callers cannot create or delete private follows', async () => {
  await withApp(async (origin) => {
    for (const method of ['PUT', 'DELETE']) {
      const response = await fetch(
        `${origin}/api/negotiations/fixture-community-resilience/follow`,
        {
          method,
          headers: { 'content-type': 'application/json' },
          body: method === 'PUT' ? JSON.stringify({ accountId: 'other' }) : undefined,
        },
      )
      assert.equal(response.status, 401)
      assert.equal((await response.json()).error.code, 'unauthorized')
    }
  })
})

test('anonymous callers cannot submit extraction reviews', async () => {
  await withApp(async (origin) => {
    const response = await fetch(
      `${origin}/api/negotiations/documents/fixture-document-brief/versions/fixture-version-v2/extraction-reviews`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: 0,
          text: 'Synthetic corrected extraction',
          confidence: 1,
          note: 'Synthetic review evidence',
        }),
      },
    )
    assert.equal(response.status, 401)
  })
})

test('follow preferences are allowlisted and pagination is capped', () => {
  assert.deepEqual(
    normalizeFollowPreferences({
      accountId: 'ignored',
      deadlineAlerts: false,
      substantiveChangeAlerts: true,
      digestFrequency: 'hourly',
    }),
    {
      deadlineAlerts: false,
      substantiveChangeAlerts: true,
      digestFrequency: 'weekly',
    },
  )
  assert.deepEqual(pagination({ page: '-1', pageSize: '500' }), {
    page: 1,
    pageSize: 50,
    offset: 0,
  })
})

test('migration 028 defines additive immutable tracking and private follow constraints', async () => {
  const sql = await readFile(
    new URL('../migrations/028_negotiation_tracking.sql', import.meta.url),
    'utf8',
  )
  assert.match(sql, /CREATE TABLE IF NOT EXISTS negotiation_tracks/)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS negotiation_agenda_lineage/)
  assert.match(sql, /UNIQUE \(document_id, content_hash\)/)
  assert.match(sql, /quarantine_status/)
  assert.match(sql, /original_content bytea NOT NULL/)
  assert.match(sql, /CREATE TABLE IF NOT EXISTS negotiation_document_extractions/)
  assert.match(sql, /PRIMARY KEY \(account_id, track_id\)/)
  assert.match(sql, /external_deadline_precision/)
  assert.doesNotMatch(sql, /ALTER TABLE submissions/)
})
