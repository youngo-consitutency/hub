type AuthMode = 'register' | 'signin' | 'forgot'
type LoginField = 'email' | 'password' | 'website'
type PhoneField = 'phone' | 'dcpPhone' | 'ycpPhone'
type PhoneCountryField = 'phoneCountry' | 'dcpPhoneCountry' | 'ycpPhoneCountry'

interface AuthGateProps {
  onAuthenticated: (account: Account) => void
  initialMode?: AuthMode
}

import type { Doc, Account } from '../lib/types'
import type { MembershipPolicyDoc, PrivacyNoticeDoc } from '../../shared/contracts'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { TbCheck as Check, TbKey as KeyRound, TbUserPlus as UserPlus } from 'react-icons/tb'
import { apiPost, fieldErrors } from '../lib/api'
import { setSession } from '../lib/session'
import { useDocument } from '../lib/documents'
import { wordCount } from './auth/helpers'
import { A, Button } from './ui'
import { Brand } from './Brand'
import { CommunityPanel } from './CommunityPanel'
import { FieldError } from './FormControls'
import {
  ageFromDob,
  initialRegistrationForm,
  loadNationalityOptions,
  loadPhoneSupport,
  phoneInputValue,
  scrollToFirstError,
  type RegistrationField,
  type RegistrationForm,
} from './auth/helpers'
import { FormAlert, PrivacyConsentSection } from './auth/shared'
import { ForgotPasswordForm } from './auth/ForgotPasswordForm'
import { SignInForm } from './auth/SignInForm'
import { CheckYourEmail } from './auth/CheckYourEmail'
import { RegisterIndividualForm } from './auth/RegisterIndividualForm'
import { RegisterOrgForm } from './auth/RegisterOrgForm'

// add the item if absent, remove it if present
const toggled = (items: string[], item: string) =>
  items.includes(item) ? items.filter((x) => x !== item) : [...items, item]

/**
 * Sign-in and registration for individuals and organisations.
 */
export function AuthGate({ onAuthenticated, initialMode = 'register' }: AuthGateProps) {
  // Versions stamped on registration come from the CMS documents the user
  // actually read — the bundle no longer ships legal copy.
  const { doc: membershipPolicy } = useDocument<MembershipPolicyDoc>('membership-policy')
  const { doc: privacyNotice } = useDocument<PrivacyNoticeDoc>('privacy-notice')
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [login, setLogin] = useState({ email: '', password: '', website: '' })
  const [form, setForm] = useState<RegistrationForm>(initialRegistrationForm)
  const [countryOptions, setCountryOptions] = useState<{ value: string; label: string }[]>([])
  const [nationalityOptions, setNationalityOptions] = useState<{ value: string; label: string }[]>(
    [],
  )
  const [fields, setFields] = useState<Doc>({})
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')
  const [forgotMsg, setForgotMsg] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  // not memoised: an open page should notice a birthday at midnight
  const age = ageFromDob(form.dateOfBirth)
  const under18 = form.ageBand === 'under_18' || (age !== null && age < 18 && age >= 0)
  const isOrg = form.entityType === 'organization'
  const admitted = form.isUnfcccAdmitted === 'yes'
  const nonAdmitted = form.isUnfcccAdmitted === 'no'
  const missionWords = wordCount(form.orgMission)

  const clearFieldError = (key: string) => {
    setFields((previous) => {
      if (!previous[key]) return previous
      const next = { ...previous }
      delete next[key]
      return next
    })
    if (error) setError(null)
  }

  const setChoice =
    <K extends RegistrationField>(key: K, errorKey: string = key) =>
    (value: RegistrationForm[K]) => {
      setForm((current) => ({ ...current, [key]: value }))
      clearFieldError(errorKey)
    }

  const setReg =
    (k: RegistrationField) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { target } = e
      const v =
        target instanceof HTMLInputElement && target.type === 'checkbox'
          ? target.checked
          : target.value
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
        if (k === 'password' || k === 'passwordConfirm') delete next.passwordConfirm
        return next
      })
      if (error) setError(null)
    }

  const ensureCountryOptions = async () => {
    const support = await loadPhoneSupport()
    setCountryOptions((current) => (current.length ? current : support.getCountryOptions()))
  }

  const ensureNationalityOptions = async () => {
    const options = await loadNationalityOptions()
    setNationalityOptions((current) => (current.length ? current : options))
  }

  const setPhone =
    (phoneKey: PhoneField, countryKey: PhoneCountryField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const rawValue = phoneInputValue(event.target.value)
      setForm((current) => ({ ...current, [phoneKey]: rawValue }))
      clearFieldError(phoneKey)

      void loadPhoneSupport().then(({ formatPhoneWhileTyping }) => {
        setForm((current) => ({
          ...current,
          [phoneKey]: formatPhoneWhileTyping(current[phoneKey], current[countryKey]),
        }))
      })
    }

  const setLog = (k: LoginField) => (e: ChangeEvent<HTMLInputElement>) => {
    setLogin((f) => ({ ...f, [k]: e.target.value }))
    setFields((prev) => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
    if (error) setError(null)
  }

  const applyErrors = (err: unknown) => {
    setStatus('idle')
    setFields(fieldErrors(err))
    setError(
      err instanceof Error && err.message ? err.message : 'Please fix the highlighted fields.',
    )
    scrollToFirstError()
  }

  const toggleMinority = (label: string) => {
    setForm((f) => ({ ...f, minorityGroups: toggled(f.minorityGroups, label) }))
  }

  const setMinorityIdentity = (value: string) => {
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

  const toggleWg = (slug: string) => {
    setForm((f) => ({ ...f, wgInterests: toggled(f.wgInterests, slug) }))
  }

  // A 2xx without an account means the request was flagged as automated; show an error.
  const finishAuth = (data: Doc) => {
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

  const submitLogin = async (e: FormEvent<HTMLFormElement>) => {
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

  const submitForgot = async (e: FormEvent<HTMLFormElement>) => {
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
      setForgotMsg(data.message || 'If an account exists, a reset link was issued.')
    } catch (err) {
      applyErrors(err)
    }
  }

  const submitRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('submitting')
    setError(null)
    setFields({})

    // Report password errors before sending the form.
    const local: Record<string, string> = {}
    if (form.password && form.passwordConfirm && form.password !== form.passwordConfirm) {
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

    try {
      const { normalizePhone } = await loadPhoneSupport()
      const payload = {
        ...form,
        phone: normalizePhone(form.phone, form.phoneCountry),
        dcpPhone: normalizePhone(form.dcpPhone, form.dcpPhoneCountry),
        ycpPhone: normalizePhone(form.ycpPhone, form.ycpPhoneCountry),
        membershipPolicyVersion: membershipPolicy?.POLICY_VERSION,
        privacyNoticeVersion: privacyNotice?.PRIVACY_VERSION,
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
      const data = await apiPost<{ pendingVerification?: boolean }>('/auth/register', payload)
      // the address owner finishes by email; nothing here says whether the address already exists
      if (!data.pendingVerification) throw new Error('Unexpected sign-up response.')
      setPendingEmail(form.email.trim())
    } catch (err) {
      applyErrors(err)
    } finally {
      setStatus('idle')
    }
  }

  return (
    <main className="mandateGate" data-auth-mode={mode} aria-labelledby="auth-title">
      <a className="skipLink" href="#auth-body">
        Skip to the form
      </a>
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
                  ? 'Create your account'
                  : mode === 'forgot'
                    ? 'Reset password'
                    : 'Welcome back'}
              </h1>
              <p className="meta" style={{ marginTop: 6, maxWidth: 580 }}>
                {mode === 'register'
                  ? 'Create an individual or organisation account.'
                  : mode === 'forgot'
                    ? 'Enter your account email. We’ll issue a one-time reset link (valid 1 hour).'
                    : 'Use the email you registered with.'}
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

        <div className="mandateBody authBody" id="auth-body" tabIndex={-1}>
          {pendingEmail ? (
            <CheckYourEmail email={pendingEmail} onStartOver={() => setPendingEmail(null)} />
          ) : mode === 'forgot' ? (
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
                      onChange={() => setForm((f) => ({ ...f, entityType: 'individual' }))}
                    />
                    <strong>Individual</strong>
                    <span className="meta">Child or young person joining YOUNGO personally.</span>
                  </label>
                  <label
                    className={`authChoice ${form.entityType === 'organization' ? 'active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="entity"
                      checked={form.entityType === 'organization'}
                      onChange={() => setForm((f) => ({ ...f, entityType: 'organization' }))}
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

              {/* the guardian pathway replaces the application, consent included */}
              {!(under18 && !isOrg) && (
                <>
                  <PrivacyConsentSection
                    notice={privacyNotice}
                    checked={form.privacyConsent}
                    onChange={setReg('privacyConsent')}
                    error={fields.privacyConsent}
                    isOrg={isOrg}
                  />

                  {/* No honeypot input here: autofill filled it and voided real sign-ups. The server still rejects `hpWebsite`. */}

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
                      {status === 'submitting' ? 'Submitting…' : 'Submit & open hub'}
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
      {mode === 'signin' && <CommunityPanel />}
    </main>
  )
}
