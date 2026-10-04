interface WgInterestsSectionProps {
  selected?: AnyValue
  onToggle?: AnyValue
}

interface PhoneFieldProps {
  label?: string
  value?: AnyValue
  onValueChange?: AnyValue
  onLoad?: AnyValue
  error?: string
  required?: boolean
}

interface PolicyLinkProps {
  href?: string
  children?: import('react').ReactNode
}

interface PrivacyConsentSectionProps {
  checked?: boolean
  onChange?: AnyValue
  error?: string
  isOrg?: AnyValue
  notice?: AnyValue
}

interface FormAlertProps {
  children?: import('react').ReactNode
}

import type { AnyValue } from '../../lib/types'
import { TbExternalLink as ExternalLink } from 'react-icons/tb'
import { FieldError, MultiSelectDropdown } from '../FormControls'
import { fieldClass, checkClass } from './helpers'
import { useWorkingGroups } from '../../lib/workingGroups'

export function WgInterestsSection({ selected, onToggle }: WgInterestsSectionProps) {
  const wg = useWorkingGroups()
  const options = wg.groups.map((g: AnyValue) => ({ value: g.slug, label: g.name }))
  return (
    <section className="card authSection">
      <h2 className="authSectionTitle">Working groups you’re interested in</h2>
      <p className="meta">
        Optional. You’ll complete each group’s onboarding before its member channels open.
      </p>
      <MultiSelectDropdown
        label="Working groups"
        hideLabel
        options={options}
        selected={selected}
        onToggle={onToggle}
      />
    </section>
  )
}

export function PhoneField({
  label,
  value,
  onValueChange,
  onLoad,
  error,
  required = false,
}: PhoneFieldProps) {
  return (
    <label className={fieldClass(error)}>
      <span>
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        className="input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+123 456 7890"
        value={value || '+ '}
        onFocus={(event) => {
          onLoad?.()
          const input = event.currentTarget
          if ((input.selectionStart ?? 0) <= 1) {
            requestAnimationFrame(() => {
              input.setSelectionRange(2, 2)
            })
          }
        }}
        onKeyDown={(event) => {
          const input = event.currentTarget
          if (
            ((event as AnyValue).key === 'Backspace' &&
              (input as AnyValue as AnyValue).selectionStart <= 2 &&
              (input.selectionEnd ?? 0) <= 2) ||
            (event.key === 'Delete' &&
              (input as AnyValue as AnyValue).selectionStart === 0 &&
              (input.selectionEnd ?? 0) <= 2)
          ) {
            event.preventDefault()
          }
        }}
        onChange={onValueChange}
        aria-invalid={!!error}
      />
      <FieldError msg={error} />
    </label>
  )
}

/** Policy link that does not change the surrounding checkbox. */
export function PolicyLink({ href, children }: PolicyLinkProps) {
  if (!href) return <span>{children}</span>
  return (
    <a
      href={href}
      className="policyInlineLink"
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <ExternalLink size={12} strokeWidth={1.75} aria-hidden className="policyInlineIcon" />
    </a>
  )
}

/**
 * Privacy consent is separate from agreeing to follow YOUNGO policies. The
 * summary remains visible without opening the full notice.
 */
export function PrivacyConsentSection({
  checked,
  onChange,
  error,
  isOrg,
  notice,
}: PrivacyConsentSectionProps) {
  const CONSENT_SUMMARY = notice?.CONSENT_SUMMARY || []
  const CONSENT_STATEMENT = notice?.CONSENT_STATEMENT
  const PRIVACY_VERSION = notice?.PRIVACY_VERSION
  const PRIVACY_META = notice?.PRIVACY_META || {}
  return (
    <section className="card authSection">
      <h2 className="authSectionTitle">Your data and your consent *</h2>
      <p className="meta">
        {isOrg
          ? 'Before the organisation registers, please read how the YOUNGO Hub handles the contact details on this form.'
          : 'We use the information on this form to create and manage your Hub account. The Membership Policy covers participation in YOUNGO; the Privacy Notice covers how this information is used and protected.'}
      </p>
      <ul className="authBullet meta">
        {CONSENT_SUMMARY.map((point: AnyValue) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <p className="metaMuted">
        <PolicyLink href="/privacy">
          Read the full YOUNGO Hub Privacy Notice (version {PRIVACY_VERSION})
        </PolicyLink>
      </p>
      <label className={checkClass(error)}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span>{CONSENT_STATEMENT} *</span>
      </label>
      <FieldError msg={error} />
      <p className="metaMuted">
        You can withdraw this consent at any time by emailing{' '}
        <a className="mandateExtLink" href={`mailto:${PRIVACY_META.contactEmail}`}>
          {PRIVACY_META.contactEmail}
        </a>
        . Withdrawing closes the Hub account; it does not by itself end YOUNGO membership.
      </p>
    </section>
  )
}

export function FormAlert({ children }: FormAlertProps) {
  if (!children) return null
  return (
    <div className="formAlert" role="alert">
      {children}
    </div>
  )
}
