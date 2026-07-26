import test from 'node:test'
import assert from 'node:assert/strict'
import { assembleFeed } from '../server/lib/feed.js'

const now = new Date('2026-07-15T13:00:00Z')
const iso = (h) => new Date(now.getTime() + h * 3600000).toISOString()

const data = {
  events: [
    { slug: 'live', title: 'Live call', startsAt: iso(-0.5), endsAt: iso(1) },
    { slug: 'tomorrow', title: 'Tomorrow', startsAt: iso(24), endsAt: iso(25) },
    {
      slug: 'next-month',
      title: 'Far',
      startsAt: iso(24 * 30),
      endsAt: iso(24 * 30 + 1),
    },
  ],
  submissions: [
    { slug: 'soon', title: 'Soon', status: 'drafting', deadlineAt: iso(40) },
    { slug: 'far', title: 'Far', status: 'open', deadlineAt: iso(24 * 20) },
    { slug: 'done', title: 'Done', status: 'submitted', deadlineAt: iso(-24) },
  ],
  council: [
    {
      slug: 'objection',
      title: 'Objection',
      status: 'objection_window',
      objectionDeadline: iso(70),
      inputDeadline: null,
    },
    {
      slug: 'decided',
      title: 'Decided',
      status: 'adopted',
      objectionDeadline: null,
      inputDeadline: null,
    },
  ],
  announcements: [
    { title: 'Pinned', pinned: true },
    { title: 'Plain', pinned: false },
  ],
  coys: [
    {
      slug: 'ok',
      title: 'OK',
      reviewStatus: 'approved',
      status: 'announced',
      startsOn: '2026-09-01',
    },
    {
      slug: 'hidden',
      title: 'Hidden',
      reviewStatus: 'pending',
      status: 'announced',
      startsOn: '2026-09-01',
    },
    {
      slug: 'over',
      title: 'Over',
      reviewStatus: 'approved',
      status: 'concluded',
      startsOn: '2026-01-01',
    },
  ],
}

test('live event detected by start/end window', () => {
  const feed = assembleFeed(data, now)
  assert.equal(feed.live?.slug, 'live')
})

test('week excludes live, far-future events', () => {
  const feed = assembleFeed(data, now)
  assert.deepEqual(
    feed.week.map((e) => e.slug),
    ['tomorrow'],
  )
})

test('closing mixes submissions and DMP windows, soonest first, ≤14d', () => {
  const feed = assembleFeed(data, now)
  assert.deepEqual(
    feed.closing.map((x) => [x.kind, x.slug]),
    [
      ['submission', 'soon'],
      ['decision', 'objection'],
    ],
  )
})

test('closing never contains submitted/decided items', () => {
  const feed = assembleFeed(data, now)
  assert.ok(
    !feed.closing.some((x) => x.slug === 'done' || x.slug === 'decided'),
  )
})

test('pinned announcements only, unapproved and concluded COYs hidden', () => {
  const feed = assembleFeed(data, now)
  assert.deepEqual(
    feed.pinned.map((a) => a.title),
    ['Pinned'],
  )
  assert.deepEqual(
    feed.coys.map((c) => c.slug),
    ['ok'],
  )
})
