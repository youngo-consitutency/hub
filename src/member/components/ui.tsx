interface AProps {
  href?: string
  className?: string
  children?: import('react').ReactNode
  onClick?: AnyValue
  target?: AnyValue
  [key: string]: AnyValue
}

interface ButtonProps {
  variant?: AnyValue
  sm?: boolean
  glow?: boolean
  className?: string
  [key: string]: AnyValue
}

interface FilterPillProps {
  active?: boolean
  state?: AnyValue
  icon?: import('react').ElementType
  prefix?: AnyValue
  children?: import('react').ReactNode
  className?: string
  [key: string]: AnyValue
}

interface FilterChipProps {
  children?: import('react').ReactNode
  state?: AnyValue
  tone?: AnyValue
  onClick?: AnyValue
  icon?: import('react').ElementType
  prefix?: AnyValue
  className?: string
}

interface SortButtonProps {
  active?: boolean
  icon?: import('react').ElementType
  children?: import('react').ReactNode
  [key: string]: AnyValue
}

interface FilterMenuProps {
  children?: import('react').ReactNode
  activeCount?: AnyValue
  label?: string
  onClear?: AnyValue
}

interface PageHeaderProps {
  title?: string
  description?: string
  action?: AnyValue
  children?: import('react').ReactNode
  icon?: import('react').ElementType
}

interface StatusChipProps {
  status?: AnyValue
  filterState?: AnyValue
  onClick?: AnyValue
}

interface LifecycleTimingProps {
  status?: AnyValue
  iso?: string
  label?: string
  showCountdown?: boolean
  statusFilterState?: AnyValue
  onStatusFilter?: AnyValue
  className?: string
}

interface SectionProps {
  label?: string
  meta?: string | null
  action?: AnyValue
  children?: import('react').ReactNode
}

interface SkeletonsProps {
  n?: AnyValue
  /** card-shaped placeholders in the real card grid, so the page does not jump when data lands */
  grid?: boolean
}

interface EmptyProps {
  icon?: import('react').ElementType
  title?: string
  body?: AnyValue
  cta?: AnyValue
}

interface ErrorCardProps {
  message?: AnyValue
  onRetry?: AnyValue
}

interface BackLinkProps {
  href?: string
  children?: import('react').ReactNode
}

interface TimelineProps {
  steps?: AnyValue
  currentIndex?: AnyValue
}

interface AsyncProps {
  query?: AnyValue
  skeletons?: AnyValue
  grid?: boolean
  children: (data: Doc) => import('react').ReactNode
  empty?: AnyValue
}

import type { AnyValue, Doc } from '../lib/types'
import { Fragment } from 'react'
import { Button as RacButton, Input, SearchField } from 'react-aria-components'
import Link from 'next/link'
import { hrefFor, isPanelPath, navigate } from '../lib/router'
import { countdown, fmtMoment } from '../lib/time'
import {
  TbAlarm as AlarmClock,
  TbCalendarTime as CalendarTime,
  TbRefresh as RefreshCw,
  TbArrowLeft as ArrowLeft,
  TbCheck as Check,
  TbMinus as Minus,
  TbX,
  TbAdjustmentsHorizontal,
  TbChevronDown,
  TbSearch,
} from 'react-icons/tb'

export function A({ href, className, children, onClick, target, ...rest }: AProps) {
  // next/link prefetches the route chunk on viewport/hover, so soft
  // navigations land without waiting on a fresh download. The click handler
  // still owns the actual navigation (scroll handling, hash routing).
  return (
    <Link
      href={hrefFor(href as string)}
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
        // opening a side panel keeps the list where it was
        navigate(href as string, { scroll: !isPanelPath(href) })
      }}
      {...rest}
    >
      {children}
    </Link>
  )
}

export function Button({ variant = 'secondary', sm, glow, className = '', ...rest }: ButtonProps) {
  const cls = ['btn', `btn-${variant}`, sm && 'btn-sm', glow && 'btn-glow', className]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={cls} {...rest} />
}

interface SearchBoxProps {
  /** names the field for screen readers */
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
}

/** The search field every catalogue and list page uses (react-aria: clear button, Escape, labelling). */
export function SearchBox({ label, placeholder = label, value, onChange }: SearchBoxProps) {
  return (
    <SearchField className="searchInputWrap" aria-label={label} value={value} onChange={onChange}>
      <TbSearch size={18} strokeWidth={1.75} aria-hidden />
      <Input className="input" placeholder={placeholder} />
      <RacButton className="searchClear" aria-label="Clear search">
        <TbX size={15} strokeWidth={1.75} aria-hidden />
      </RacButton>
    </SearchField>
  )
}

interface CatalogToolbarProps {
  /** omit for toolbars that only filter, like the calendar's */
  search?: SearchBoxProps
  sortLabel?: string
  sort?: import('react').ReactNode
  /** extra rows between search and the filter menu, e.g. category pills */
  children?: import('react').ReactNode
  filters?: import('react').ReactNode
}

/** Search, sort and filter row shared by every browse page, so they all behave and wrap alike. */
export function CatalogToolbar({
  search,
  sortLabel,
  sort,
  children,
  filters,
}: CatalogToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-card border border-line bg-raised p-3 [&_.searchInputWrap]:w-full max-[620px]:[&>.pillRow]:flex-nowrap max-[620px]:[&>.pillRow]:overflow-x-auto max-[620px]:[&_fieldset_.pillRow]:flex-nowrap max-[620px]:[&_fieldset_.pillRow]:overflow-x-auto">
      {(search || sort) && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-[620px]:grid-cols-1 max-[620px]:gap-2">
          {search && <SearchBox {...search} />}
          {sort && (
            <div
              role="group"
              aria-label={sortLabel}
              className="inline-flex items-center gap-1 rounded-control bg-raised p-1 max-[620px]:w-max max-[620px]:max-w-full max-[620px]:self-start max-[620px]:overflow-x-auto"
            >
              {sort}
            </div>
          )}
        </div>
      )}
      {children}
      {filters && (
        <div className="flex items-center justify-between gap-3 max-[620px]:flex-col max-[620px]:items-stretch [&_.filterMenu]:w-full [&_.filterMenuPanel]:w-full [&_.filterMenuPanel]:max-w-full">
          {filters}
        </div>
      )}
    </div>
  )
}

export function FilterPill({
  active,
  state,
  icon: Icon,
  prefix,
  children,
  className = '',
  ...rest
}: FilterPillProps) {
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

function filterStateLabel(filterState: AnyValue) {
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
}: FilterChipProps) {
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

export function SortButton({ active, icon: Icon, children, ...rest }: SortButtonProps) {
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

/** Render collapsible filters with an active count and an optional clear action that restores focus. */
export function FilterMenu({
  children,
  activeCount = 0,
  label = 'Filters',
  onClear,
}: FilterMenuProps) {
  return (
    <details className="filterMenu">
      <summary className="filterToggle">
        <TbAdjustmentsHorizontal size={17} aria-hidden />
        <span>{label}</span>
        {activeCount > 0 && <span className="filterActiveCount">{activeCount} active</span>}
        <TbChevronDown className="filterChevron" size={17} aria-hidden />
      </summary>
      <div className="filterMenuContent">
        <div className="filterSummary">
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
                ;(firstFilter as HTMLElement | undefined)?.focus({ preventScroll: true })
              }}
            >
              <TbX size={15} strokeWidth={1.75} aria-hidden />
              Clear filters
            </button>
          )}
        </div>
        <div className="filterMenuPanel">{children}</div>
      </div>
    </details>
  )
}

export function PageHeader({ title, description, action, children, icon: Icon }: PageHeaderProps) {
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
  announced: ['chip-neutral', 'Announced'],
  endorsed: ['chip-neutral', 'Endorsed'],
  underway: ['chip-accent', 'Under way'],
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

export function StatusChip({ status, filterState = 'neutral', onClick }: StatusChipProps) {
  const [cls, label, pulse] = (CHIP as AnyValue)[status] || [
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

export function LifecycleTiming({
  status,
  iso,
  label = 'Deadline',
  showCountdown = false,
  statusFilterState = 'neutral',
  onStatusFilter,
  className = '',
}: LifecycleTimingProps) {
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

export function Section({ label, meta, action, children }: SectionProps) {
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

export function Skeletons({ n = 3, grid }: SkeletonsProps) {
  return (
    <div className={grid ? 'cardGrid' : 'stack'} role="status" aria-label="Loading content">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={grid ? 'skeleton skeletonCard' : 'skeleton'} />
      ))}
    </div>
  )
}

export function Empty({ icon: Icon, title, body, cta }: EmptyProps) {
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

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
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

export function BackLink({ href, children }: BackLinkProps) {
  return (
    <A href={href} className="backLink">
      <ArrowLeft size={18} strokeWidth={2} aria-hidden />
      <span>Back to {children}</span>
    </A>
  )
}

// Process timeline strip (submissions, decisions). Steps before currentIndex are
// "done", the current step is highlighted, later steps are muted future states.
export function Timeline({ steps, currentIndex }: TimelineProps) {
  return (
    <div className="timelineStrip" aria-label="Process timeline">
      {steps.map((label: AnyValue, i: number) => (
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
export function Async({ query, skeletons = 3, grid, children, empty }: AsyncProps) {
  if (query.loading) return <Skeletons n={skeletons} grid={grid} />
  if (query.error) return <ErrorCard message={query.error} onRetry={query.retry} />
  if (empty && empty(query.data)) return empty(query.data)
  return children(query.data)
}
