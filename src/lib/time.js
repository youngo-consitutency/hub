// Canonical time display + countdown — spec: docs/specs/youngo/02-design-system.md §3
// All params explicit so node --test can pin tz/now.

export function localTz() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function fmtDay(iso, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(tz ? { timeZone: tz } : {}),
  }).format(new Date(iso))
}

function hm(iso, tz) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  }).format(new Date(iso))
}

function zoneAbbr(iso, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    timeZone: tz,
    timeZoneName: 'short',
  }).formatToParts(new Date(iso))
  return parts.find((p) => p.type === 'timeZoneName')?.value || tz
}

// "Wed 15 Jul · 13:00 UTC · 16:00 EAT"; single time when viewer zone is UTC.
export function fmtDual(iso, tz = localTz()) {
  const day = fmtDay(iso, 'UTC')
  const utc = `${hm(iso, 'UTC')} UTC`
  const zone = zoneAbbr(iso, tz)
  if (zone === 'UTC' || zone === 'GMT') return `${day} · ${utc}`
  return `${day} · ${utc} · ${hm(iso, tz)} ${zone}`
}

export function fmtMoment(iso, tz = localTz()) {
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

export function fmtDateRange(startsOn, endsOn, datesTbc) {
  if (!startsOn) return 'Dates TBC'
  const fmt = (d) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(d + 'T00:00:00Z'))
  const year = startsOn.slice(0, 4)
  const range =
    endsOn && endsOn !== startsOn
      ? `${fmt(startsOn)}–${fmt(endsOn)}`
      : fmt(startsOn)
  return `${range} ${year}${datesTbc ? ' · TBC' : ''}`
}

// Thresholds per design system §6.3: >7d neutral, ≤7d warn, ≤48h danger.
export function countdown(iso, now = new Date()) {
  const ms = new Date(iso) - now
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

export function formatCountdownLabel(prefix, value) {
  if (!prefix) return value === 'closed' ? 'Closed' : value
  if (value !== 'closed') return `${prefix} ${value}`
  if (/closes in$/i.test(prefix)) return 'Closed'
  if (/close$/i.test(prefix)) return prefix.replace(/close$/i, 'closed')
  return `${prefix} closed`
}
