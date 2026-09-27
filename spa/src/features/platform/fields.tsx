import { useId, type ReactNode, type ChangeEventHandler } from 'react'
import './platform.css'

function Field({
  label,
  name,
  defaultValue = '',
  type = 'text',
  required = false,
  maxLength = 200,
}: {
  label: string
  name: string
  defaultValue?: string
  type?: string
  required?: boolean
  maxLength?: number
}) {
  return (
    <label className="platformField">
      <span>
        {label}
        {required && (
          <span className="platformRequired" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
      />
    </label>
  )
}
function Text({
  label,
  name,
  defaultValue = '',
  required = false,
  maxLength = 5000,
}: {
  label: string
  name: string
  defaultValue?: string
  required?: boolean
  maxLength?: number
}) {
  return (
    <label className="platformField">
      <span>
        {label}
        {required && (
          <span className="platformRequired" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </span>
      <textarea
        className="input"
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        rows={4}
      />
    </label>
  )
}
function Select({
  label,
  name,
  children,
  defaultValue = '',
  value,
  onChange,
}: {
  label: string
  name: string
  children: ReactNode
  value?: string
  onChange?: ChangeEventHandler<HTMLSelectElement>
  defaultValue?: string
}) {
  const id = useId()
  return (
    <div className="platformField">
      <label htmlFor={id}>{label}</label>
      <select
        className="input"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        defaultValue={value === undefined ? defaultValue : undefined}
      >
        {children}
      </select>
    </div>
  )
}
function localDate(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}
export { Field, Text, Select, localDate }
