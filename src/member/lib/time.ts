/** Anything `new Date()` accepts: an ISO string, a timestamp or a Date. */
type DateInput = string | number | Date

// Canonical time display and countdown.
// All params explicit so node --test can pin tz/now.

function localTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Cache one Intl.DateTimeFormat per (tz, options): construction is the expensive part.
const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string | undefined, options: Intl.DateTimeFormatOptions) {
  const key = `${tz || ''}|${JSON.stringify(options)}`
  let fmt = formatterCache.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', { ...options, ...(tz ? { timeZone: tz } : {}) })
    formatterCache.set(key, fmt)
  }
  return fmt
}

function fmtDay(iso: DateInput, tz: string) {
  return formatter(tz, { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(iso))
}

function fmtYear(iso: DateInput, tz: string) {
  return formatter(tz, { year: 'numeric' }).format(new Date(iso))
}

/** The one date format: "Mon 01 Nov, 2026". A date-only string ("2026-11-01") is read as UTC. */
export function fmtDate(value: DateInput, tz = localTz()) {
  const dateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const iso = dateOnly ? `${value}T00:00:00Z` : value
  const zone = dateOnly ? 'UTC' : tz
  return `${fmtDay(iso, zone)}, ${fmtYear(iso, zone)}`
}

/** The one date-and-time format: "09:45, Mon 01 Nov, 2026". */
export function fmtStamp(iso: DateInput, tz = localTz()) {
  return `${hm(iso, tz)}, ${fmtDate(iso, tz)}`
}

function hm(iso: DateInput, tz: string) {
  return formatter(tz, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

function zoneAbbr(iso: DateInput, tz: string) {
  const parts = formatter(tz, { hour: '2-digit', timeZoneName: 'short' }).formatToParts(
    new Date(iso),
  )
  return parts.find((p) => p.type === 'timeZoneName')?.value || tz
}

// "09:45, Mon 01 Nov, 2026 UTC"; adds "· 12:45 EAT" when the viewer's zone is not UTC.
export function fmtDual(iso: DateInput, tz = localTz()) {
  const utc = `${fmtStamp(iso, 'UTC')} UTC`
  const zone = zoneAbbr(iso, tz)
  if (zone === 'UTC' || zone === 'GMT') return utc
  return `${utc} · ${hm(iso, tz)} ${zone}`
}

export function fmtMoment(iso: DateInput, tz = localTz()) {
  const zone = zoneAbbr(iso, tz)
  const isUtc = zone === 'UTC' || zone === 'GMT'
  return {
    stamp: fmtStamp(iso, tz),
    date: fmtDate(iso, tz),
    localTime: hm(iso, tz),
    localZone: isUtc ? 'UTC' : zone,
    utcTime: hm(iso, 'UTC'),
    isUtc,
  }
}

export function fmtDateRange(
  startsOn: string | null | undefined,
  endsOn?: string | null,
  datesTbc?: boolean,
) {
  if (!startsOn) return 'Dates TBC'
  const dm = (d: string) =>
    formatter('UTC', { day: '2-digit', month: 'short' }).format(new Date(d + 'T00:00:00Z'))
  const range = endsOn && endsOn !== startsOn ? `${dm(startsOn)} – ${dm(endsOn)}` : dm(startsOn)
  return `${range}, ${startsOn.slice(0, 4)}${datesTbc ? ' · TBC' : ''}`
}

// Thresholds per design system §6.3: >7d neutral, ≤7d warn, ≤48h danger.
export function countdown(
  iso: DateInput,
  now = new Date(),
): { label: string; tone: 'danger' | 'warn' | 'neutral' } {
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

export function formatDateTime(value: DateInput | null | undefined) {
  if (!value) return 'Not set'
  return Number.isNaN(new Date(value).getTime()) ? 'Not set' : fmtStamp(value)
}

/** Date only, for fields that may be empty or malformed. */
export function formatDateOnly(value: DateInput | null | undefined, fallback = 'Not set') {
  if (!value) return fallback
  const text = String(value).match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value
  return Number.isNaN(new Date(text as DateInput).getTime()) ? String(value) : fmtDate(text)
}
