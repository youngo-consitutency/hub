import assert from 'node:assert/strict'
import test from 'node:test'
import {
  coyApplicationsAreOpen,
  resolveCoyStatus,
} from '../shared/coyStatus.js'

const coy21 = {
  slug: 'coy21',
  status: 'applications_open',
  startsOn: '2026-11-05',
  endsOn: '2026-11-07',
  applicationsCloseAt: '2026-09-05T23:59:00.000Z',
}

test('COY applications stay open before the close timestamp', () => {
  const now = new Date('2026-09-05T12:00:00.000Z')
  assert.equal(resolveCoyStatus(coy21, now), 'applications_open')
  assert.equal(coyApplicationsAreOpen(coy21, now), true)
})

test('COY applications close after the recorded deadline', () => {
  const now = new Date('2026-09-16T13:00:00.000Z')
  assert.equal(resolveCoyStatus(coy21, now), 'applications_closed')
  assert.equal(coyApplicationsAreOpen(coy21, now), false)
})

test('a COY whose dates have passed is concluded', () => {
  const now = new Date('2026-11-08T00:00:00.000Z')
  assert.equal(resolveCoyStatus(coy21, now), 'concluded')
})

test('cancelled stays cancelled even after the deadline', () => {
  assert.equal(
    resolveCoyStatus(
      { ...coy21, status: 'cancelled' },
      new Date('2026-09-16T13:00:00.000Z'),
    ),
    'cancelled',
  )
})
