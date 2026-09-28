import { useDocument } from '../../lib/documents.js'
import { Button } from '../ui.jsx'
import {
  DatePicker,
  FieldError,
  MultiSelectDropdown,
  SearchableSelect,
} from '../FormControls.jsx'
import {
  GENDER_OPTIONS,
  MINORITY_SELECT_OPTIONS,
  REGION_OPTIONS,
  fieldClass,
  checkClass,
  loadPhoneSupport,
} from './helpers.js'
import { PhoneField, PolicyLink, WgInterestsSection } from './shared.jsx'

export function RegisterIndividualForm({
  form,
  fields,
  under18,
  countryOptions,
  nationalityOptions,
  setForm,
  setReg,
  setChoice,
  setPhone,
  setMinorityIdentity,
  toggleMinority,
  toggleWg,
  ensureCountryOptions,
  ensureNationalityOptions,
}) {
  const { doc: policiesDoc } = useDocument('policies')
  const { doc: connect } = useDocument('connect')
  const membershipEmail = connect?.MEMBERSHIP_CONTACT_EMAIL
  const POLICY_BY_SLUG = policiesDoc?.POLICY_BY_SLUG || {}

  return (
    <>
      <section className="card authSection authIntro">
        <h2 className="authSectionTitle">Individual registration</h2>
        <ul className="authBullet meta">
          <li>Ages 35 and under · no membership fees.</li>
          <li>Membership Team usually contacts you within ~2 weeks.</li>
          <li>
            2026 Contact Points and Focal Points: register with the email on the
            official WG/OT roster, then confirm that inbox. The Hub assigns the
            mandate from that match.
          </li>
        </ul>
        <p className="metaMuted">
          Help:{' '}
          <a
            className="mandateExtLink"
            href={`mailto:${membershipEmail}`}
          >
            {membershipEmail}
          </a>
        </p>
      </section>

      <section className="card authSection">
        <h2 className="authSectionTitle">How old are you? *</h2>
        <div className="authChoiceGrid">
          {[
            { value: 'under_18', label: 'Under 18' },
            { value: '18_35', label: '18–35' },
            { value: '35_plus', label: '35+' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`authChoice ${form.ageBand === opt.value ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="ageBand"
                checked={form.ageBand === opt.value}
                onChange={() => setForm((f) => ({ ...f, ageBand: opt.value }))}
              />
              <strong>{opt.label}</strong>
            </label>
          ))}
        </div>
        {/* Answered before the rest of the form is filled in, so
            nobody completes a long registration only to find out
            at submit time that they are not eligible. */}
        {form.ageBand === '35_plus' && (
          <div className="ageIneligible" role="alert">
            <h3>YOUNGO individual membership is for under-35s</h3>
            <p>
              YOUNGO is the children and youth constituency of the UNFCCC, so
              individual membership ends at 35. You cannot create an individual
              account with this age group selected.
            </p>
            <p>
              <strong>You can still take part.</strong> If you work with a youth
              organisation, register it here as an organisation — organisations
              have no age limit and can nominate youth representatives. For
              anything else, the membership team is happy to talk it through.
            </p>
            <div className="ageIneligibleActions">
              <Button
                variant="secondary"
                sm
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    entityType: 'organization',
                  }))
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Register an organisation instead
              </Button>
              <a
                className="btn btn-ghost btn-sm"
                href={membershipEmail ? `mailto:${membershipEmail}?subject=Membership%20question` : undefined}
              >
                Email the membership team
              </a>
            </div>
          </div>
        )}
        <FieldError msg={fields.ageBand} />
      </section>

      <section className="card authSection">
        <h2 className="authSectionTitle">Your details</h2>
        <div className="formRow">
          <label className={fieldClass(fields.firstName)}>
            <span>First name *</span>
            <input
              className="input"
              autoComplete="given-name"
              value={form.firstName}
              onChange={setReg('firstName')}
              aria-invalid={!!fields.firstName}
            />
            <FieldError msg={fields.firstName} />
          </label>
          <label className={fieldClass(fields.lastName)}>
            <span>Last name *</span>
            <input
              className="input"
              autoComplete="family-name"
              value={form.lastName}
              onChange={setReg('lastName')}
              aria-invalid={!!fields.lastName}
            />
            <FieldError msg={fields.lastName} />
          </label>
        </div>
        <label className={fieldClass(fields.email)}>
          <span>Email *</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={setReg('email')}
            aria-invalid={!!fields.email}
          />
          <FieldError msg={fields.email} />
        </label>
        <PhoneField
          label="Phone"
          required
          value={form.phone}
          onValueChange={setPhone('phone', 'phoneCountry')}
          onLoad={loadPhoneSupport}
          error={fields.phone}
        />
        <div className="formRow">
          <SearchableSelect
            label="Gender *"
            options={GENDER_OPTIONS}
            value={form.gender}
            onChange={setChoice('gender')}
            error={fields.gender}
            placeholder="Select gender…"
            searchPlaceholder="Search gender options…"
          />
          <DatePicker
            label="Date of birth *"
            value={form.dateOfBirth}
            onChange={setChoice('dateOfBirth')}
            error={fields.dateOfBirth}
          />
        </div>
        {form.gender === 'Other' && (
          <label className={fieldClass(fields.genderOther)}>
            <span>Please specify gender *</span>
            <input
              className="input"
              value={form.genderOther}
              onChange={setReg('genderOther')}
              aria-invalid={!!fields.genderOther}
            />
            <FieldError msg={fields.genderOther} />
          </label>
        )}
      </section>

      <section className="card authSection">
        <h2 className="authSectionTitle">YOUNGO Hub password</h2>
        <div className="formRow">
          <label className={fieldClass(fields.password)}>
            <span>
              Password * <span className="metaMuted">(min 10)</span>
            </span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={setReg('password')}
              aria-invalid={!!fields.password}
            />
            <FieldError msg={fields.password} />
          </label>
          <label className={fieldClass(fields.passwordConfirm)}>
            <span>Confirm password *</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.passwordConfirm}
              onChange={setReg('passwordConfirm')}
              aria-invalid={!!fields.passwordConfirm}
            />
            <FieldError msg={fields.passwordConfirm} />
          </label>
        </div>
      </section>

      <section className="card authSection">
        <h2 className="authSectionTitle">Background</h2>
        <p className="meta">Do you identify as part of a minority group? *</p>
        <div className="authChoiceGrid">
          <label
            className={`authChoice ${form.minorityIdentity === 'yes' ? 'active' : ''}`}
          >
            <input
              type="radio"
              name="minorityIdentity"
              checked={form.minorityIdentity === 'yes'}
              onChange={() => setMinorityIdentity('yes')}
            />
            <strong>Yes</strong>
          </label>
          <label
            className={`authChoice ${form.minorityIdentity === 'no' ? 'active' : ''}`}
          >
            <input
              type="radio"
              name="minorityIdentity"
              checked={form.minorityIdentity === 'no'}
              onChange={() => setMinorityIdentity('no')}
            />
            <strong>No</strong>
          </label>
        </div>
        <FieldError msg={fields.minorityIdentity} />
        {form.minorityIdentity === 'yes' && (
          <MultiSelectDropdown
            label="Which groups do you identify with? *"
            options={MINORITY_SELECT_OPTIONS}
            selected={form.minorityGroups}
            onToggle={toggleMinority}
            error={fields.minorityGroups}
          />
        )}
        {form.minorityIdentity === 'yes' &&
          form.minorityGroups.includes('Other') && (
            <label className="field">
              <span>Please specify *</span>
              <input
                className="input"
                value={form.minorityOther}
                onChange={setReg('minorityOther')}
              />
              <FieldError msg={fields.minorityOther} />
            </label>
          )}
        <SearchableSelect
          className="authSectionBreak"
          label="Region (UN classifications) *"
          options={REGION_OPTIONS}
          value={form.region}
          onChange={setChoice('region')}
          error={fields.region}
          placeholder="Select region…"
          searchPlaceholder="Search regions…"
        />
        <div className="formRow">
          <SearchableSelect
            label="Nationality *"
            options={nationalityOptions}
            value={form.nationality}
            onChange={setChoice('nationality')}
            error={fields.nationality}
            placeholder="Select nationality…"
            searchPlaceholder="Search nationalities…"
            onOpen={ensureNationalityOptions}
          />
          <SearchableSelect
            label="Country of residence *"
            value={form.countryOfResidence}
            options={countryOptions}
            onChange={setChoice('countryOfResidence', 'country')}
            onOpen={ensureCountryOptions}
            error={fields.country}
            placeholder="Select country…"
            searchPlaceholder="Search countries…"
          />
        </div>
        <label className="field">
          <span>Why do you want to join YOUNGO?</span>
          <textarea
            className="input textarea"
            rows={3}
            value={form.motivation}
            onChange={setReg('motivation')}
          />
        </label>
      </section>

      {under18 && (
        <section className="card authSection">
          <h2 className="authSectionTitle">Guardian permission (under 18) *</h2>
          <div className="formRow">
            <label className="field">
              <span>Guardian name *</span>
              <input
                className="input"
                value={form.guardianName}
                onChange={setReg('guardianName')}
              />
              <FieldError msg={fields.guardianName} />
            </label>
            <label className="field">
              <span>Guardian email *</span>
              <input
                className="input"
                type="email"
                value={form.guardianEmail}
                onChange={setReg('guardianEmail')}
              />
              <FieldError msg={fields.guardianEmail} />
            </label>
          </div>
          <label className="authCheck">
            <input
              type="checkbox"
              checked={form.guardianConsent}
              onChange={setReg('guardianConsent')}
            />
            <span>I confirm guardian permission has been obtained.</span>
          </label>
          <FieldError msg={fields.guardianConsent} />
        </section>
      )}

      <WgInterestsSection selected={form.wgInterests} onToggle={toggleWg} />

      <section className="card authSection">
        <h2 className="authSectionTitle">
          Accredited NGO membership (statistics)
        </h2>
        <p className="meta">
          Are you a member of an accredited NGO (which is a member of YOUNGO)? *
        </p>
        <div className="authChoiceGrid">
          <label
            className={`authChoice ${form.memberOfAccreditedNgo === 'yes' ? 'active' : ''}`}
          >
            <input
              type="radio"
              name="ngoStat"
              checked={form.memberOfAccreditedNgo === 'yes'}
              onChange={() =>
                setForm((f) => ({
                  ...f,
                  memberOfAccreditedNgo: 'yes',
                }))
              }
            />
            <strong>Yes</strong>
          </label>
          <label
            className={`authChoice ${form.memberOfAccreditedNgo === 'no' ? 'active' : ''}`}
          >
            <input
              type="radio"
              name="ngoStat"
              checked={form.memberOfAccreditedNgo === 'no'}
              onChange={() =>
                setForm((f) => ({
                  ...f,
                  memberOfAccreditedNgo: 'no',
                }))
              }
            />
            <strong>No</strong>
          </label>
        </div>
        <FieldError msg={fields.memberOfAccreditedNgo} />
      </section>

      <section className="card authSection">
        <h2 className="authSectionTitle">Agreements *</h2>
        <p className="meta">
          Open each policy link to read it, then tick the box. Links open in a
          new tab.
        </p>
        <div className="authAgreementList">
          <label className={checkClass(fields.acceptCodeOfConduct)}>
            <input
              type="checkbox"
              checked={form.acceptCodeOfConduct}
              onChange={setReg('acceptCodeOfConduct')}
            />
            <span>
              I agree to respect the YOUNGO{' '}
              <PolicyLink href={POLICY_BY_SLUG.codeOfConduct?.href}>
                Code of Conduct
              </PolicyLink>
              . *
            </span>
          </label>
          <FieldError msg={fields.acceptCodeOfConduct} />
          <label className={checkClass(fields.acceptDataProtection)}>
            <input
              type="checkbox"
              checked={form.acceptDataProtection}
              onChange={setReg('acceptDataProtection')}
            />
            <span>
              I agree to respect the YOUNGO{' '}
              <PolicyLink href={POLICY_BY_SLUG.dataProtection?.href}>
                Data Protection Policy
              </PolicyLink>
              . *
            </span>
          </label>
          <FieldError msg={fields.acceptDataProtection} />
          <label className={checkClass(fields.acceptPrinciples)}>
            <input
              type="checkbox"
              checked={form.acceptPrinciples}
              onChange={setReg('acceptPrinciples')}
            />
            <span>
              I agree to respect the YOUNGO{' '}
              <PolicyLink href={POLICY_BY_SLUG.principles?.href}>
                Principles
              </PolicyLink>
              . *
            </span>
          </label>
          <FieldError msg={fields.acceptPrinciples} />
          <label className={checkClass(fields.acceptCoiPolicy)}>
            <input
              type="checkbox"
              checked={form.acceptCoiPolicy}
              onChange={setReg('acceptCoiPolicy')}
            />
            <span>
              I agree to respect the YOUNGO{' '}
              <PolicyLink href={POLICY_BY_SLUG.conflictOfInterest?.href}>
                Conflict of Interest Policy
              </PolicyLink>
              . *
            </span>
          </label>
          <FieldError msg={fields.acceptCoiPolicy} />
        </div>
        <p className="metaMuted">
          <PolicyLink href="https://drive.google.com/drive/folders/1z7WAwxkJOzNaTlccZ4vr2fMn7vvXtReA">
            Browse all YOUNGO policies
          </PolicyLink>
        </p>
      </section>
    </>
  )
}
