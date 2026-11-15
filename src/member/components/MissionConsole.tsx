interface MissionMetricProps {
  value?: AnyValue
  label?: string
  tone?: AnyValue
  href?: string
  icon?: import('react').ElementType
}

import type { AnyValue } from '../lib/types'
import { A } from './ui'
import { NumberTicker } from './fx/NumberTicker'

export function MissionMetric({ value, label, tone, href, icon: Icon }: MissionMetricProps) {
  // whole numbers count up like the landing page's figures; anything else (ratios, text) shows as given
  const count = /^\d+$/.test(String(value)) ? Number(value) : null
  const className = `mcMetric${tone ? ` mcMetric-${tone}` : ''}${href ? ' mcMetricLink' : ''}`
  const inner = (
    <>
      {Icon ? <Icon className="mcMetricIcon" size={16} strokeWidth={1.75} aria-hidden /> : null}
      <strong className="mono">{count === null ? value : <NumberTicker value={count} />}</strong>
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
