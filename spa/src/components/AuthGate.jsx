import { useMemo, useState } from 'react'
import {
  TbCheck as Check,
  TbKey as KeyRound,
  TbUserPlus as UserPlus,
} from 'react-icons/tb'
import { apiPost } from '../lib/api.js'
import { setSession } from '../lib/session.js'
import { POLICY_VERSION } from '../content/membershipPolicy.js'
import { PRIVACY_VERSION } from '../../shared/privacyNotice.js'
import { wordCount } from '../../shared/registration.js'
import { A, Button } from './ui.jsx'
import { Brand } from './Brand.jsx'
import { FieldError } from './FormControls.jsx'
import {
  ageFromDob,
  initialRegistrationForm,
  loadNationalityOptions,
  loadPhoneSupport,
  phoneInputValue,
  scrollToFirstError,
} from './auth/helpers.js'
import { FormAlert, PrivacyConsentSection } from './auth/shared.jsx'
import { ForgotPasswordForm } from './auth/ForgotPasswordForm.jsx'
import { SignInForm } from './auth/SignInForm.jsx'
import { RegisterIndividualForm } from './auth/RegisterIndividualForm.jsx'
import { RegisterOrgForm } from './auth/RegisterOrgForm.jsx'

/**
 * Sign-in and registration for individuals and organisations.
 */
export function AuthGate({ onAuthenticated, initialMode = 'register' }) {
  const [mode, setMode] = useState(initialMode)
  const [login, setLogin] = useState({ email: '', password: '', website: '' })
  const [form, setForm] = useState(initialRegistrationForm)
  const [countryOptions, setCountryOptions] = useState([])
  const [nationalityOptions, setNationalityOptions] = useState([])
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle')
  const [forgotMsg, setForgotMsg] = useState(null)

  const age = useMemo(() => ageFromDob(form.dateOfBirth), [form.dateOfBirth])
  const under18 =
    form.ageBand === 'under_18' || (age !== null && age < 18 && age >= 0)
  const isOrg = form.entityType === 'organization'
  const admitted = form.isUnfcccAdmitted === 'yes'
  const nonAdmitted = form.isUnfcccAdmitted === 'no'
  const missionWords = wordCount(form.orgMission)

  const clearFieldError = (key) => {
    setFields((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
    if (error) setError(null)
  }

  const setChoice =
    (key, errorKey = key) =>
    (value) => {
      setForm((current) => ({ ...current, [key]: value }))
      clearFieldError(errorKey)
    }

  const setReg = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
    setFields((prev) => {
      if (
        !prev[k] &&
        !(k === 'password' && prev.passwordConfirm) &&
        !(k === 'passwordConfirm' && prev.passwordConfirm)
      ) {
        return prev
      }
      const next = { ...prev }
      delete next[k]
      if (k === 'password' || k === 'passwordConfirm')
        delete next.passwordConfirm
      return next
    })
    if (error) setError(null)
  }

  const ensureCountryOptions = async () => {
    const support = await loadPhoneSupport()
    setCountryOptions((current) =>
      current.length ? current : support.getCountryOptions(),
    )
  }

  const ensureNationalityOptions = async () => {
    const options = await loadNationalityOptions()
    setNationalityOptions((current) => (current.length ? current : options))
  }

  const setPhone = (phoneKey, countryKey) => (event) => {
    const rawValue = phoneInputValue(event.target.value)
    setForm((current) => ({ ...current, [phoneKey]: rawValue }))
    clearFieldError(phoneKey)

    void loadPhoneSupport().then(({ formatPhoneWhileTyping }) => {
      setForm((current) => ({
        ...current,
        [phoneKey]: formatPhoneWhileTyping(
          current[phoneKey],
          current[countryKey],
        ),
      }))
    })
  }

  const setLog = (k) => (e) => {
    setLogin((f) => ({ ...f, [k]: e.target.value }))
    setFields((prev) => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
    if (error) setError(null)
  }

  const applyErrors = (err) => {
    setStatus('idle')
    setFields(err.fields || {})
    setError(err.message || 'Please fix the highlighted fields.')
    scrollToFirstError()
  }

  const toggleMinority = (label) => {
    setForm((f) => {
      const has = f.minorityGroups.includes(label)
      return {
        ...f,
        minorityGroups: has
          ? f.minorityGroups.filter((x) => x !== label)
          : [...f.minorityGroups, label],
      }
    })
  }

  const setMinorityIdentity = (value) => {
    setForm((current) => ({
      ...current,
      minorityIdentity: value,
      ...(value === 'no' ? { minorityGroups: [], minorityOther: '' } : {}),
    }))
    setFields((current) => {
      const next = { ...current }
      delete next.minorityIdentity
      if (value === 'no') {
        delete next.minorityGroups
        delete next.minorityOther
      }
      return next
    })
  }

  const toggleWg = (slug) => {
    setForm((f) => {
      const has = f.wgInterests.includes(slug)
      return {
        ...f,
        wgInterests: has
          ? f.wgInterests.filter((x) => x !== slug)
          : [...f.wgInterests, slug],
      }
    })
  }

  // A 2xx without an account means the request was classified as automated and
  // nothing was created. Surfacing it beats pretending to sign the person in
  // and dropping them back at the start with no idea what went wrong.
  const finishAuth = (data) => {
    if (!data?.account) {
      setStatus('idle')
      setError(
        'We could not complete that submission. Please reload the page and try again, or contact support if it keeps happening.',
      )
      return
    }
    setSession({ account: data.account })
    onAuthenticated(data.account)
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})
    let signedIn = false
    try {
      const data = await apiPost('/auth/login', login)
      finishAuth(data)
      signedIn = Boolean(data?.account)
    } catch (err) {
      applyErrors(err)
    } finally {
      if (!signedIn) setStatus('idle')
    }
  }

  const submitForgot = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})
    setForgotMsg(null)
    try {
      const data = await apiPost('/auth/forgot-password', {
        email: login.email,
        website: login.website,
      })
      setStatus('idle')
      setForgotMsg(
        data.message || 'If an account exists, a reset link was issued.',
      )
    } catch (err) {
      applyErrors(err)
    }
  }

  const submitRegister = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})

    // Report password errors before sending the form.
    const local = {}
    if (
      form.password &&
      form.passwordConfirm &&
      form.password !== form.passwordConfirm
    ) {
      local.passwordConfirm = 'Passwords do not match.'
    }
    if (form.password && form.password.length < 10) {
      local.password = 'Password must be at least 10 characters.'
    }
    if (Object.keys(local).length) {
      setStatus('idle')
      setFields(local)
      setError('Please fix the highlighted fields.')
      scrollToFirstError()
      return
    }

    let signedIn = false
    try {
      const { normalizePhone } = await loadPhoneSupport()
      const payload = {
        ...form,
        phone: normalizePhone(form.phone, form.phoneCountry),
        dcpPhone: normalizePhone(form.dcpPhone, form.dcpPhoneCountry),
        ycpPhone: normalizePhone(form.ycpPhone, form.ycpPhoneCountry),
        membershipPolicyVersion: POLICY_VERSION,
        privacyNoticeVersion: PRIVACY_VERSION,
        memberOfAccreditedNgo:
          form.memberOfAccreditedNgo === 'yes'
            ? true
            : form.memberOfAccreditedNgo === 'no'
              ? false
              : form.memberOfAccreditedNgo,
        isUnfcccAdmitted:
          form.isUnfcccAdmitted === 'yes'
            ? true
            : form.isUnfcccAdmitted === 'no'
              ? false
              : form.isUnfcccAdmitted,
      }
      const data = await apiPost('/auth/register', payload)
      finishAuth(data)
      signedIn = Boolean(data?.account)
    } catch (err) {
      applyErrors(err)
    } finally {
      // AuthGate unmounts on success; only clear the stuck button on failure.
      if (!signedIn) setStatus('idle')
    }
  }

  return (
    <main className="mandateGate" aria-labelledby="auth-title">
      <div className="mandateShell authShell" data-auth-mode={mode}>
        <header className="mandateHeader">
          <div className="gateBrand">
            <Brand />
          </div>
          <div className="authHeading">
            <div className="authHeadingCopy">
              {mode === 'register' && (
                <p className="metaMuted" style={{ marginBottom: 4 }}>
                  Step 2 of 2 · Membership policy accepted
                </p>
              )}
              <h1 id="auth-title">
                {mode === 'register'
                  ? 'Join YOUNGO Hub'
                  : mode === 'forgot'
                    ? 'Reset password'
                    : 'Sign in to YOUNGO Hub'}
              </h1>
              <p className="meta" style={{ marginTop: 6, maxWidth: 580 }}>
                {mode === 'register'
                  ? 'Create an individual or organisation account.'
                  : mode === 'forgot'
                    ? 'Enter your account email. We’ll issue a one-time reset link (valid 1 hour).'
                    : 'Welcome back. Sign in with the email you used to register.'}
              </p>
              <p className="authAboutRow">
                <A href="/about" className="authAboutLink">
                  About YOUNGO and membership
                </A>
              </p>
            </div>
          </div>
          {mode !== 'forgot' && (
            <nav className="authTabs" aria-label="Account access">
              <A
                href="/join"
                aria-current={mode === 'register' ? 'page' : undefined}
                className={`authTab ${mode === 'register' ? 'active' : ''}`}
              >
                <UserPlus size={18} strokeWidth={1.75} aria-hidden />
                Join YOUNGO
              </A>
              <A
                href="/signin"
                aria-current={mode === 'signin' ? 'page' : undefined}
                className={`authTab ${mode === 'signin' ? 'active' : ''}`}
              >
                <KeyRound size={18} strokeWidth={1.75} aria-hidden />
                Sign in
              </A>
            </nav>
          )}
        </header>

        <div className="mandateBody authBody">
          {mode === 'forgot' ? (
            <ForgotPasswordForm
              login={login}
              fields={fields}
              error={error}
              forgotMsg={forgotMsg}
              status={status}
              setLog={setLog}
              onSubmit={submitForgot}
              onBack={() => {
                setMode('signin')
                setForgotMsg(null)
              }}
            />
          ) : mode === 'signin' ? (
            <SignInForm
              login={login}
              fields={fields}
              error={error}
              status={status}
              setLog={setLog}
              onSubmit={submitLogin}
              onForgot={() => {
                setMode('forgot')
                setError(null)
                setFields({})
              }}
            />
          ) : (
            <form className="authForm" onSubmit={submitRegister} noValidate>
              <FormAlert>{error}</FormAlert>
              <section className="card authSection">
                <h2 className="authSectionTitle">Who is registering? *</h2>
                <div className="authChoiceGrid">
                  <label
                    className={`authChoice ${form.entityType === 'individual' ? 'active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="entity"
                      checked={form.entityType === 'individual'}
                      onChange={() =>
                        setForm((f) => ({ ...f, entityType: 'individual' }))
                      }
                    />
                    <strong>Individual</strong>
                    <span className="meta">
                      Child or young person joining YOUNGO personally.
                    </span>
                  </label>
                  <label
                    className={`authChoice ${form.entityType === 'organization' ? 'active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="entity"
                      checked={form.entityType === 'organization'}
                      onChange={() =>
                        setForm((f) => ({ ...f, entityType: 'organization' }))
                      }
                    />
                    <strong>Organisation / NGO</strong>
                    <span className="meta">
                      Child- or youth-led NGO, movement, group, or network.
                    </span>
                  </label>
                </div>
                <FieldError msg={fields.entityType} />
              </section>

              {isOrg ? (
                <RegisterOrgForm
                  form={form}
                  fields={fields}
                  admitted={admitted}
                  nonAdmitted={nonAdmitted}
                  missionWords={missionWords}
                  countryOptions={countryOptions}
                  setForm={setForm}
                  setReg={setReg}
                  setChoice={setChoice}
                  setPhone={setPhone}
                  toggleWg={toggleWg}
                  ensureCountryOptions={ensureCountryOptions}
                />
              ) : (
                <RegisterIndividualForm
                  form={form}
                  fields={fields}
                  under18={under18}
                  countryOptions={countryOptions}
                  nationalityOptions={nationalityOptions}
                  setForm={setForm}
                  setReg={setReg}
                  setChoice={setChoice}
                  setPhone={setPhone}
                  setMinorityIdentity={setMinorityIdentity}
                  toggleMinority={toggleMinority}
                  toggleWg={toggleWg}
                  ensureCountryOptions={ensureCountryOptions}
                  ensureNationalityOptions={ensureNationalityOptions}
                />
              )}

              <PrivacyConsentSection
                checked={form.privacyConsent}
                onChange={setReg('privacyConsent')}
                error={fields.privacyConsent}
                isOrg={isOrg}
              />

              {/* The hidden honeypot input that used to sit here was filled by
                  browser autofill and password managers, which silently voided
                  real registrations. Browsers cannot fill a field that is not
                  in the document, so the trap now lives only on the server —
                  scripted posts that blindly include `hpWebsite` are still
                  rejected there. */}

              {error && <FormAlert>{error}</FormAlert>}

              <div className="authSubmitBar card cardTight">
                <p className="metaMuted authSubmitCopy">
                  {isOrg
                    ? 'Creates a hub account for the contact on this form.'
                    : 'Creates your YOUNGO Hub account.'}
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  glow
                  disabled={
                    status === 'submitting' ||
                    form.ageBand === '35_plus' ||
                    (isOrg && !form.isUnfcccAdmitted)
                  }
                >
                  <Check size={18} strokeWidth={1.75} aria-hidden />
                  {status === 'submitting'
                    ? 'Submitting…'
                    : 'Submit & open hub'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
