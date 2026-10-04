interface RegisterOrgFormProps {
  form?: any
  fields?: any
  admitted?: any
  nonAdmitted?: any
  missionWords?: any
  countryOptions?: any
  setForm?: any
  setReg?: any
  setChoice?: any
  setPhone?: any
  toggleWg?: any
  ensureCountryOptions?: any
}

import { useDocument } from '../../lib/documents'
import { FieldError, SearchableSelect } from '../FormControls'
import { asOptions, fieldClass, checkClass, loadPhoneSupport } from './helpers'
import { PhoneField, PolicyLink, WgInterestsSection } from './shared'

export function RegisterOrgForm({
  form,
  fields,
  admitted,
  nonAdmitted,
  missionWords,
  countryOptions,
  setForm,
  setReg,
  setChoice,
  setPhone,
  toggleWg,
  ensureCountryOptions,
}: RegisterOrgFormProps) {
  const { doc: policiesDoc } = useDocument('policies')
  const { doc: connect } = useDocument('connect')
  const { doc: regOptions } = useDocument('registration-options')
  const membershipEmail = connect?.MEMBERSHIP_CONTACT_EMAIL
  const POLICY_BY_SLUG = policiesDoc?.POLICY_BY_SLUG || {}
  const REGION_OPTIONS = asOptions(regOptions?.regions || [])
  const YOUTH_AFFILIATION_OPTIONS = regOptions?.youthAffiliations || []

  return (
    <>
      <section className="card authSection authIntro">
        <h2 className="authSectionTitle">Organisation registration</h2>
        <ul className="authBullet meta">
          <li>YOUNGO is a platform/network — not a single NGO. No membership fees.</li>
          <li>Admitted and non-admitted youth-led groups can register.</li>
          <li>Membership Team usually replies within a few weeks.</li>
        </ul>
        <p className="metaMuted">
          Help:{' '}
          <a className="mandateExtLink" href={`mailto:${membershipEmail}`}>
            {membershipEmail}
          </a>
        </p>
      </section>

      <section className="card authSection">
        <h2 className="authSectionTitle">Organisation basics</h2>
        <label className={fieldClass(fields.email)}>
          <span>
            Email * <span className="metaMuted">(hub account & replies)</span>
          </span>
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
        <label className={fieldClass(fields.organizationName)}>
          <span>Full legal name of the organisation *</span>
          <input
            className="input"
            value={form.organizationName}
            onChange={setReg('organizationName')}
            aria-invalid={!!fields.organizationName}
          />
          <FieldError msg={fields.organizationName} />
        </label>
        <p className="meta authSectionPrompt">
          Is this organisation an <strong>admitted observer NGO</strong> of the UNFCCC? *
        </p>
        <div className="authChoiceGrid">
          <label className={`authChoice ${form.isUnfcccAdmitted === 'yes' ? 'active' : ''}`}>
            <input
              type="radio"
              name="admitted"
              checked={form.isUnfcccAdmitted === 'yes'}
              onChange={() => setForm((f: any) => ({ ...f, isUnfcccAdmitted: 'yes' }))}
            />
            <strong>Yes — admitted</strong>
            <span className="meta">UNFCCC observer NGO path (DCP + youth affiliation).</span>
          </label>
          <label className={`authChoice ${form.isUnfcccAdmitted === 'no' ? 'active' : ''}`}>
            <input
              type="radio"
              name="admitted"
              checked={form.isUnfcccAdmitted === 'no'}
              onChange={() => setForm((f: any) => ({ ...f, isUnfcccAdmitted: 'no' }))}
            />
            <strong>No — not admitted</strong>
            <span className="meta">Groups, movements, networks, non-admitted NGOs.</span>
          </label>
        </div>
        <FieldError msg={fields.isUnfcccAdmitted} />
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

      {admitted && (
        <>
          <section className="card authSection">
            <h2 className="authSectionTitle">UNFCCC-admitted NGO</h2>
            <p className="meta">
              Is your organisation affiliated with “youth” within the UNFCCC? *
            </p>
            <div className="authChoiceGrid">
              {YOUTH_AFFILIATION_OPTIONS.map((opt: any) => (
                <label
                  key={opt.value}
                  className={`authChoice ${form.youthAffiliation === opt.value ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="youthAff"
                    checked={form.youthAffiliation === opt.value}
                    onChange={() =>
                      setForm((f: any) => ({
                        ...f,
                        youthAffiliation: opt.value,
                      }))
                    }
                  />
                  <strong>{opt.label}</strong>
                </label>
              ))}
            </div>
            <FieldError msg={fields.youthAffiliation} />
            <SearchableSelect
              className="authSectionBreak"
              label="Region where legally established (UN groupings) *"
              options={REGION_OPTIONS}
              value={form.region}
              onChange={setChoice('region')}
              error={fields.region}
              placeholder="Select region…"
              searchPlaceholder="Search regions…"
            />
            <SearchableSelect
              label="Country where legally established *"
              options={countryOptions}
              value={form.orgCountry}
              onChange={setChoice('orgCountry', 'country')}
              onOpen={ensureCountryOptions}
              error={fields.country}
              placeholder="Select country…"
              searchPlaceholder="Search countries…"
            />
            <label className="field">
              <span>Regions and/or countries of operation</span>
              <textarea
                className="input textarea"
                rows={2}
                value={form.orgOperateIn}
                onChange={setReg('orgOperateIn')}
                placeholder="Admin base, projects, where members come from…"
              />
              <FieldError msg={fields.orgOperateIn} />
            </label>
            <div className="formRow">
              <label className="field">
                <span>Organisation website</span>
                <input
                  className="input"
                  type="url"
                  value={form.orgWebsite}
                  onChange={setReg('orgWebsite')}
                  placeholder="https://"
                />
              </label>
              <label className="field">
                <span>Social media link(s)</span>
                <input className="input" value={form.orgSocial} onChange={setReg('orgSocial')} />
              </label>
            </div>
            <label className="field">
              <span>
                Mission and activities{' '}
                <span className="metaMuted">(max 250 words · {missionWords}/250)</span>
              </span>
              <textarea
                className="input textarea"
                rows={4}
                value={form.orgMission}
                onChange={setReg('orgMission')}
              />
              <FieldError msg={fields.orgMission} />
            </label>
          </section>

          <section className="card authSection">
            <h2 className="authSectionTitle">UNFCCC Designated Contact Point *</h2>
            <label className="field">
              <span>DCP full name *</span>
              <input className="input" value={form.dcpName} onChange={setReg('dcpName')} />
              <FieldError msg={fields.dcpName} />
            </label>
            <div className="formRow">
              <label className="field">
                <span>DCP official email *</span>
                <input
                  className="input"
                  type="email"
                  value={form.dcpEmail}
                  onChange={setReg('dcpEmail')}
                />
                <FieldError msg={fields.dcpEmail} />
              </label>
              <PhoneField
                label="DCP phone"
                required
                value={form.dcpPhone}
                onValueChange={setPhone('dcpPhone', 'dcpPhoneCountry')}
                onLoad={loadPhoneSupport}
                error={fields.dcpPhone}
              />
            </div>
          </section>

          <section className="card authSection">
            <h2 className="authSectionTitle">
              YOUNGO Contact Point{' '}
              <span className="metaMuted">(if DCP is over 35 / not eligible)</span>
            </h2>
            <p className="meta">
              Facilitates communication with YOUNGO when the official UNFCCC DCP does not meet
              YOUNGO age criteria (no older than 35).
            </p>
            <label className="field">
              <span>YOUNGO Contact Point full name</span>
              <input className="input" value={form.ycpName} onChange={setReg('ycpName')} />
              <FieldError msg={fields.ycpName} />
            </label>
            <div className="formRow">
              <label className="field">
                <span>YOUNGO CP email</span>
                <input
                  className="input"
                  type="email"
                  value={form.ycpEmail}
                  onChange={setReg('ycpEmail')}
                />
                <FieldError msg={fields.ycpEmail} />
              </label>
              <PhoneField
                label="YOUNGO CP phone"
                value={form.ycpPhone}
                onValueChange={setPhone('ycpPhone', 'ycpPhoneCountry')}
                onLoad={loadPhoneSupport}
                error={fields.ycpPhone}
              />
            </div>
          </section>
        </>
      )}

      {nonAdmitted && (
        <section className="card authSection">
          <h2 className="authSectionTitle">Non-admitted NGO / group / movement / network</h2>
          <label className="field">
            <span>Regions and/or countries of operation *</span>
            <textarea
              className="input textarea"
              rows={3}
              value={form.orgOperateIn}
              onChange={setReg('orgOperateIn')}
              placeholder="Admin, projects, where members come from…"
            />
            <FieldError msg={fields.orgOperateIn} />
          </label>
          <label className="field">
            <span>Website / social media link(s)</span>
            <input
              className="input"
              value={form.orgWebsite || form.orgSocial}
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  orgWebsite: e.target.value,
                  orgSocial: e.target.value,
                }))
              }
              placeholder="https://"
            />
          </label>
          <label className="field">
            <span>
              Mission and activities{' '}
              <span className="metaMuted">(max 250 words · {missionWords}/250)</span>
            </span>
            <textarea
              className="input textarea"
              rows={4}
              value={form.orgMission}
              onChange={setReg('orgMission')}
            />
            <FieldError msg={fields.orgMission} />
          </label>
          <h3 className="authSectionSubheading">YOUNGO Contact Point *</h3>
          <p className="meta">Facilitates communication with YOUNGO and receives update emails.</p>
          <label className="field">
            <span>Contact Point full name *</span>
            <input className="input" value={form.ycpName} onChange={setReg('ycpName')} />
            <FieldError msg={fields.ycpName} />
          </label>
          <div className="formRow">
            <label className="field">
              <span>Contact Point email *</span>
              <input
                className="input"
                type="email"
                value={form.ycpEmail}
                onChange={setReg('ycpEmail')}
              />
              <FieldError msg={fields.ycpEmail} />
            </label>
            <PhoneField
              label="Contact Point phone"
              required
              value={form.ycpPhone}
              onValueChange={setPhone('ycpPhone', 'ycpPhoneCountry')}
              onLoad={loadPhoneSupport}
              error={fields.ycpPhone}
            />
          </div>
        </section>
      )}

      {(admitted || nonAdmitted) && (
        <WgInterestsSection selected={form.wgInterests} onToggle={toggleWg} />
      )}

      {(admitted || nonAdmitted) && (
        <section className="card authSection">
          <h2 className="authSectionTitle">Policies *</h2>
          <p className="meta">
            Open each policy to read it, then confirm. Official texts open in a new tab.
          </p>
          <label
            className={checkClass(
              fields.acceptAllOrgPolicies || fields.acceptCodeOfConduct || fields.acceptCoiPolicy,
            )}
          >
            <input
              type="checkbox"
              checked={form.acceptAllOrgPolicies}
              onChange={setReg('acceptAllOrgPolicies')}
            />
            <span>
              The organisation agrees to YOUNGO’s{' '}
              <PolicyLink href={POLICY_BY_SLUG.codeOfConduct?.href}>Code of Conduct</PolicyLink>,{' '}
              <PolicyLink href={POLICY_BY_SLUG.conflictOfInterest?.href}>
                Conflict of Interest Policy
              </PolicyLink>
              ,{' '}
              <PolicyLink href={POLICY_BY_SLUG.dataProtection?.href}>
                Data Protection Policy
              </PolicyLink>
              , and <PolicyLink href={POLICY_BY_SLUG.principles?.href}>Principles</PolicyLink>. *
            </span>
          </label>
          <FieldError
            msg={
              fields.acceptAllOrgPolicies || fields.acceptCodeOfConduct || fields.acceptCoiPolicy
            }
          />
          {policiesDoc?.browseAllUrl ? (
            <p className="metaMuted">
              <PolicyLink href={policiesDoc.browseAllUrl}>All policies folder</PolicyLink>
            </p>
          ) : null}
        </section>
      )}
    </>
  )
}
