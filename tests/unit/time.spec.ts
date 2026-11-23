import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateRange, fmtDual, fmtStamp } from '../../src/member/lib/time'

describe('date formats', () => {
  it('formats a moment as "09:45, Sun 01 Nov, 2026"', () => {
    expect(fmtStamp('2026-11-01T09:45:00Z', 'UTC')).toBe('09:45, Sun 01 Nov, 2026')
  })

  it('reads a date-only value as a whole UTC day in any zone', () => {
    expect(fmtDate('2026-11-01', 'America/Bogota')).toBe('Sun 01 Nov, 2026')
    expect(fmtStamp('2026-11-01', 'America/Bogota')).toBe('00:00, Sun 01 Nov, 2026')
  })

  it('adds the viewer zone only when it is not UTC', () => {
    expect(fmtDual('2026-11-01T09:45:00Z', 'UTC')).toBe('09:45, Sun 01 Nov, 2026 UTC')
    expect(fmtDual('2026-11-01T09:45:00Z', 'Africa/Nairobi')).toMatch(/UTC · 12:45 /)
  })

  it('formats a date range with the year once', () => {
    expect(fmtDateRange('2026-11-01', '2026-11-03', true)).toBe('01 Nov – 03 Nov, 2026 · TBC')
  })
})
