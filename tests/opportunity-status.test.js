import assert from 'node:assert/strict'
import test from 'node:test'
import {
  groupOpportunitiesByStatus,
  isOpportunityClosed,
} from '../src/lib/opportunityStatus.js'

const now = Date.parse('2026-08-25T00:00:00.000Z')

test('opportunities close when their application deadline passes', () => {
  assert.equal(
    isOpportunityClosed({ deadlineAt: '2026-08-24T23:59:59.000Z' }, now),
    true,
  )
  assert.equal(
    isOpportunityClosed({ deadlineAt: '2026-08-26T00:00:00.000Z' }, now),
    false,
  )
})

test('event end time is the fallback when there is no deadline', () => {
  assert.equal(
    isOpportunityClosed({ endsAt: '2026-08-24T23:59:59.000Z' }, now),
    true,
  )
  assert.equal(isOpportunityClosed({}, now), false)
})

test('filtered opportunities partition into stable open and closed groups', () => {
  const items = [
    { id: 'future', deadlineAt: '2026-08-26T00:00:00.000Z' },
    { id: 'undated' },
    { id: 'past', deadlineAt: '2026-08-24T00:00:00.000Z' },
  ]

  assert.deepEqual(groupOpportunitiesByStatus(items, now), {
    open: [items[0], items[1]],
    closed: [items[2]],
  })
})
