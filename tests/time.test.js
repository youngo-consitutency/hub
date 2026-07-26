import test from 'node:test'
import assert from 'node:assert/strict'
import { fmtDual, fmtMoment, countdown, fmtDateRange } from '../src/lib/time.js'

const now = new Date('2026-07-15T13:00:00Z')
const at = (h) => new Date(now.getTime() + h * 3600000).toISOString()

test('fmtDual renders single time for UTC viewers', () => {
  assert.equal(fmtDual('2026-07-15T13:00:00Z', 'UTC'), 'Wed 15 Jul · 13:00 UTC')
})

test('fmtDual renders dual time for non-UTC viewers', () => {
  const s = fmtDual('2026-07-15T13:00:00Z', 'Africa/Nairobi')
  assert.ok(s.startsWith('Wed 15 Jul · 13:00 UTC · 16:00'), s)
})

test('fmtMoment labels local and UTC times without duplicating UTC', () => {
  assert.deepEqual(fmtMoment('2026-07-15T13:00:00Z', 'UTC'), {
    day: 'Wed 15 Jul',
    localTime: '13:00',
    localZone: 'UTC',
    utcTime: '13:00',
    isUtc: true,
  })
  assert.deepEqual(fmtMoment('2026-07-15T13:00:00Z', 'Africa/Nairobi'), {
    day: 'Wed 15 Jul',
    localTime: '16:00',
    localZone: 'GMT+3',
    utcTime: '13:00',
    isUtc: false,
  })
})

test('countdown tones follow spec thresholds', () => {
  assert.equal(countdown(at(24 * 10), now).tone, 'neutral')
  assert.equal(countdown(at(24 * 3), now).tone, 'warn')
  assert.equal(countdown(at(40), now).tone, 'danger')
  assert.equal(countdown(at(-1), now).tone, 'danger')
})

test('countdown labels use largest units', () => {
  assert.equal(countdown(at(24 * 3 + 6), now).label, '3d 06h')
  assert.equal(countdown(at(26), now).label, '26h')
  assert.equal(countdown(at(0.5), now).label, '30m')
})

test('fmtDateRange handles ranges and TBC', () => {
  assert.equal(
    fmtDateRange('2026-09-12', '2026-09-14', false),
    '12 Sept–14 Sept 2026',
  )
  assert.equal(fmtDateRange(null, null, false), 'Dates TBC')
})
