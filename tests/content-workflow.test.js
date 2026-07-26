import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getAccessProfile, hasCapability } from '../server/lib/access.js'
import {
  createContentRevision,
  getContentRevision,
  listContentPublications,
  publishContentRevision,
  reviewContentRevision,
  submitContentRevision,
  updateContentRevision,
} from '../server/lib/contentWorkflow.js'
import { getEvent, getFeed, setPublishedContent } from '../server/lib/store.js'
import { validateEditableContent } from '../shared/contentValidation.js'

const groups = ['ace', 'finance', 'adaptation', 'health']

function eventPayload(overrides = {}) {
  return {
    slug: 'finance-review-call',
    title: 'Finance review call',
    type: 'wg_call',
    startsAt: '2026-08-14T12:00:00.000Z',
    endsAt: '2026-08-14T13:00:00.000Z',
    description: 'Review the current finance work.',
    wg: 'finance',
    meetingUrl: 'https://example.org/meeting',
    recordingUrl: '',
    ...overrides,
  }
}

test('editable events and announcements receive field-level validation', () => {
  const invalidEvent = validateEditableContent(
    'event',
    eventPayload({
      slug: 'Not a slug',
      endsAt: '2026-08-14T11:00:00.000Z',
      wg: 'unknown',
    }),
    { groupSlugs: groups },
  )
  assert.equal(invalidEvent.ok, false)
  assert.ok(invalidEvent.errors.slug)
  assert.ok(invalidEvent.errors.endsAt)
  assert.ok(invalidEvent.errors.wg)

  const announcement = validateEditableContent('announcement', {
    slug: 'registration-update',
    title: 'Registration update',
    body: 'Registration is open for the next onboarding cohort.',
    pinned: true,
  })
  assert.equal(announcement.ok, true)
  assert.equal(announcement.value.pinned, true)
})

test('content responsibilities derive narrow capabilities', async () => {
  const editor = await getAccessProfile({
    id: 'editor',
    role: 'member',
    teamRoles: ['content_editor'],
    wgInterests: [],
  })
  const publisher = await getAccessProfile({
    id: 'publisher',
    role: 'member',
    teamRoles: ['content_publisher'],
    wgInterests: [],
  })
  const member = await getAccessProfile({
    id: 'member',
    role: 'member',
    teamRoles: [],
    wgInterests: [],
  })

  assert.equal(hasCapability(editor, 'content.draft'), true)
  assert.equal(hasCapability(editor, 'content.publish'), false)
  assert.equal(hasCapability(publisher, 'content.review'), true)
  assert.equal(hasCapability(publisher, 'content.publish'), true)
  assert.equal(hasCapability(publisher, 'accounts.manage'), false)
  assert.equal(hasCapability(member, 'content.draft'), false)
})

test('content follows draft, independent review, and publish before changing the public store', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'youngo-content-'))
  const previous = process.env.CONTENT_WORKFLOW_DIR
  process.env.CONTENT_WORKFLOW_DIR = directory
  t.after(async () => {
    setPublishedContent([])
    if (previous == null) delete process.env.CONTENT_WORKFLOW_DIR
    else process.env.CONTENT_WORKFLOW_DIR = previous
    await rm(directory, { recursive: true, force: true })
  })

  const draft = await createContentRevision({
    actorId: 'editor-a',
    contentType: 'event',
    payload: eventPayload(),
    groupSlugs: groups,
  })
  assert.equal(draft.status, 'draft')
  assert.equal(getEvent('finance-review-call'), null)

  const submitted = await submitContentRevision({
    id: draft.id,
    actorId: 'editor-a',
  })
  assert.equal(submitted.status, 'in_review')
  await assert.rejects(
    reviewContentRevision({
      id: draft.id,
      actorId: 'editor-a',
      decision: 'approve',
    }),
    (error) => error.code === 'separation_of_duties',
  )

  const approved = await reviewContentRevision({
    id: draft.id,
    actorId: 'publisher-b',
    decision: 'approve',
  })
  assert.equal(approved.status, 'approved')
  assert.equal(getEvent('finance-review-call'), null)

  const publication = await publishContentRevision({
    id: draft.id,
    actorId: 'publisher-b',
  })
  assert.equal(publication.contentKey, 'finance-review-call')
  assert.equal((await getContentRevision(draft.id)).status, 'published')
  assert.equal((await listContentPublications()).length, 1)
  assert.equal(getEvent('finance-review-call').title, 'Finance review call')
  assert.equal(getEvent('finance-review-call').wg.slug, 'finance')
})

test('requested changes return to the editor and published announcements reach the feed', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'youngo-announcement-'))
  const previous = process.env.CONTENT_WORKFLOW_DIR
  process.env.CONTENT_WORKFLOW_DIR = directory
  t.after(async () => {
    setPublishedContent([])
    if (previous == null) delete process.env.CONTENT_WORKFLOW_DIR
    else process.env.CONTENT_WORKFLOW_DIR = previous
    await rm(directory, { recursive: true, force: true })
  })

  const draft = await createContentRevision({
    actorId: 'editor-a',
    contentType: 'announcement',
    payload: {
      slug: 'onboarding-window',
      title: 'Onboarding window',
      body: 'The next onboarding window opens on Monday.',
      pinned: true,
    },
  })
  await submitContentRevision({ id: draft.id, actorId: 'editor-a' })
  const returned = await reviewContentRevision({
    id: draft.id,
    actorId: 'publisher-b',
    decision: 'request_changes',
    note: 'Include the closing date.',
  })
  assert.equal(returned.status, 'changes_requested')

  const updated = await updateContentRevision({
    id: draft.id,
    actorId: 'editor-a',
    payload: {
      ...returned.payload,
      body: 'The next onboarding window opens on Monday and closes on Friday.',
    },
  })
  assert.equal(updated.status, 'draft')
  await submitContentRevision({ id: draft.id, actorId: 'editor-a' })
  await reviewContentRevision({
    id: draft.id,
    actorId: 'publisher-b',
    decision: 'approve',
  })
  await publishContentRevision({ id: draft.id, actorId: 'publisher-b' })

  assert.equal(
    getFeed(new Date()).pinned.some(
      (item) =>
        item.slug === 'onboarding-window' && item.body.includes('Friday'),
    ),
    true,
  )
})
