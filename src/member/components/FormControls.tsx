import type { Key, ReactNode } from 'react'
import {
  Button,
  ComboBox,
  ComboBoxValue,
  Group,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Tag,
  TagGroup,
  TagList,
  useFilter,
} from 'react-aria-components'
import { TbSelector, TbX } from 'react-icons/tb'

// react aria owns the combobox pattern (keyboard, aria, focus, positioning);
// these wrappers keep the props every form already passes. anatomy follows the
// docs: label + group(input, button) + popover(listbox)

export interface Option {
  value: string
  label: string
}

const asList = (options: unknown): Option[] => (Array.isArray(options) ? options : [])

// map a react aria key back to the caller's original value (could be a number)
const valueFor = (list: Option[], key: Key | null) =>
  list.find((option) => String(option.value) === String(key))?.value

export function FieldError({ msg }: { msg?: ReactNode }) {
  if (!msg) return null
  return (
    <span className="fieldError" role="alert">
      {msg}
    </span>
  )
}

// native date input: already accessible and localised by the browser
export function DatePicker({
  label,
  value,
  onChange,
  error,
  min,
  max,
  disabled,
}: {
  label?: string
  value?: string | null
  onChange: (value: string) => void
  error?: string
  min?: string | null
  max?: string | null
  disabled?: boolean
}) {
  return (
    <label className={`field${error ? ' hasError' : ''}`}>
      <span>{label}</span>
      <input
        className="input"
        type="date"
        value={value || ''}
        min={min || undefined}
        max={max || undefined}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError msg={error} />
    </label>
  )
}

function InputRow({ placeholder }: { placeholder: string }) {
  return (
    <Group className="comboInput">
      <Input className="input" placeholder={placeholder} />
      <Button className="comboButton">
        <TbSelector size={16} aria-hidden />
      </Button>
    </Group>
  )
}

function OptionList({ list }: { list: Option[] }) {
  return (
    <Popover className="comboMenu" offset={4}>
      <ListBox
        items={list}
        renderEmptyState={() => (
          <span className="metaMuted comboEmpty">{list.length ? 'No matches' : 'Loading…'}</span>
        )}
      >
        {(option) => (
          <ListBoxItem id={String(option.value)} textValue={option.label} className="comboOption">
            {option.label}
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
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
}: {
  label?: string
  options?: unknown
  value?: string | null
  onChange: (value: string) => void
  error?: string
  placeholder?: string
  searchPlaceholder?: string
  onOpen?: () => void
  className?: string
  hideLabel?: boolean
  disabled?: boolean
  children?: ReactNode
}) {
  const { contains } = useFilter({ sensitivity: 'base' })
  const list = asList(options)
  return (
    <ComboBox
      className={`field${error ? ' hasError' : ''} ${className}`.trim()}
      items={list}
      value={value == null || value === '' ? null : String(value)}
      onChange={(key) => {
        const next = valueFor(list, key)
        if (next != null) onChange(next)
      }}
      defaultFilter={contains}
      allowsEmptyCollection
      isDisabled={disabled}
      isInvalid={!!error}
      onOpenChange={(open) => open && onOpen?.()}
    >
      {({ isOpen }) => (
        <>
          <Label className={hideLabel ? 'srOnly' : undefined}>{label}</Label>
          <InputRow placeholder={isOpen ? searchPlaceholder : placeholder} />
          <OptionList list={list} />
          <FieldError msg={error} />
          {children}
        </>
      )}
    </ComboBox>
  )
}

export function MultiSelectDropdown({
  label,
  options,
  selected = [],
  onToggle,
  error,
  hideLabel = false,
}: {
  label?: string
  options?: unknown
  selected?: string[]
  onToggle: (value: string) => void
  error?: string
  hideLabel?: boolean
}) {
  const { contains } = useFilter({ sensitivity: 'base' })
  const list = asList(options)
  return (
    <ComboBox
      className={`field${error ? ' hasError' : ''}`}
      selectionMode="multiple"
      items={list}
      value={selected.map(String)}
      // callers toggle one value at a time, so report just what changed
      onChange={(keys) => {
        const next = new Set(keys.map(String))
        for (const option of list) {
          if (next.has(String(option.value)) !== selected.includes(option.value)) {
            onToggle(option.value)
          }
        }
      }}
      defaultFilter={contains}
      isInvalid={!!error}
    >
      <Label className={hideLabel ? 'srOnly' : undefined}>{label}</Label>
      <InputRow placeholder="Type to search…" />
      <ComboBoxValue<Option> className="comboTags">
        {({ selectedItems }) => (
          <TagGroup
            aria-label={`Selected ${label?.toLowerCase() || 'options'}`}
            onRemove={(keys) => {
              for (const key of keys) {
                const value = valueFor(list, key)
                if (value != null) onToggle(value)
              }
            }}
          >
            <TagList items={selectedItems.filter((item): item is Option => item != null)}>
              {(option) => (
                <Tag id={String(option.value)} textValue={option.label} className="chip comboTag">
                  {option.label}
                  <Button slot="remove" className="comboTagRemove">
                    <TbX size={12} aria-hidden />
                  </Button>
                </Tag>
              )}
            </TagList>
          </TagGroup>
        )}
      </ComboBoxValue>
      <OptionList list={list} />
      <FieldError msg={error} />
    </ComboBox>
  )
}
