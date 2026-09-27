import { useId, useState } from 'react'

export function FieldError({ msg }) {
  if (!msg) return null
  return (
    <span className="fieldError" role="alert">
      {msg}
    </span>
  )
}

function matchingOptions(options, query) {
  const normalized = query.trim().toLocaleLowerCase()
  return normalized
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(normalized),
      )
    : options
}

/** Native date field with the same field chrome as other form controls. */
export function DatePicker({ label, value, onChange, error, min, max }) {
  return (
    <label className={`field${error ? ' hasError' : ''}`}>
      <span>{label}</span>
      <input
        className="input"
        type="date"
        value={value || ''}
        min={min || undefined}
        max={max || undefined}
        aria-invalid={!!error}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError msg={error} />
    </label>
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
  const listboxId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((option) => option.value === value)
  const visibleOptions = matchingOptions(options, query)

  const selectOption = (nextValue) => {
    onChange(nextValue)
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
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
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && visibleOptions.length
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        aria-autocomplete="list"
        aria-invalid={!!error}
        disabled={disabled}
        value={open ? query : selected?.label || ''}
        placeholder={open ? searchPlaceholder : placeholder}
        onFocus={() => {
          setQuery('')
          setOpen(true)
          setActiveIndex(0)
          onOpen?.()
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
            event.currentTarget.blur()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) =>
              Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)),
            )
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && open && visibleOptions.length) {
            event.preventDefault()
            selectOption(visibleOptions[activeIndex].value)
          }
        }}
      />
      {open && (
        <div
          className="comboMenu"
          id={listboxId}
          role="listbox"
          aria-label={label}
        >
          {visibleOptions.length ? (
            visibleOptions.map((option, index) => (
              <button
                key={option.value}
                id={`${listboxId}-option-${index}`}
                className="comboOption"
                type="button"
                role="option"
                aria-selected={option.value === value}
                title={option.label}
                onMouseEnter={() => setActiveIndex(index)}
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
  const listboxId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
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
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && visibleOptions.length
            ? `${listboxId}-option-${activeIndex}`
            : undefined
        }
        aria-autocomplete="list"
        aria-invalid={!!error}
        value={query}
        placeholder={
          selectedLabels.length
            ? `${selectedLabels.length} selected: ${selectedLabels.join(', ')}`
            : 'Type to search…'
        }
        onFocus={() => {
          setOpen(true)
          setActiveIndex(0)
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          setActiveIndex(0)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false)
            setQuery('')
            event.currentTarget.blur()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) =>
              Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)),
            )
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && open && visibleOptions.length) {
            event.preventDefault()
            onToggle(visibleOptions[activeIndex].value)
            setQuery('')
            setActiveIndex(0)
          }
        }}
      />
      {open && (
        <div
          className="comboMenu"
          id={listboxId}
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
        >
          {visibleOptions.length ? (
            visibleOptions.map((option, index) => (
              <label
                key={option.value}
                id={`${listboxId}-option-${index}`}
                className="comboOption comboOptionMulti"
                role="option"
                aria-selected={selected.includes(option.value)}
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
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
