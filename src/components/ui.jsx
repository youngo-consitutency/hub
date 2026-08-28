import { Fragment } from 'react'
import { navigate } from '../lib/router.js'
import { countdown, fmtMoment, formatCountdownLabel } from '../lib/time.js'
import {
  TbAlarm as AlarmClock,
  TbCalendarTime as CalendarTime,
  TbRefresh as RefreshCw,
  TbArrowLeft as ArrowLeft,
  TbCheck as Check,
  TbMinus as Minus,
} from 'react-icons/tb'

export function A({
  href,
  className,
  children,
  onClick,
  target,
  peek = false,
  ...rest
}) {
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
        navigate(
          href,
          peek
            ? {
                state: {
                  peekBackground:
                    window.location.pathname + window.location.search,
                },
                scroll: false,
              }
            : undefined,
        )
      }}
      aria-haspopup={peek ? 'dialog' : undefined}
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
  state,
  icon: Icon,
  prefix,
  children,
  className = '',
  ...rest
}) {
  const filterState = state || (active ? 'include' : 'neutral')
  const stateLabel =
    filterState === 'include'
      ? 'included; activate to exclude'
      : filterState === 'exclude'
        ? 'excluded; activate to clear'
        : 'not selected; activate to include'
  return (
    <button
      type="button"
      className={`pill ${filterState === 'include' ? 'active' : ''} ${className}`.trim()}
      data-filter-state={filterState}
      aria-label={state ? `${children}: ${stateLabel}` : undefined}
      aria-pressed={state ? filterState !== 'neutral' : active}
      {...rest}
    >
      {Icon && <Icon size={14} strokeWidth={1.75} aria-hidden />}
      {prefix && (
        <span className="pillPrefix" aria-hidden>
          {prefix}
        </span>
      )}
      {children}
      {state === 'include' && (
        <Check
          className="pillStateIcon"
          size={13}
          strokeWidth={2}
          aria-hidden
        />
      )}
      {state === 'exclude' && (
        <Minus
          className="pillStateIcon"
          size={13}
          strokeWidth={2}
          aria-hidden
        />
      )}
    </button>
  )
}

function filterStateLabel(filterState) {
  return filterState === 'include'
    ? 'included; activate to exclude'
    : filterState === 'exclude'
      ? 'excluded; activate to clear'
      : 'not selected; activate to include'
}

/** Compact card metadata that controls the matching catalogue filter. */
export function FilterChip({
  children,
  state = 'neutral',
  tone = 'neutral',
  onClick,
  icon: Icon,
  prefix,
  className = '',
}) {
  const content = (
    <>
      {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden />}
      {prefix && (
        <span className="chipPrefix" aria-hidden>
          {prefix}
        </span>
      )}
      {children}
    </>
  )

  if (!onClick) {
    return <span className={`chip chip-${tone} ${className}`}>{content}</span>
  }

  return (
    <button
      type="button"
      className={`chip chip-${tone} cardFilterChip ${className}`.trim()}
      data-filter-state={state}
      aria-label={`${children}: ${filterStateLabel(state)}`}
      aria-pressed={state !== 'neutral'}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

export function SortButton({ active, icon: Icon, children, ...rest }) {
  return (
    <button
      type="button"
      className={`sortOption ${active ? 'active' : ''}`}
      aria-pressed={active}
      {...rest}
    >
      {Icon && <Icon size={15} strokeWidth={1.75} aria-hidden />}
      {children}
    </button>
  )
}

export function FilterMenu({ children, activeCount = 0, label = 'Filters' }) {
  return (
    <section className="filterMenu" aria-label={label}>
      <span className="srOnly" role="status">
        {activeCount} active filters
      </span>
      <div className="filterMenuPanel">{children}</div>
    </section>
  )
}

export function PageHeader({ title, description, action, children }) {
  return (
    <header className="pageHeader">
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

export function StatusChip({ status, filterState = 'neutral', onClick }) {
  const [cls, label, pulse] = CHIP[status] || [
    'chip-neutral',
    String(status || '').replaceAll('_', ' '),
  ]
  const content = (
    <>
      <span className={`cdot ${pulse ? 'pulse' : ''}`} />
      {label}
    </>
  )

  if (!onClick) return <span className={`chip ${cls}`}>{content}</span>

  return (
    <button
      type="button"
      className={`chip ${cls} cardFilterChip`}
      data-filter-state={filterState}
      aria-label={`${label}: ${filterStateLabel(filterState)}`}
      aria-pressed={filterState !== 'neutral'}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

export function CountdownChip({ iso, label }) {
  if (!iso) return null
  const { label: countdownLabel, tone } = countdown(iso)
  return (
    <span className={`chip chip-${tone} chipMono`}>
      <AlarmClock size={12} strokeWidth={1.75} aria-hidden />
      {formatCountdownLabel(label, countdownLabel)}
    </span>
  )
}

export function LifecycleTiming({
  status,
  iso,
  label = 'Deadline',
  relation = 'until',
  showCountdown = true,
  statusFilterState = 'neutral',
  onStatusFilter,
  className = '',
}) {
  if (!status && !iso) return null

  const moment = iso ? fmtMoment(iso) : null
  const remaining = iso && showCountdown ? countdown(iso) : null

  return (
    <div className={`lifecycleTiming ${className}`.trim()} aria-label={label}>
      {status && (
        <StatusChip
          status={status}
          filterState={statusFilterState}
          onClick={onStatusFilter}
        />
      )}
      {moment && (
        <div className="lifecycleTimingDate">
          <CalendarTime size={15} strokeWidth={1.75} aria-hidden />
          <time dateTime={iso}>
            <span className="lifecycleTimingRelation">
              {status ? relation : label}
            </span>{' '}
            {moment.day} · {moment.localTime} {moment.localZone}
          </time>
        </div>
      )}
      {moment && !moment.isUtc && (
        <span className="lifecycleTimingSecondary">UTC {moment.utcTime}</span>
      )}
      {remaining && (
        <span
          className={`lifecycleTimingRemaining lifecycleTimingRemaining-${remaining.tone}`}
        >
          <AlarmClock size={13} strokeWidth={1.75} aria-hidden />
          {remaining.label === 'closed'
            ? 'Closed'
            : `${remaining.label} remaining`}
        </span>
      )}
    </div>
  )
}

export function Section({ label, meta, action, children }) {
  return (
    <section className="section">
      {label && (
        <div className="sectionLabel">
          <h2 className="sectionHeading">
            {label}
            {meta && <span className="sectionHeadingMeta">{meta}</span>}
          </h2>
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
    <div className="card rowBetween errorCard" role="alert">
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
      <ArrowLeft size={18} strokeWidth={2} aria-hidden />
      <span>Back to {children}</span>
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
