import test from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.js'
import { createSession } from '../server/lib/accounts.js'
import {
  setPublishedContent,
  setUnpublishedContent,
} from '../server/lib/store.js'

const dataDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../data',
)
const files = [
  'hub-accounts.json',
  'hub-sessions.json',
  'governance-audit.json',
].map((name) => path.join(dataDir, name))

function account(id, overrides = {}) {
  return {
    id,
    email: `${id}@example.org`,
    password_hash: 'hash',
    password_salt: 'salt',
    name: id,
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
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function eventPayload(overrides = {}) {
  return {
    slug: 'ace-apply-now-call',
    title: 'ACE apply-now call',
    type: 'wg_call',
    startsAt: '2026-09-01T12:00:00.000Z',
    endsAt: '2026-09-01T13:00:00.000Z',
    description: 'Original ACE call description.',
    wg: 'ace',
    meetingUrl: 'https://example.org/ace-meeting',
    ...overrides,
  }
}

test('agents can get, partially apply, and unpublish live events through the member API', async (t) => {
  const workflowDirectory = await mkdtemp(
    path.join(tmpdir(), 'youngo-live-api-'),
  )
  const previousWorkflow = process.env.CONTENT_WORKFLOW_DIR
  process.env.CONTENT_WORKFLOW_DIR = workflowDirectory
  const backups = new Map(
    files.map((file) => [
      file,
      existsSync(file) ? readFileSync(file, 'utf8') : null,
    ]),
  )
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(
    path.join(dataDir, 'hub-accounts.json'),
    JSON.stringify([
      account('live-editor', { team_roles: ['content_editor'] }),
      account('live-publisher', { team_roles: ['content_publisher'] }),
      account('live-admin', { role: 'admin' }),
    ]),
  )
  writeFileSync(path.join(dataDir, 'hub-sessions.json'), '[]')
  writeFileSync(path.join(dataDir, 'governance-audit.json'), '[]')

  const editor = await createSession('live-editor')
  const publisher = await createSession('live-publisher')
  const admin = await createSession('live-admin')
  const server = createApp({ env: {} }).listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  const json = { 'content-type': 'application/json' }

  t.after(async () => {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    )
    setPublishedContent([])
    setUnpublishedContent([])
    if (previousWorkflow == null) delete process.env.CONTENT_WORKFLOW_DIR
    else process.env.CONTENT_WORKFLOW_DIR = previousWorkflow
    await rm(workflowDirectory, { recursive: true, force: true })
    for (const [file, content] of backups) {
      if (content == null) rmSync(file, { force: true })
      else writeFileSync(file, content)
    }
  })

  const created = await fetch(`${origin}/api/member/content/drafts`, {
    method: 'POST',
    headers: { ...json, 'x-session-token': editor.token },
    body: JSON.stringify({ contentType: 'event', payload: eventPayload() }),
  })
  assert.equal(created.status, 201)
  const draftId = (await created.json()).item.id

  assert.equal(
    (
      await fetch(`${origin}/api/member/content/drafts/${draftId}/submit`, {
        method: 'POST',
        headers: { ...json, 'x-session-token': editor.token },
        body: '{}',
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await fetch(`${origin}/api/member/content/drafts/${draftId}/review`, {
        method: 'POST',
        headers: { ...json, 'x-session-token': publisher.token },
        body: JSON.stringify({ decision: 'approve' }),
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await fetch(`${origin}/api/member/content/drafts/${draftId}/publish`, {
        method: 'POST',
        headers: { ...json, 'x-session-token': publisher.token },
        body: '{}',
      })
    ).status,
    200,
  )

  const loaded = await fetch(
    `${origin}/api/member/content/live/event/ace-apply-now-call`,
    { headers: { 'x-session-token': admin.token } },
  )
  assert.equal(loaded.status, 200)
  assert.equal((await loaded.json()).item.title, 'ACE apply-now call')

  const editorApply = await fetch(
    `${origin}/api/member/content/live/event/ace-apply-now-call`,
    {
      method: 'PATCH',
      headers: { ...json, 'x-session-token': editor.token },
      body: JSON.stringify({
        mode: 'apply',
        payload: { title: 'Should not write' },
      }),
    },
  )
  assert.equal(editorApply.status, 403)
  assert.equal((await editorApply.json()).error.code, 'forbidden')

  const invalid = await fetch(
    `${origin}/api/member/content/live/event/ace-apply-now-call`,
    {
      method: 'PATCH',
      headers: { ...json, 'x-session-token': admin.token },
      body: JSON.stringify({
        mode: 'apply',
        payload: { type: 'party', startsAt: 'not-an-iso-datetime' },
      }),
    },
  )
  assert.equal(invalid.status, 400)
  const invalidBody = await invalid.json()
  assert.equal(invalidBody.error.code, 'validation')
  assert.ok(invalidBody.error.fields.type)
  assert.ok(invalidBody.error.fields.startsAt)

  const applied = await fetch(
    `${origin}/api/member/content/live/event/ace-apply-now-call`,
    {
      method: 'PATCH',
      headers: { ...json, 'x-session-token': admin.token },
      body: JSON.stringify({
        mode: 'apply',
        payload: {
          title: 'ACE apply-now call (live)',
          startsAt: '2026-09-01T15:00:00.000Z',
          endsAt: '2026-09-01T16:00:00.000Z',
          meetingUrl: 'https://example.org/ace-meeting-live',
        },
      }),
    },
  )
  assert.equal(applied.status, 200)
  const appliedBody = await applied.json()
  assert.equal(appliedBody.item.title, 'ACE apply-now call (live)')
  assert.equal(appliedBody.item.type, 'wg_call')
  assert.equal(appliedBody.item.description, 'Original ACE call description.')

  const listed = await fetch(`${origin}/api/member/content`, {
    headers: { 'x-session-token': admin.token },
  }).then((response) => response.json())
  const live = listed.live.events.filter(
    (item) => item.slug === 'ace-apply-now-call',
  )
  assert.equal(live.length, 1)
  assert.equal(live[0].title, 'ACE apply-now call (live)')
  assert.equal(live[0].meetingUrl, 'https://example.org/ace-meeting-live')

  const unpublished = await fetch(
    `${origin}/api/member/content/live/event/ace-apply-now-call/unpublish`,
    {
      method: 'POST',
      headers: { ...json, 'x-session-token': admin.token },
      body: JSON.stringify({ reason: 'Duplicate listing' }),
    },
  )
  assert.equal(unpublished.status, 200)
  const missing = await fetch(
    `${origin}/api/member/content/live/event/ace-apply-now-call`,
    { headers: { 'x-session-token': admin.token } },
  )
  assert.equal(missing.status, 404)
})
