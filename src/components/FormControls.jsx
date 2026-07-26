import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function FieldError({ msg }) {
  if (!msg) return null
  return (
    <span className="fieldError" role="alert">
      {msg}
    </span>
  )
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH_FORMATTER = new Intl.DateTimeFormat('en', {
  month: 'long',
  year: 'numeric',
})
const DAY_FORMATTER = new Intl.DateTimeFormat('en', { dateStyle: 'long' })

function matchingOptions(options, query) {
  const normalized = query.trim().toLocaleLowerCase()
  return normalized
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(normalized),
      )
    : options
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(year, month, day) {
  return [
    String(year).padStart(4, '0'),
    String(month + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

function monthFor(value) {
  const date = parseDate(value) || new Date()
  return { year: date.getFullYear(), month: date.getMonth() }
}

function typedMonth(value) {
  const match = /^(\d{4})-(\d{1,2})/.exec(value || '')
  if (!match) return null
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return null
  return { year: Number(match[1]), month }
}

export function DatePicker({
  label,
  value,
  onChange,
  error,
  min,
  max,
  placeholder = 'YYYY-MM-DD',
}) {
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => monthFor(value))
  const { year, month } = visibleMonth
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayValue = dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const monthLabel = MONTH_FORMATTER.format(new Date(year, month, 1))

  const shiftMonth = (amount) => {
    const next = new Date(year, month + amount, 1)
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() })
  }

  return (
    <div
      className={`field${error ? ' hasError' : ''} datePicker`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <span>{label}</span>
      <input
        className="input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={10}
        aria-invalid={!!error}
        aria-expanded={open}
        onFocus={() => {
          setVisibleMonth(monthFor(value))
          setOpen(true)
        }}
        onChange={(event) => {
          const nextValue = event.target.value
          onChange(nextValue)
          const nextMonth = typedMonth(nextValue)
          if (nextMonth) setVisibleMonth(nextMonth)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            event.currentTarget.blur()
          }
        }}
      />
      {open && (
        <div className="datePickerMenu" role="dialog" aria-label={label}>
          <div className="datePickerHeader">
            <strong>{monthLabel}</strong>
            <div className="datePickerNav">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft size={18} strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>
          <div className="datePickerGrid" aria-hidden>
            {WEEKDAYS.map((weekday, index) => (
              <span
                key={`${weekday}-${index}`}
                data-weekend={index >= 5 || undefined}
              >
                {weekday}
              </span>
            ))}
          </div>
          <div className="datePickerGrid">
            {Array.from({ length: 42 }, (_, index) => {
              const day = index - firstWeekday + 1
              if (day < 1 || day > daysInMonth) {
                return <span key={index} className="datePickerBlank" />
              }
              const nextValue = dateKey(year, month, day)
              const disabled =
                (min && nextValue < min) || (max && nextValue > max)
              return (
                <button
                  key={nextValue}
                  type="button"
                  className="datePickerDay"
                  aria-label={DAY_FORMATTER.format(new Date(year, month, day))}
                  aria-pressed={nextValue === value}
                  data-today={nextValue === todayValue || undefined}
                  data-weekend={index % 7 >= 5 || undefined}
                  disabled={disabled}
                  onClick={() => {
                    onChange(nextValue)
                    setOpen(false)
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <FieldError msg={error} />
    </div>
  )
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  error,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  onOpen,
  className = '',
  hideLabel = false,
  disabled = false,
  children,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => option.value === value)
  const visibleOptions = matchingOptions(options, query)

  const selectOption = (nextValue) => {
    onChange(nextValue)
    setQuery('')
    setOpen(false)
  }

  return (
    <div
      className={`field${error ? ' hasError' : ''} comboField ${className}`.trim()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          setQuery('')
        }
      }}
    >
      <span className={hideLabel ? 'srOnly' : undefined}>{label}</span>
      <input
        className="input"
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={!!error}
        disabled={disabled}
        value={open ? query : selected?.label || ''}
        placeholder={open ? searchPlaceholder : placeholder}
        onFocus={() => {
          setQuery('')
          setOpen(true)
          onOpen?.()
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
            event.currentTarget.blur()
          } else if (event.key === 'Enter' && open && visibleOptions.length) {
            event.preventDefault()
            selectOption(visibleOptions[0].value)
          }
        }}
      />
      {open && (
        <div className="comboMenu" role="listbox" aria-label={label}>
          {visibleOptions.length ? (
            visibleOptions.map((option) => (
              <button
                key={option.value}
                className="comboOption"
                type="button"
                role="option"
                aria-selected={option.value === value}
                title={option.label}
                onClick={() => selectOption(option.value)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <span className="metaMuted comboEmpty">
              {options.length ? 'No matches' : 'Loading…'}
            </span>
          )}
        </div>
      )}
      <FieldError msg={error} />
      {children}
    </div>
  )
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onToggle,
  error,
  hideLabel = false,
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label)
  const visibleOptions = matchingOptions(options, query)

  return (
    <div
      className={`field${error ? ' hasError' : ''} comboField`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
          setQuery('')
        }
      }}
    >
      <span className={hideLabel ? 'srOnly' : undefined}>{label}</span>
      <input
        className="input"
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-invalid={!!error}
        value={query}
        placeholder={
          selectedLabels.length
            ? `${selectedLabels.length} selected: ${selectedLabels.join(', ')}`
            : 'Type to search…'
        }
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
            event.currentTarget.blur()
          } else if (event.key === 'Enter' && open && visibleOptions.length) {
            event.preventDefault()
            onToggle(visibleOptions[0].value)
            setQuery('')
          }
        }}
      />
      {open && (
        <div className="comboMenu" role="group" aria-label={label}>
          {visibleOptions.length ? (
            visibleOptions.map((option) => (
              <label
                key={option.value}
                className="comboOption comboOptionMulti"
                tabIndex={-1}
                onPointerDown={(event) => {
                  event.currentTarget.focus({ preventScroll: true })
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))
          ) : (
            <span className="metaMuted comboEmpty">No matches</span>
          )}
        </div>
      )}
      <FieldError msg={error} />
    </div>
  )
}
