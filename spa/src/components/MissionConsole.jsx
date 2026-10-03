import { A } from './ui.jsx'

export function MissionMetric({ value, label, tone, href, icon: Icon }) {
  const className = `mcMetric${tone ? ` mcMetric-${tone}` : ''}${href ? ' mcMetricLink' : ''}`
  const inner = (
    <>
      {Icon ? <Icon className="mcMetricIcon" size={16} strokeWidth={1.75} aria-hidden /> : null}
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
