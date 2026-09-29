import { useState } from 'react'
import { useCombobox } from 'downshift'

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
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalized))
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
  const [query, setQuery] = useState('')
  const selected = options.find((option) => option.value === value) || null
  const visibleOptions = matchingOptions(options, query)

  const { isOpen, getLabelProps, getMenuProps, getInputProps, getItemProps } = useCombobox({
    items: visibleOptions,
    itemToString: (item) => item?.label || '',
    selectedItem: selected,
    onSelectedItemChange: ({ selectedItem }) => {
      setQuery('')
      if (selectedItem) onChange(selectedItem.value)
    },
    onInputValueChange: ({ inputValue }) => setQuery(inputValue || ''),
    onIsOpenChange: ({ isOpen }) => {
      if (isOpen) onOpen?.()
    },
  })

  return (
    <div className={`field${error ? ' hasError' : ''} comboField ${className}`.trim()}>
      <span {...getLabelProps()} className={hideLabel ? 'srOnly' : undefined}>
        {label}
      </span>
      <input
        {...getInputProps({
          className: 'input',
          type: 'search',
          'aria-invalid': !!error,
          disabled,
          placeholder: isOpen ? searchPlaceholder : placeholder,
        })}
      />
      <div {...getMenuProps()} className="comboMenu" role="listbox" hidden={!isOpen}>
        {visibleOptions.length ? (
          visibleOptions.map((option, index) => (
            <button
              {...getItemProps({ item: option, index })}
              key={option.value}
              className="comboOption"
              type="button"
              role="option"
              aria-selected={option.value === value}
              title={option.label}
            >
              {option.label}
            </button>
          ))
        ) : (
          <span className="metaMuted comboEmpty">{options.length ? 'No matches' : 'Loading…'}</span>
        )}
      </div>
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
  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label)
  const visibleOptions = matchingOptions(options, query)

  const { isOpen, getLabelProps, getMenuProps, getInputProps, getItemProps } = useCombobox({
    items: visibleOptions,
    itemToString: () => '',
    selectedItem: null,
    inputValue: query,
    stateReducer: (state, { type, changes }) =>
      type === useCombobox.stateChangeTypes.ItemClick
        ? { ...changes, isOpen: true, inputValue: '' }
        : changes,
    onSelectedItemChange: ({ selectedItem }) => {
      setQuery('')
      if (selectedItem) onToggle(selectedItem.value)
    },
    onInputValueChange: ({ inputValue }) => setQuery(inputValue || ''),
  })

  return (
    <div className={`field${error ? ' hasError' : ''} comboField`}>
      <span {...getLabelProps()} className={hideLabel ? 'srOnly' : undefined}>
        {label}
      </span>
      <input
        {...getInputProps({
          className: 'input',
          type: 'search',
          'aria-invalid': !!error,
          placeholder: selectedLabels.length
            ? `${selectedLabels.length} selected: ${selectedLabels.join(', ')}`
            : 'Type to search…',
        })}
      />
      <div {...getMenuProps()} className="comboMenu" aria-multiselectable="true" hidden={!isOpen}>
        {visibleOptions.length ? (
          visibleOptions.map((option, index) => (
            <div
              key={option.value}
              {...getItemProps({ item: option, index })}
              className="comboOption comboOptionMulti"
              role="option"
              aria-selected={selected.includes(option.value)}
            >
              <input
                key="checkbox"
                type="checkbox"
                checked={selected.includes(option.value)}
                readOnly
                tabIndex={-1}
              />
              <span key="label">{option.label}</span>
            </div>
          ))
        ) : (
          <span className="metaMuted comboEmpty">No matches</span>
        )}
      </div>
      <FieldError msg={error} />
    </div>
  )
}
