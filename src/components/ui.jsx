import { Fragment } from 'react'
import { navigate } from '../lib/router.js'
import { countdown } from '../lib/time.js'
import { AlarmClock, RefreshCw, ArrowLeft } from 'lucide-react'

export function A({ href, className, children, onClick, target, ...rest }) {
  return (
    <a
      href={href}
      className={className}
      target={target}
      onClick={(e) => {
        onClick?.(e)
        if (
          e.defaultPrevented ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.button !== 0 ||
          target
        )
          return
        e.preventDefault()
        navigate(href)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

export function Button({
  variant = 'secondary',
  sm,
  glow,
  className = '',
  ...rest
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    sm && 'btn-sm',
    glow && 'btn-glow',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={cls} {...rest} />
}

export function FilterPill({
  active,
  icon: Icon,
  children,
  className = '',
  ...rest
}) {
  return (
    <button
      type="button"
      className={`pill ${active ? 'active' : ''} ${className}`.trim()}
      aria-pressed={active}
      {...rest}
    >
      {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  )
}

export function PageHeader({ eyebrow, title, description, action, children }) {
  return (
    <header className="pageHeader">
      {eyebrow && <p className="pageEyebrow">{eyebrow}</p>}
      <div className="pageHeaderRow">
        <div className="pageHeaderCopy">
          <h1 className="pageTitle">{title}</h1>
          {description && <p className="pageLead">{description}</p>}
        </div>
        {action && <div className="pageHeaderAction">{action}</div>}
      </div>
      {children && <div className="pageHeaderControls">{children}</div>}
    </header>
  )
}

// Status → chip class + label, per design system §6.2.
const CHIP = {
  live_now: ['chip-live', 'Live now', true],
  open: ['chip-accent', 'Open'],
  drafting: ['chip-info', 'Drafting'],
  internal_review: ['chip-warn', 'Internal review'],
  submitted: ['chip-neutral', 'Submitted'],
  archived: ['chip-neutral', 'Archived'],
  registration_open: ['chip-accent', 'Registration open'],
  applications_open: ['chip-warn', 'Applications open'],
  announced: ['chip-neutral', 'Announced soon'],
  concluded: ['chip-neutral', 'Concluded'],
  cancelled: ['chip-neutral', 'Cancelled'],
  proposed: ['chip-info', 'Proposed'],
  open_for_input: ['chip-accent', 'Open for input'],
  objection_window: ['chip-warn', 'Objection window'],
  adopted: ['chip-accent', 'Adopted'],
  not_adopted: ['chip-danger', 'Not adopted'],
  withdrawn: ['chip-neutral', 'Withdrawn'],
}

export function StatusChip({ status }) {
  const [cls, label, pulse] = CHIP[status] || [
    'chip-neutral',
    String(status || '').replaceAll('_', ' '),
  ]
  return (
    <span className={`chip ${cls}`}>
      <span className={`cdot ${pulse ? 'pulse' : ''}`} />
      {label}
    </span>
  )
}

export function CountdownChip({ iso, label }) {
  if (!iso) return null
  const { label: countdownLabel, tone } = countdown(iso)
  return (
    <span className={`chip chip-${tone} chipMono`}>
      <AlarmClock size={12} strokeWidth={1.75} aria-hidden />
      {label && <span className="chipPrefix">{label}</span>}
      {countdownLabel}
    </span>
  )
}

export function Section({ label, action, children }) {
  return (
    <section className="section">
      {label && (
        <div className="sectionLabel">
          <h2 className="sectionHeading">{label}</h2>
          {action && <div className="sectionAction">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Skeletons({ n = 3 }) {
  return (
    <div className="stack" role="status" aria-label="Loading content">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  )
}

export function Empty({ icon: Icon, title, body, cta }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="iconTile">
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <h3>{title}</h3>
      {body && <p className="meta emptyBody">{body}</p>}
      {cta && <div className="emptyCta">{cta}</div>}
    </div>
  )
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div className="card rowBetween" role="alert">
      <span className="meta">
        {message || 'Couldn’t load this — try again.'}
      </span>
      <Button sm variant="ghost" onClick={onRetry}>
        <RefreshCw size={16} strokeWidth={1.75} aria-hidden /> Retry
      </Button>
    </div>
  )
}

export function BackLink({ href, children }) {
  return (
    <A href={href} className="backLink">
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
      {children}
    </A>
  )
}

// Process timeline strip (submissions, decisions). Steps before currentIndex are
// "done", the current step is highlighted, later steps are muted future states.
export function Timeline({ steps, currentIndex }) {
  return (
    <div className="timelineStrip" aria-label="Process timeline">
      {steps.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <span className="timelineLine" />}
          <span
            className={`timelineStep ${i < currentIndex ? 'done' : i === currentIndex ? 'current' : ''}`}
          >
            <span className="tdot" />
            {label}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

// Wrap an async section: shows skeletons, error-retry, or children(data).
export function Async({ query, skeletons = 3, children, empty }) {
  if (query.loading) return <Skeletons n={skeletons} />
  if (query.error)
    return <ErrorCard message={query.error} onRetry={query.retry} />
  if (empty && empty(query.data)) return empty(query.data)
  return children(query.data)
}
