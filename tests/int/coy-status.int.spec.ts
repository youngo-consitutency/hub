import { describe, it, expect } from 'vitest'

import {
  coyApplicationsAreOpen,
  coyDisplayStatus,
  resolveCoyStatus,
} from '../../src/shared/coyStatus'

const at = (iso: string) => new Date(iso)

describe('coy status', () => {
  const open = { status: 'applications_open', applicationsCloseAt: '2026-09-05T23:59:00Z' }

  it('closes applications at the deadline', () => {
    expect(coyApplicationsAreOpen(open, at('2026-09-01T00:00:00Z'))).toBe(true)
    expect(resolveCoyStatus(open, at('2026-09-06T00:00:00Z'))).toBe('applications_closed')
  })

  it('concludes after the last day', () => {
    const coy = { status: 'registration_open', endsOn: '2026-11-07' }
    expect(resolveCoyStatus(coy, at('2026-11-07T20:00:00Z'))).toBe('registration_open')
    expect(resolveCoyStatus(coy, at('2026-11-08T00:00:01Z'))).toBe('concluded')
  })

  it('reads as under way between the first and last day', () => {
    const coy = { status: 'registration_open', startsOn: '2026-11-05', endsOn: '2026-11-07' }
    expect(coyDisplayStatus(coy, at('2026-11-06T12:00:00Z'))).toBe('underway')
    expect(coyDisplayStatus(coy, at('2026-11-04T12:00:00Z'))).toBe('registration_open')
  })

  it('reads an announced host without dates as endorsed', () => {
    expect(coyDisplayStatus({ status: 'announced', datesTbc: true })).toBe('endorsed')
    expect(coyDisplayStatus({ status: 'announced' })).toBe('announced')
  })

  it('keeps cancelled sticky', () => {
    const coy = { status: 'cancelled', startsOn: '2026-11-05', endsOn: '2026-11-07' }
    expect(coyDisplayStatus(coy, at('2026-11-06T12:00:00Z'))).toBe('cancelled')
  })
})
