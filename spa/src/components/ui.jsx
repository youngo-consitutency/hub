import { Fragment } from 'react'
import { navigate, replace } from '../lib/router.js'
import { countdown, fmtMoment, formatCountdownLabel } from '../lib/time.js'
import {
  TbAlarm as AlarmClock,
  TbCalendarTime as CalendarTime,
  TbRefresh as RefreshCw,
  TbArrowLeft as ArrowLeft,
  TbCheck as Check,
  TbMinus as Minus,
  TbX,
} from 'react-icons/tb'

/** @param {import("react").AnchorHTMLAttributes<HTMLAnchorElement> & { peek?: boolean }} props */
export function A({
  href,
  className,
  children,
  onClick,
  target,
  peek = /^\/(calendar|groups|coys|submissions|council)\/[^/]+$/.test(href || ''),
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
        const background = window.history.state?.peekBackground
        const go = peek && background ? replace : navigate
        go(
          href,
          peek
            ? {
                state: {
                  peekBackground: background || window.location.pathname + window.location.search,
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

export function Button({ variant = 'secondary', sm, glow, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, sm && 'btn-sm', glow && 'btn-glow', className]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={cls} {...rest} />
}

/** @param {import("react").ButtonHTMLAttributes<HTMLButtonElement> & {active?: boolean, state?: string, icon?: import("react").ElementType, prefix?: string}} props */
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
      {state !== undefined && (
        <span className="pillStateIcon" aria-hidden>
          {state === 'exclude' ? (
            <Minus size={13} strokeWidth={2} />
          ) : (
            <Check size={13} strokeWidth={2} />
          )}
        </span>
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

/**
 * Compact card metadata that controls the matching catalogue filter.
 * @param {{children?: import("react").ReactNode, state?: string, tone?: string, onClick?: import("react").MouseEventHandler<HTMLButtonElement>, icon?: import("react").ElementType, prefix?: string, className?: string}} props
 */
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

export function FilterMenu({ children, activeCount = 0, label = 'Filters', onClear }) {
  return (
    <section className="filterMenu" aria-label={label}>
      <div className="filterSummary">
        <span role="status">
          {activeCount > 0
            ? `${activeCount} active ${activeCount === 1 ? 'filter' : 'filters'}`
            : ''}
        </span>
        {onClear && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={activeCount === 0}
            onClick={(event) => {
              const firstFilter = event.currentTarget
                .closest('.filterMenu')
                ?.querySelector('.filterMenuPanel button')
              onClear()
              firstFilter?.focus({ preventScroll: true })
            }}
          >
            <TbX size={15} strokeWidth={1.75} aria-hidden />
            Clear filters
          </button>
        )}
      </div>
      <div className="filterMenuPanel">{children}</div>
    </section>
  )
}

/** @param {{ title: import("react").ReactNode, description?: import("react").ReactNode, action?: import("react").ReactNode, icon?: import("react").ElementType, children?: import("react").ReactNode }} props */
export function PageHeader({ title, description, action, children, icon: Icon }) {
  return (
    <header className="pageHeader">
      <div className="pageHeaderRow">
        <div className="pageHeaderCopy">
          <h1 className="pageTitle">
            {Icon && (
              <span className="pageTitleIcon" aria-hidden="true">
                <Icon size={26} strokeWidth={1.75} focusable="false" />
              </span>
            )}
            <span>{title}</span>
          </h1>
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
  applications_closed: ['chip-neutral', 'Applications closed'],
  registration_closed: ['chip-neutral', 'Registration closed'],
  announced: ['chip-neutral', 'Announced soon'],
  concluded: ['chip-neutral', 'Concluded'],
  cancelled: ['chip-neutral', 'Cancelled'],
  consultation: ['chip-accent', 'Consultation'],
  revision: ['chip-accent', 'Revision'],
  decision: ['chip-warn', 'Decision'],
  voting: ['chip-warn', 'Voting'],
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
  showCountdown = false,
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
        <StatusChip status={status} filterState={statusFilterState} onClick={onStatusFilter} />
      )}
      {moment && (
        <div className="lifecycleTimingDate">
          <CalendarTime size={15} strokeWidth={1.75} aria-hidden />
          <time dateTime={iso}>
            {!status && label !== 'Deadline' && (
              <span className="lifecycleTimingRelation">{label}</span>
            )}
            {moment.day} · {moment.localTime} {moment.localZone}
          </time>
        </div>
      )}
      {remaining && (
        <span className={`lifecycleTimingRemaining lifecycleTimingRemaining-${remaining.tone}`}>
          <AlarmClock size={13} strokeWidth={1.75} aria-hidden />
          {remaining.label === 'closed' ? 'Closed' : `${remaining.label} remaining`}
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

/**
 * @param {{
 *   icon?: import('react-icons').IconType,
 *   title?: import('react').ReactNode,
 *   body?: import('react').ReactNode,
 *   cta?: import('react').ReactNode,
 * }} props
 */
export function Empty({ icon: Icon, title, body, cta }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="iconTile">
          <Icon size={22} strokeWidth={1.75} aria-hidden />
        </div>
      )}
      {title && <h3>{title}</h3>}
      {body && <p className="meta emptyBody">{body}</p>}
      {cta && <div className="emptyCta">{cta}</div>}
    </div>
  )
}

export function ErrorCard({ message, onRetry }) {
  return (
    <div className="card rowBetween errorCard" role="alert">
      <span className="meta">{message || 'Couldn’t load this — try again.'}</span>
      {onRetry && (
        <Button sm variant="ghost" onClick={onRetry}>
          <RefreshCw size={16} strokeWidth={1.75} aria-hidden /> Retry
        </Button>
      )}
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
  if (query.error) return <ErrorCard message={query.error} onRetry={query.retry} />
  if (empty && empty(query.data)) return empty(query.data)
  return children(query.data)
}
