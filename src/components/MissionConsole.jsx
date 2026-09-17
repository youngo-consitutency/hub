import { useEffect, useState } from 'react'
import { countdown } from '../lib/time.js'
import { A } from './ui.jsx'

/** Provisional COP31 Antalya opening — placeholder for the mission-control prototype. */
export const COP31_OPENS_AT = '2026-11-09T09:00:00Z'

function pad(n) {
  return String(n).padStart(2, '0')
}

export function useUtcClock(tickMs = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), tickMs)
    return () => window.clearInterval(id)
  }, [tickMs])
  return now
}

export function formatUtcClock(date) {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

export function MissionStatusBar({ station, liveLabel, right }) {
  const now = useUtcClock()
  return (
    <div className="mcStatusBar" role="status">
      <div className="mcStatusLeft">
        <span className="mcStatusTag">COP31 · ANTALYA</span>
        {station && <span className="mcStatusStation">{station}</span>}
        {/* The pulsing pill means something is genuinely live — never a page name. */}
        {liveLabel && (
          <span className="mcLivePill">
            <span className="mcLiveDot" aria-hidden />
            {liveLabel}
          </span>
        )}
      </div>
      <div className="mcStatusRight">
        {right}
        <span className="mcClock mono">{formatUtcClock(now)}</span>
      </div>
    </div>
  )
}

export function MissionCountdown({
  iso = COP31_OPENS_AT,
  label = 'Days to COP31',
}) {
  const now = useUtcClock(1000)
  const target = new Date(iso)
  const ms = Math.max(0, target - now)
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const compact = countdown(iso, now)

  return (
    <div className="mcCountdown" aria-live="polite">
      <p className="mcEyebrow">{label}</p>
      <div className="mcCountdownRow">
        <span className="mcCountdownDays mono">{days}</span>
        <span className="mcCountdownUnit">days</span>
        <span className="mcCountdownHms mono">
          {pad(hours)}:{pad(mins)}:{pad(secs)}
        </span>
      </div>
      <p className="mcCountdownMeta mono">{compact.label} remaining</p>
    </div>
  )
}

export function MissionMetric({ value, label, tone, href }) {
  const className = `mcMetric${tone ? ` mcMetric-${tone}` : ''}${
    href ? ' mcMetricLink' : ''
  }`
  const inner = (
    <>
      <strong className="mono">{value}</strong>
      <span>{label}</span>
    </>
  )
  if (href) {
    return (
      <A href={href} className={className}>
        {inner}
      </A>
    )
  }
  return <div className={className}>{inner}</div>
}

export function MissionMonogram({ children }) {
  return <span className="mcMonogram">{children}</span>
}
