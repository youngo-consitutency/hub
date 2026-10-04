import type { AnyValue } from '../member/lib/types'
const TERMINAL = new Set(['cancelled', 'concluded'])
const CLOSED_APPLICATIONS = new Set(['applications_closed', 'registration_closed'])
const OPEN_APPLICATIONS = new Set(['applications_open', 'registration_open'])

function endOfUtcDay(isoDate: AnyValue) {
  if (!isoDate) return null
  const time = Date.parse(`${String(isoDate).slice(0, 10)}T23:59:59.000Z`)
  return Number.isFinite(time) ? time : null
}

/**
 * Display status for a COY. Stored `applications_open` becomes
 * `applications_closed` after `applicationsCloseAt`, and a past `endsOn`
 * becomes `concluded`.
 */
export function resolveCoyStatus(coy: AnyValue, now = new Date()) {
  if (!coy?.status) return coy?.status
  if (TERMINAL.has(coy.status) || CLOSED_APPLICATIONS.has(coy.status)) {
    return coy.status
  }
  const nowMs = now.getTime()
  const ended = endOfUtcDay(coy.endsOn)
  if (ended != null && ended < nowMs) return 'concluded'
  const closeAt = coy.applicationsCloseAt ? Date.parse(coy.applicationsCloseAt) : NaN
  if (OPEN_APPLICATIONS.has(coy.status) && Number.isFinite(closeAt) && closeAt <= nowMs) {
    return coy.status === 'registration_open' ? 'registration_closed' : 'applications_closed'
  }
  return coy.status
}

export function coyApplicationsAreOpen(coy: AnyValue, now = new Date()) {
  return OPEN_APPLICATIONS.has(resolveCoyStatus(coy, now))
}
