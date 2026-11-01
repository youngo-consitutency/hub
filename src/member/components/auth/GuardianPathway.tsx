interface GuardianPathwayProps {
  form: AnyValue
  dobError?: string
  setChoice: AnyValue
  membershipEmail?: string
}

import type { AnyValue, Doc } from '../../lib/types'
import { useState } from 'react'
import { TbCheck as Check, TbShieldLock as ShieldLock } from 'react-icons/tb'
import {
  GUARDIAN_CONSENT_STATEMENT,
  GUARDIAN_FIELDS,
  GUARDIAN_RELATIONSHIPS,
} from '../../../shared/guardianEnquiry'
import { apiPost } from '../../lib/api'
import { Button } from '../ui'
import { DatePicker, FieldError } from '../FormControls'
import { FormAlert } from './shared'

const EMPTY = { guardianName: '', guardianEmail: '', relationship: '', guardianAuthority: false }

/**
 * Safeguarding stop for under-18 applicants. The application ends here and
 * nothing from it is saved; a parent or legal guardian may ask the
 * Membership Team to make contact instead. It renders inside the
 * registration <form>, so it submits with a button rather than a nested form.
 */
export function GuardianPathway({
  form,
  dobError,
  setChoice,
  membershipEmail,
}: GuardianPathwayProps) {
  const [guardian, setGuardian] = useState<Doc>(EMPTY)
  const [fields, setFields] = useState<Doc>({})
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle')
  const set = (key: string, value: AnyValue) => {
    setGuardian((g) => ({ ...g, [key]: value }))
    setFields(({ [key]: _cleared, ...rest }) => rest)
  }

  async function submit() {
    setStatus('submitting')
    setError(null)
    try {
      await apiPost('/auth/guardian-enquiry', guardian)
      setGuardian(EMPTY)
      setStatus('sent')
    } catch (e: AnyValue) {
      setFields(e.fields || {})
      setError(e.fields ? null : e.message)
      setStatus('idle')
    }
  }

  if (status === 'sent') {
    return (
      <section className="card authSection guardianDone" role="status">
        <span className="iconTile" aria-hidden>
          <Check size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="authSectionTitle">Request received</h2>
          <p className="meta">
            The Membership Team will contact the guardian by email. Nothing else from this page was
            saved.
          </p>
        </div>
      </section>
    )
  }

  const dobStopped = form.ageBand !== 'under_18' && Boolean(form.dateOfBirth)

  return (
    <section className="card authSection guardianPathway" aria-labelledby="guardian-title">
      <div className="guardianHead">
        <span className="iconTile" aria-hidden>
          <ShieldLock size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="authSectionTitle" id="guardian-title">
            Parent or legal guardian
          </h2>
          <p>
            This application stops here. YOUNGO Hub does not take the membership application of
            someone under 18.
          </p>
        </div>
      </div>
      <p className="meta">
        Nothing you entered has been saved — no name, email, phone number, date of birth or any
        other answer. Nothing is stored until a parent or legal guardian sends the request below.
      </p>

      {dobStopped && (
        <div className="guardianDob">
          <p className="meta">
            The date of birth on this page is under 18, so the application has stopped. Correct it
            here if that was a mistake.
          </p>
          <DatePicker
            label="Date of birth"
            value={form.dateOfBirth}
            onChange={setChoice('dateOfBirth')}
            error={dobError}
          />
        </div>
      )}

      <h3 className="guardianSubhead">What this request stores</h3>
      <ul className="guardianFields">
        {GUARDIAN_FIELDS.map((item: AnyValue) => (
          <li key={item.id}>
            <strong>{item.label}</strong>
            <span className="meta">{item.why}</span>
          </li>
        ))}
      </ul>
      <p className="meta">
        Only the Membership Team can see an open request — not other members, not working-group
        contact points, and not Hub search. It is deleted when the team closes it, or 12 months
        after it was sent.
      </p>
      {membershipEmail && (
        <p className="meta">
          A guardian can also email{' '}
          <a className="mandateExtLink" href={`mailto:${membershipEmail}`}>
            {membershipEmail}
          </a>{' '}
          instead.
        </p>
      )}

      <div className="formRow">
        <label className="field">
          <span>Guardian name *</span>
          <input
            className="input"
            autoComplete="name"
            value={guardian.guardianName}
            onChange={(e) => set('guardianName', e.target.value)}
            aria-invalid={!!fields.guardianName}
          />
          <FieldError msg={fields.guardianName} />
        </label>
        <label className="field">
          <span>Guardian email *</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={guardian.guardianEmail}
            onChange={(e) => set('guardianEmail', e.target.value)}
            aria-invalid={!!fields.guardianEmail}
          />
          <FieldError msg={fields.guardianEmail} />
        </label>
      </div>
      <fieldset className="guardianRelationship">
        <legend className="meta">I am the *</legend>
        <div className="authChoiceGrid">
          {GUARDIAN_RELATIONSHIPS.map((opt: AnyValue) => (
            <label
              key={opt.value}
              className={`authChoice ${guardian.relationship === opt.value ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="guardianRelationship"
                checked={guardian.relationship === opt.value}
                onChange={() => set('relationship', opt.value)}
              />
              <strong>{opt.label}</strong>
            </label>
          ))}
        </div>
        <FieldError msg={fields.relationship} />
      </fieldset>
      <label className="authCheck">
        <input
          type="checkbox"
          checked={guardian.guardianAuthority}
          onChange={(e) => set('guardianAuthority', e.target.checked)}
        />
        <span>{GUARDIAN_CONSENT_STATEMENT}</span>
      </label>
      <FieldError msg={fields.guardianAuthority} />
      {error && <FormAlert>{error}</FormAlert>}
      <div className="guardianActions">
        <Button
          type="button"
          variant="primary"
          glow
          disabled={status === 'submitting'}
          onClick={submit}
        >
          <Check size={18} strokeWidth={1.75} aria-hidden />
          {status === 'submitting' ? 'Sending…' : 'Send guardian request'}
        </Button>
      </div>
    </section>
  )
}
