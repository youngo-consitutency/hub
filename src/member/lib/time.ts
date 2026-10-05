import type { AnyValue } from './types'
// Canonical time display and countdown.
// All params explicit so node --test can pin tz/now.

export function localTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Intl.DateTimeFormat construction is the expensive part of date formatting;
// cache one instance per (tz, options) pair — every card in a list used to
// build three or four of these per render.
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: AnyValue, options: Intl.DateTimeFormatOptions) {
  const key = `${tz || ''}|${JSON.stringify(options)}`
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', { ...options, ...(tz ? { timeZone: tz } : {}) })
    formatterCache.set(key, fmt)
  }
  return fmt
}

export function fmtDay(iso: AnyValue, tz: AnyValue) {
  return formatter(tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))
}

function hm(iso: AnyValue, tz: AnyValue) {
  return formatter(tz, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

function zoneAbbr(iso: AnyValue, tz: AnyValue) {
  const parts = formatter(tz, { hour: '2-digit', timeZoneName: 'short' }).formatToParts(
    new Date(iso),
  )
  return parts.find((p) => p.type === 'timeZoneName')?.value || tz
}

// "Wed 15 Jul · 13:00 UTC · 16:00 EAT"; single time when viewer zone is UTC.
export function fmtDual(iso: AnyValue, tz = localTz()) {
  const day = fmtDay(iso, 'UTC')
  const utc = `${hm(iso, 'UTC')} UTC`
  const zone = zoneAbbr(iso, tz)
  if (zone === 'UTC' || zone === 'GMT') return `${day} · ${utc}`
  return `${day} · ${utc} · ${hm(iso, tz)} ${zone}`
}

export function fmtMoment(iso: AnyValue, tz = localTz()) {
  const zone = zoneAbbr(iso, tz)
  const isUtc = zone === 'UTC' || zone === 'GMT'
  return {
    day: fmtDay(iso, tz),
    localTime: hm(iso, tz),
    localZone: isUtc ? 'UTC' : zone,
    utcTime: hm(iso, 'UTC'),
    isUtc,
  }
}

export function fmtDateRange(startsOn: AnyValue, endsOn: AnyValue, datesTbc: AnyValue) {
  if (!startsOn) return 'Dates TBC'
  const fmt = (d: AnyValue) =>
    formatter('UTC', { day: 'numeric', month: 'short' }).format(new Date(d + 'T00:00:00Z'))
  const year = startsOn.slice(0, 4)
  const range = endsOn && endsOn !== startsOn ? `${fmt(startsOn)}–${fmt(endsOn)}` : fmt(startsOn)
  return `${range} ${year}${datesTbc ? ' · TBC' : ''}`
}

// Thresholds per design system §6.3: >7d neutral, ≤7d warn, ≤48h danger.
export function countdown(iso: AnyValue, now = new Date()) {
  const ms = new Date(iso).getTime() - now.getTime()
  if (ms <= 0) return { label: 'closed', tone: 'danger' }
  const totalH = Math.floor(ms / 3600000)
  const d = Math.floor(totalH / 24)
  const label =
    totalH >= 48
      ? `${d}d ${String(totalH % 24).padStart(2, '0')}h`
      : totalH >= 2
        ? `${totalH}h`
        : `${Math.max(1, Math.floor(ms / 60000))}m`
  const tone = totalH < 48 ? 'danger' : d <= 7 ? 'warn' : 'neutral'
  return { label, tone }
}

export function formatDateTime(value: AnyValue) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not set'
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}
