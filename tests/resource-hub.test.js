import assert from 'node:assert/strict'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createApp } from '../server/app.js'
import { createSession } from '../server/lib/accounts.js'
import {
  createContentRevision,
  publishContentRevision,
  reviewContentRevision,
  submitContentRevision,
} from '../server/lib/contentWorkflow.js'
import { validateEditableContent } from '../shared/contentValidation.js'

function resourcePayload(overrides = {}) {
  return {
    slug: 'climate-policy-radar',
    title: 'Climate Policy Radar',
    url: 'https://www.climatepolicyradar.org/',
    summary:
      'A searchable public database of climate laws and policies for research and advocacy.',
    publisher: 'Climate Policy Radar',
    pathway: 'research',
    type: 'platform',
    topic: 'Policy',
    region: 'global',
    language: 'English',
    ...overrides,
  }
}

test('resource submissions use the canonical public taxonomy', () => {
  const valid = validateEditableContent('resource', resourcePayload())
  assert.equal(valid.ok, true)
  assert.equal(valid.value.pathway, 'research')
  assert.equal(valid.value.region, 'global')

  const invalid = validateEditableContent(
    'resource',
    resourcePayload({ url: 'javascript:alert(1)', topic: 'Anything' }),
  )
  assert.equal(invalid.ok, false)
  assert.ok(invalid.errors.url)
  assert.ok(invalid.errors.topic)
})

test('the starter Science Hub collection follows the same taxonomy', async () => {
  const resources = JSON.parse(
    await readFile(
      new URL('../data/resource-hub.json', import.meta.url),
      'utf8',
    ),
  )
  assert.ok(resources.length >= 8)
  for (const resource of resources) {
    const result = validateEditableContent('resource', resource)
    assert.equal(
      result.ok,
      true,
      `${resource.slug}: ${JSON.stringify(result.errors)}`,
    )
  }
})

test('only independently reviewed and published resources reach the public catalogue', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'youngo-resources-'))
  const previous = process.env.CONTENT_WORKFLOW_DIR
  process.env.CONTENT_WORKFLOW_DIR = directory
  t.after(async () => {
    if (previous == null) delete process.env.CONTENT_WORKFLOW_DIR
    else process.env.CONTENT_WORKFLOW_DIR = previous
    await rm(directory, { recursive: true, force: true })
  })

  const draft = await createContentRevision({
    actorId: 'member-a',
    contentType: 'resource',
    payload: resourcePayload(),
  })
  await submitContentRevision({ id: draft.id, actorId: 'member-a' })

  const app = createApp({ env: {} })
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => server.close())
  const origin = `http://127.0.0.1:${server.address().port}`

  let response = await fetch(`${origin}/api/resources`).then((res) =>
    res.json(),
  )
  assert.equal(
    response.items.some((item) => item.slug === 'climate-policy-radar'),
    true,
  )

  await assert.rejects(
    reviewContentRevision({
      id: draft.id,
      actorId: 'member-a',
      decision: 'approve',
    }),
    (error) => error.code === 'separation_of_duties',
  )
  await reviewContentRevision({
    id: draft.id,
    actorId: 'publisher-b',
    decision: 'approve',
  })
  await publishContentRevision({ id: draft.id, actorId: 'publisher-b' })

  response = await fetch(`${origin}/api/resources`).then((res) => res.json())
  const published = response.items.find(
    (item) => item.slug === 'climate-policy-radar',
  )
  assert.equal(published.title, 'Climate Policy Radar')
  assert.equal(published.url, 'https://www.climatepolicyradar.org/')
  assert.ok(published.publishedAt)
})

test('an ordinary verified member can submit without receiving Content Studio powers', async (t) => {
  const workflowDirectory = await mkdtemp(
    path.join(tmpdir(), 'youngo-member-resource-'),
  )
  const previousWorkflow = process.env.CONTENT_WORKFLOW_DIR
  process.env.CONTENT_WORKFLOW_DIR = workflowDirectory
  const dataDirectory = new URL('../data/', import.meta.url)
  const files = [
    'hub-accounts.json',
    'hub-sessions.json',
    'governance-audit.json',
  ]
  const backups = new Map(
    files.map((name) => {
      const file = new URL(name, dataDirectory)
      return [file, existsSync(file) ? readFileSync(file, 'utf8') : null]
    }),
  )
  writeFileSync(
    new URL('hub-accounts.json', dataDirectory),
    JSON.stringify([
      {
        id: 'resource-member',
        email: 'resource-member@example.org',
        name: 'Resource Member',
        entity_type: 'individual',
        membership_track: 'network',
        country: 'Kenya',
        member_status: 'verified',
        hub_access_status: 'active',
        membership_status: 'active',
        role: 'member',
        team_roles: [],
        wg_interests: [],
        course_passed_at: '2026-01-01T00:00:00.000Z',
      },
    ]),
  )
  writeFileSync(new URL('hub-sessions.json', dataDirectory), '[]')
  writeFileSync(new URL('governance-audit.json', dataDirectory), '[]')

  const session = await createSession('resource-member')
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const headers = {
    'content-type': 'application/json',
    'x-session-token': session.token,
  }
  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
    if (previousWorkflow == null) delete process.env.CONTENT_WORKFLOW_DIR
    else process.env.CONTENT_WORKFLOW_DIR = previousWorkflow
    await rm(workflowDirectory, { recursive: true, force: true })
  })

  const submission = await fetch(`${origin}/api/member/resources/submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(
      resourcePayload({
        slug: undefined,
        url: 'https://example.org/member-resource',
      }),
    ),
  })
  assert.equal(submission.status, 201)
  const submitted = await submission.json()
  assert.equal(submitted.item.status, 'in_review')
  assert.match(submitted.item.contentKey, /^climate-policy-radar-[a-f0-9]{8}$/)

  const mine = await fetch(`${origin}/api/member/resources/submissions/mine`, {
    headers,
  }).then((response) => response.json())
  assert.equal(mine.items.length, 1)
  assert.equal(mine.items[0].contentType, 'resource')

  const contentStudio = await fetch(`${origin}/api/member/content`, { headers })
  assert.equal(contentStudio.status, 403)
})
