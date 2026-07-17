import { useMemo, useState } from 'react'
import {
  Building2, Check, KeyRound, Shield, UserPlus, Globe2, Heart, Users,
} from 'lucide-react'
import { apiPost } from '../lib/api.js'
import { setSession } from '../lib/session.js'
import { POLICY_VERSION } from '../content/membershipPolicy.js'
import { Button } from './ui.jsx'

const REGIONS = [
  'Africa',
  'Asia-Pacific',
  'Eastern Europe',
  'Latin America and the Caribbean',
  'Western Europe and Others',
]

const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say', 'Other']

const MINORITY_OPTIONS = [
  'Indigenous peoples',
  'Persons with disabilities',
  'LGBTQIA+ community',
  'Refugees',
  'Women',
  'Children',
  'Other',
]

const WG_OPTIONS = [
  { slug: 'ace', label: 'ACE' },
  { slug: 'finance', label: 'Finance' },
  { slug: 'adaptation', label: 'Adaptation' },
  { slug: 'health', label: 'Health' },
]

const EMPTY_REGISTER = {
  email: '',
  password: '',
  passwordConfirm: '',
  entityType: 'individual',
  // individual
  ageBand: '',
  firstName: '',
  lastName: '',
  phone: '',
  gender: '',
  genderOther: '',
  dateOfBirth: '',
  minorityGroups: [],
  minorityOther: '',
  region: '',
  nationality: '',
  countryOfResidence: '',
  motivation: '',
  memberOfAccreditedNgo: '',
  guardianName: '',
  guardianEmail: '',
  guardianConsent: false,
  acceptCodeOfConduct: false,
  acceptDataProtection: false,
  acceptPrinciples: false,
  acceptCoiPolicy: false,
  // organisation
  organizationName: '',
  isUnfcccAdmitted: '', // 'yes' | 'no'
  youthAffiliation: '', // primary | secondary | no
  orgCountry: '',
  orgOperateIn: '',
  orgWebsite: '',
  orgSocial: '',
  orgMission: '',
  dcpName: '',
  dcpEmail: '',
  dcpPhone: '',
  ycpName: '',
  ycpEmail: '',
  ycpPhone: '',
  acceptAllOrgPolicies: false,
  membershipTrack: 'network',
  wgInterests: [],
  hpWebsite: '',
}

function FieldError({ msg }) {
  if (!msg) return null
  return <span className="fieldError">{msg}</span>
}

function ageFromDob(dob) {
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age
}

function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length
}

/**
 * Sign-in / Join YOUNGO registration.
 * Individual path + organisational path (UNFCCC admitted vs non-admitted).
 */
export function AuthGate({ onAuthenticated }) {
  const [mode, setMode] = useState('register')
  const [login, setLogin] = useState({ email: '', password: '', website: '' })
  const [form, setForm] = useState(EMPTY_REGISTER)
  const [fields, setFields] = useState({})
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('idle')
  const [forgotMsg, setForgotMsg] = useState(null)

  const age = useMemo(() => ageFromDob(form.dateOfBirth), [form.dateOfBirth])
  const under18 = form.ageBand === 'under_18' || (age !== null && age < 18 && age >= 0)
  const isOrg = form.entityType === 'organization'
  const admitted = form.isUnfcccAdmitted === 'yes'
  const nonAdmitted = form.isUnfcccAdmitted === 'no'
  const missionWords = wordCount(form.orgMission)

  const setReg = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
  }
  const setLog = (k) => (e) => setLogin((f) => ({ ...f, [k]: e.target.value }))

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

  const finishAuth = (data) => {
    setSession({ token: data.token, account: data.account })
    onAuthenticated(data.account)
  }

  const submitLogin = async (e) => {
    e.preventDefault()
    setStatus('submitting'); setError(null); setFields({})
    try {
      const data = await apiPost('/auth/login', login)
      finishAuth(data)
    } catch (err) {
      setStatus('idle')
      setFields(err.fields || {})
      setError(err.message)
    }
  }

  const submitForgot = async (e) => {
    e.preventDefault()
    setStatus('submitting'); setError(null); setFields({}); setForgotMsg(null)
    try {
      const data = await apiPost('/auth/forgot-password', { email: login.email, website: login.website })
      setStatus('idle')
      setForgotMsg(data.message || 'If an account exists, a reset link was issued.')
    } catch (err) {
      setStatus('idle')
      setFields(err.fields || {})
      setError(err.message)
    }
  }

  const submitRegister = async (e) => {
    e.preventDefault()
    setStatus('submitting'); setError(null); setFields({})
    try {
      const payload = {
        ...form,
        membershipPolicyVersion: POLICY_VERSION,
        memberOfAccreditedNgo: form.memberOfAccreditedNgo === 'yes'
          ? true
          : form.memberOfAccreditedNgo === 'no'
            ? false
            : form.memberOfAccreditedNgo,
        isUnfcccAdmitted: form.isUnfcccAdmitted === 'yes'
          ? true
          : form.isUnfcccAdmitted === 'no'
            ? false
            : form.isUnfcccAdmitted,
      }
      const data = await apiPost('/auth/register', payload)
      finishAuth(data)
    } catch (err) {
      setStatus('idle')
      setFields(err.fields || {})
      setError(err.message)
    }
  }

  return (
    <div className="mandateGate" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="mandateShell authShell">
        <header className="mandateHeader">
          <div className="rowGap" style={{ alignItems: 'flex-start', paddingBottom: 16 }}>
            <span className="iconTile" aria-hidden>
              {mode === 'register' ? <UserPlus size={22} strokeWidth={1.75} /> : <KeyRound size={22} strokeWidth={1.75} />}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="metaMuted" style={{ marginBottom: 4 }}>
                Step 2 of 2 · Membership policy accepted
              </p>
              <h1 id="auth-title">
                {mode === 'register' ? 'Join YOUNGO' : mode === 'forgot' ? 'Reset password' : 'Sign in to YOUNGO Hub'}
              </h1>
              <p className="meta" style={{ marginTop: 6, maxWidth: 580 }}>
                {mode === 'register'
                  ? 'Register as an individual or as an organisation (UNFCCC-admitted or not). Then unlock YOUNGO Hub.'
                  : mode === 'forgot'
                    ? 'Enter your account email. We’ll issue a one-time reset link (valid 1 hour).'
                    : 'Welcome back. Sign in with the email you used to register.'}
              </p>
            </div>
          </div>
          {mode !== 'forgot' && (
            <div className="authTabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`authTab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => { setMode('register'); setError(null); setFields({}); setForgotMsg(null) }}
              >
                Join YOUNGO
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'signin'}
                className={`authTab ${mode === 'signin' ? 'active' : ''}`}
                onClick={() => { setMode('signin'); setError(null); setFields({}); setForgotMsg(null) }}
              >
                Sign in
              </button>
            </div>
          )}
        </header>

        <div className="mandateBody authBody">
          {mode === 'forgot' ? (
            <form className="authForm card" onSubmit={submitForgot} noValidate>
              <label className="field">
                <span>Email *</span>
                <input className="input" type="email" autoComplete="email" value={login.email} onChange={setLog('email')} />
                <FieldError msg={fields.email} />
              </label>
              <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={login.website} onChange={setLog('website')} />
              {error && <p className="meta" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
              {forgotMsg && <p className="meta" style={{ color: 'var(--accent)' }} role="status">{forgotMsg}</p>}
              <p className="metaMuted">
                Until email delivery is connected, reset links appear in Railway deploy/runtime logs for operators. Admins can also issue links from Admin.
              </p>
              <div className="detailActions">
                <Button type="button" variant="ghost" onClick={() => { setMode('signin'); setForgotMsg(null) }}>Back to sign in</Button>
                <Button type="submit" variant="primary" glow disabled={status === 'submitting'}>
                  {status === 'submitting' ? 'Sending…' : 'Send reset link'}
                </Button>
              </div>
            </form>
          ) : mode === 'signin' ? (
            <form className="authForm card" onSubmit={submitLogin} noValidate>
              <label className="field">
                <span>Email *</span>
                <input className="input" type="email" autoComplete="email" value={login.email} onChange={setLog('email')} />
                <FieldError msg={fields.email} />
              </label>
              <label className="field">
                <span>Password *</span>
                <input className="input" type="password" autoComplete="current-password" value={login.password} onChange={setLog('password')} />
                <FieldError msg={fields.password} />
              </label>
              <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={login.website} onChange={setLog('website')} />
              {error && <p className="meta" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}
              <Button type="submit" variant="primary" glow disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Signing in…' : 'Sign in & open hub'}
              </Button>
              <button
                type="button"
                className="meta"
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                onClick={() => { setMode('forgot'); setError(null); setFields({}) }}
              >
                Forgot password?
              </button>
            </form>
          ) : (
            <form className="authForm" onSubmit={submitRegister} noValidate>
              {/* Path selector */}
              <section className="card authSection">
                <h2 className="authSectionTitle"><Users size={18} strokeWidth={1.75} aria-hidden /> Who is registering? *</h2>
                <div className="authChoiceGrid">
                  <label className={`authChoice ${form.entityType === 'individual' ? 'active' : ''}`}>
                    <input type="radio" name="entity" checked={form.entityType === 'individual'} onChange={() => setForm((f) => ({ ...f, entityType: 'individual' }))} />
                    <strong>Individual</strong>
                    <span className="meta">Child or young person joining YOUNGO personally.</span>
                  </label>
                  <label className={`authChoice ${form.entityType === 'organization' ? 'active' : ''}`}>
                    <input type="radio" name="entity" checked={form.entityType === 'organization'} onChange={() => setForm((f) => ({ ...f, entityType: 'organization' }))} />
                    <strong>Organisation / NGO</strong>
                    <span className="meta">Child- or youth-led NGO, movement, group, or network.</span>
                  </label>
                </div>
                <FieldError msg={fields.entityType} />
              </section>

              {isOrg ? (
                <>
                  {/* Org intro */}
                  <section className="card authSection authIntro">
                    <h2 className="authSectionTitle"><Building2 size={18} strokeWidth={1.75} aria-hidden /> Organisational registration</h2>
                    <p className="meta mandatePara">
                      YOUNGO is a mandated mechanism for child and youth engagement in the UNFCCC — a <strong>platform and network</strong>, not a single organisation. Admitted and non-admitted child- and/or youth-led NGOs, movements, groups, and networks are encouraged to engage, including in constituency decision-making. If two of your members are active in YOUNGO, you can engage in the YOUNGO Council (Membership Policy).
                    </p>
                    <p className="meta mandatePara">
                      Your members can also join as individuals — share the individual registration on this hub with them.
                    </p>
                    <ul className="authBullet meta">
                      <li>No membership fees.</li>
                      <li>After submit, Membership Team aims to reply within a few weeks with an intro pack and onboarding call.</li>
                    </ul>
                    <p className="metaMuted">
                      <a className="mandateExtLink" href="https://youngoclimate.org/" target="_blank" rel="noreferrer">youngoclimate.org</a>
                      {' · '}
                      <a className="mandateExtLink" href="mailto:youngomembership@gmail.com">youngomembership@gmail.com</a>
                    </p>
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle">Organisation basics</h2>
                    <label className="field">
                      <span>Email * <span className="metaMuted">(for this hub account &amp; Membership Team replies)</span></span>
                      <input className="input" type="email" autoComplete="email" value={form.email} onChange={setReg('email')} />
                      <FieldError msg={fields.email} />
                    </label>
                    <label className="field">
                      <span>Full legal name of the organisation *</span>
                      <input className="input" value={form.organizationName} onChange={setReg('organizationName')} />
                      <FieldError msg={fields.organizationName} />
                    </label>
                    <p className="meta" style={{ margin: '10px 0 8px' }}>Is this organisation an <strong>admitted observer NGO</strong> of the UNFCCC? *</p>
                    <div className="authChoiceGrid">
                      <label className={`authChoice ${form.isUnfcccAdmitted === 'yes' ? 'active' : ''}`}>
                        <input type="radio" name="admitted" checked={form.isUnfcccAdmitted === 'yes'} onChange={() => setForm((f) => ({ ...f, isUnfcccAdmitted: 'yes' }))} />
                        <strong>Yes — admitted</strong>
                        <span className="meta">UNFCCC observer NGO path (DCP + youth affiliation).</span>
                      </label>
                      <label className={`authChoice ${form.isUnfcccAdmitted === 'no' ? 'active' : ''}`}>
                        <input type="radio" name="admitted" checked={form.isUnfcccAdmitted === 'no'} onChange={() => setForm((f) => ({ ...f, isUnfcccAdmitted: 'no' }))} />
                        <strong>No — not admitted</strong>
                        <span className="meta">Groups, movements, networks, non-admitted NGOs.</span>
                      </label>
                    </div>
                    <FieldError msg={fields.isUnfcccAdmitted} />
                  </section>

                  {/* Hub password early so it's not buried */}
                  <section className="card authSection">
                    <h2 className="authSectionTitle"><KeyRound size={18} strokeWidth={1.75} aria-hidden /> YOUNGO Hub password</h2>
                    <div className="formRow">
                      <label className="field">
                        <span>Password * <span className="metaMuted">(min 10)</span></span>
                        <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={setReg('password')} />
                        <FieldError msg={fields.password} />
                      </label>
                      <label className="field">
                        <span>Confirm password *</span>
                        <input className="input" type="password" autoComplete="new-password" value={form.passwordConfirm} onChange={setReg('passwordConfirm')} />
                        <FieldError msg={fields.passwordConfirm} />
                      </label>
                    </div>
                  </section>

                  {admitted && (
                    <>
                      <section className="card authSection">
                        <h2 className="authSectionTitle">UNFCCC-admitted NGO</h2>
                        <p className="meta" style={{ marginBottom: 8 }}>Is your organisation affiliated with “youth” within the UNFCCC? *</p>
                        <div className="authChoiceGrid authChoiceGrid3">
                          {[
                            { value: 'primary', label: 'Yes — Primary' },
                            { value: 'secondary', label: 'Yes — Secondary' },
                            { value: 'no', label: 'No' },
                          ].map((opt) => (
                            <label key={opt.value} className={`authChoice ${form.youthAffiliation === opt.value ? 'active' : ''}`}>
                              <input type="radio" name="youthAff" checked={form.youthAffiliation === opt.value} onChange={() => setForm((f) => ({ ...f, youthAffiliation: opt.value }))} />
                              <strong>{opt.label}</strong>
                            </label>
                          ))}
                        </div>
                        <FieldError msg={fields.youthAffiliation} />
                        <label className="field" style={{ marginTop: 12 }}>
                          <span>Region where legally established (UN groupings) *</span>
                          <select className="input" value={form.region} onChange={setReg('region')}>
                            <option value="">Select…</option>
                            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          <FieldError msg={fields.region} />
                        </label>
                        <label className="field">
                          <span>Country where legally established *</span>
                          <input className="input" value={form.orgCountry} onChange={setReg('orgCountry')} />
                          <FieldError msg={fields.country} />
                        </label>
                        <label className="field">
                          <span>Regions and/or countries of operation</span>
                          <textarea className="input textarea" rows={2} value={form.orgOperateIn} onChange={setReg('orgOperateIn')} placeholder="Admin base, projects, where members come from…" />
                          <FieldError msg={fields.orgOperateIn} />
                        </label>
                        <div className="formRow">
                          <label className="field">
                            <span>Organisation website</span>
                            <input className="input" type="url" value={form.orgWebsite} onChange={setReg('orgWebsite')} placeholder="https://" />
                          </label>
                          <label className="field">
                            <span>Social media link(s)</span>
                            <input className="input" value={form.orgSocial} onChange={setReg('orgSocial')} />
                          </label>
                        </div>
                        <label className="field">
                          <span>Mission and activities <span className="metaMuted">(max 250 words · {missionWords}/250)</span></span>
                          <textarea className="input textarea" rows={4} value={form.orgMission} onChange={setReg('orgMission')} />
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
                            <input className="input" type="email" value={form.dcpEmail} onChange={setReg('dcpEmail')} />
                            <FieldError msg={fields.dcpEmail} />
                          </label>
                          <label className="field">
                            <span>DCP phone (+ country code) *</span>
                            <input className="input" type="tel" placeholder="+123 456 7890" value={form.dcpPhone} onChange={setReg('dcpPhone')} />
                            <FieldError msg={fields.dcpPhone} />
                          </label>
                        </div>
                      </section>

                      <section className="card authSection">
                        <h2 className="authSectionTitle">YOUNGO Contact Point <span className="metaMuted">(if DCP is over 35 / not eligible)</span></h2>
                        <p className="meta" style={{ marginBottom: 10 }}>
                          Facilitates communication with YOUNGO when the official UNFCCC DCP does not meet YOUNGO age criteria (no older than 35).
                        </p>
                        <label className="field">
                          <span>YOUNGO Contact Point full name</span>
                          <input className="input" value={form.ycpName} onChange={setReg('ycpName')} />
                          <FieldError msg={fields.ycpName} />
                        </label>
                        <div className="formRow">
                          <label className="field">
                            <span>YOUNGO CP email</span>
                            <input className="input" type="email" value={form.ycpEmail} onChange={setReg('ycpEmail')} />
                            <FieldError msg={fields.ycpEmail} />
                          </label>
                          <label className="field">
                            <span>YOUNGO CP phone</span>
                            <input className="input" type="tel" value={form.ycpPhone} onChange={setReg('ycpPhone')} />
                            <FieldError msg={fields.ycpPhone} />
                          </label>
                        </div>
                      </section>
                    </>
                  )}

                  {nonAdmitted && (
                    <section className="card authSection">
                      <h2 className="authSectionTitle">Non-admitted NGO / group / movement / network</h2>
                      <label className="field">
                        <span>Regions and/or countries of operation *</span>
                        <textarea className="input textarea" rows={3} value={form.orgOperateIn} onChange={setReg('orgOperateIn')} placeholder="Admin, projects, where members come from…" />
                        <FieldError msg={fields.orgOperateIn} />
                      </label>
                      <label className="field">
                        <span>Website / social media link(s)</span>
                        <input className="input" value={form.orgWebsite || form.orgSocial} onChange={(e) => setForm((f) => ({ ...f, orgWebsite: e.target.value, orgSocial: e.target.value }))} placeholder="https://" />
                      </label>
                      <label className="field">
                        <span>Mission and activities <span className="metaMuted">(max 250 words · {missionWords}/250)</span></span>
                        <textarea className="input textarea" rows={4} value={form.orgMission} onChange={setReg('orgMission')} />
                        <FieldError msg={fields.orgMission} />
                      </label>
                      <h3 style={{ marginTop: 12, fontSize: 14 }}>YOUNGO Contact Point *</h3>
                      <p className="meta" style={{ marginBottom: 8 }}>
                        Facilitates communication with YOUNGO and receives update emails.
                      </p>
                      <label className="field">
                        <span>Contact Point full name *</span>
                        <input className="input" value={form.ycpName} onChange={setReg('ycpName')} />
                        <FieldError msg={fields.ycpName} />
                      </label>
                      <div className="formRow">
                        <label className="field">
                          <span>Contact Point email *</span>
                          <input className="input" type="email" value={form.ycpEmail} onChange={setReg('ycpEmail')} />
                          <FieldError msg={fields.ycpEmail} />
                        </label>
                        <label className="field">
                          <span>Contact Point phone (+ country code) *</span>
                          <input className="input" type="tel" value={form.ycpPhone} onChange={setReg('ycpPhone')} />
                          <FieldError msg={fields.ycpPhone} />
                        </label>
                      </div>
                    </section>
                  )}

                  {(admitted || nonAdmitted) && (
                    <section className="card authSection">
                      <h2 className="authSectionTitle"><Shield size={18} strokeWidth={1.75} aria-hidden /> Policies *</h2>
                      <p className="meta mandatePara">
                        By submitting, you agree that data is stored under YOUNGO’s Data Protection Policy and processed by the Membership Team for registration, election eligibility, and member support.
                      </p>
                      <label className="authCheck">
                        <input type="checkbox" checked={form.acceptAllOrgPolicies} onChange={setReg('acceptAllOrgPolicies')} />
                        <span>
                          The organisation agrees to conduct itself consistently with YOUNGO’s Code of Conduct, Conflict of Interest Policy, Data Protection Policy, and YOUNGO Principles. *
                        </span>
                      </label>
                      <FieldError msg={fields.acceptAllOrgPolicies || fields.acceptCodeOfConduct || fields.acceptCoiPolicy} />
                    </section>
                  )}
                </>
              ) : (
                <>
                  {/* Individual intro + form (existing) */}
                  <section className="card authSection authIntro">
                    <h2 className="authSectionTitle"><Globe2 size={18} strokeWidth={1.75} aria-hidden /> Join YOUNGO — individual</h2>
                    <p className="meta mandatePara">
                      YOUNGO is the official children and youth constituency of the UNFCCC — a platform and network (not a single organisation). No membership fees. After submit, expect Membership Team contact within about 2 weeks plus onboarding.
                    </p>
                    <p className="metaMuted">
                      Help: <a className="mandateExtLink" href="mailto:youngomembership@gmail.com">youngomembership@gmail.com</a>
                    </p>
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle">How old are you? *</h2>
                    <div className="authChoiceGrid authChoiceGrid3">
                      {[
                        { value: 'under_18', label: 'Under 18' },
                        { value: '18_35', label: '18–35' },
                        { value: '35_plus', label: '35+' },
                      ].map((opt) => (
                        <label key={opt.value} className={`authChoice ${form.ageBand === opt.value ? 'active' : ''}`}>
                          <input type="radio" name="ageBand" checked={form.ageBand === opt.value} onChange={() => setForm((f) => ({ ...f, ageBand: opt.value }))} />
                          <strong>{opt.label}</strong>
                        </label>
                      ))}
                    </div>
                    <FieldError msg={fields.ageBand} />
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle">Your details</h2>
                    <div className="formRow">
                      <label className="field">
                        <span>First name *</span>
                        <input className="input" autoComplete="given-name" value={form.firstName} onChange={setReg('firstName')} />
                        <FieldError msg={fields.firstName} />
                      </label>
                      <label className="field">
                        <span>Last name *</span>
                        <input className="input" autoComplete="family-name" value={form.lastName} onChange={setReg('lastName')} />
                        <FieldError msg={fields.lastName} />
                      </label>
                    </div>
                    <label className="field">
                      <span>Email *</span>
                      <input className="input" type="email" autoComplete="email" value={form.email} onChange={setReg('email')} />
                      <FieldError msg={fields.email} />
                    </label>
                    <label className="field">
                      <span>Phone (+ country code) *</span>
                      <input className="input" type="tel" placeholder="+123 456 7890" value={form.phone} onChange={setReg('phone')} />
                      <FieldError msg={fields.phone} />
                    </label>
                    <div className="formRow">
                      <label className="field">
                        <span>Gender *</span>
                        <select className="input" value={form.gender} onChange={setReg('gender')}>
                          <option value="">Select…</option>
                          {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <FieldError msg={fields.gender} />
                      </label>
                      <label className="field">
                        <span>Date of birth *</span>
                        <input className="input" type="date" value={form.dateOfBirth} onChange={setReg('dateOfBirth')} />
                        <FieldError msg={fields.dateOfBirth} />
                      </label>
                    </div>
                    {form.gender === 'Other' && (
                      <label className="field">
                        <span>Please specify gender *</span>
                        <input className="input" value={form.genderOther} onChange={setReg('genderOther')} />
                        <FieldError msg={fields.genderOther} />
                      </label>
                    )}
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle"><KeyRound size={18} strokeWidth={1.75} aria-hidden /> YOUNGO Hub password</h2>
                    <div className="formRow">
                      <label className="field">
                        <span>Password * <span className="metaMuted">(min 10)</span></span>
                        <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={setReg('password')} />
                        <FieldError msg={fields.password} />
                      </label>
                      <label className="field">
                        <span>Confirm password *</span>
                        <input className="input" type="password" autoComplete="new-password" value={form.passwordConfirm} onChange={setReg('passwordConfirm')} />
                        <FieldError msg={fields.passwordConfirm} />
                      </label>
                    </div>
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle"><Heart size={18} strokeWidth={1.75} aria-hidden /> Background</h2>
                    <p className="meta" style={{ marginBottom: 8 }}>Do you identify as part of a minority group?</p>
                    <div className="authCheckGrid">
                      {MINORITY_OPTIONS.map((opt) => (
                        <label key={opt} className="authCheck">
                          <input type="checkbox" checked={form.minorityGroups.includes(opt)} onChange={() => toggleMinority(opt)} />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                    {form.minorityGroups.includes('Other') && (
                      <label className="field">
                        <span>Please specify *</span>
                        <input className="input" value={form.minorityOther} onChange={setReg('minorityOther')} />
                        <FieldError msg={fields.minorityOther} />
                      </label>
                    )}
                    <label className="field" style={{ marginTop: 12 }}>
                      <span>Region (UN classifications) *</span>
                      <select className="input" value={form.region} onChange={setReg('region')}>
                        <option value="">Select…</option>
                        {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <FieldError msg={fields.region} />
                    </label>
                    <div className="formRow">
                      <label className="field">
                        <span>Nationality *</span>
                        <input className="input" value={form.nationality} onChange={setReg('nationality')} />
                        <FieldError msg={fields.nationality} />
                      </label>
                      <label className="field">
                        <span>Country of residence *</span>
                        <input className="input" value={form.countryOfResidence} onChange={setReg('countryOfResidence')} />
                        <FieldError msg={fields.country} />
                      </label>
                    </div>
                    <label className="field">
                      <span>Why do you want to join YOUNGO?</span>
                      <textarea className="input textarea" rows={3} value={form.motivation} onChange={setReg('motivation')} />
                    </label>
                  </section>

                  {under18 && (
                    <section className="card authSection">
                      <h2 className="authSectionTitle">Guardian permission (under 18) *</h2>
                      <div className="formRow">
                        <label className="field">
                          <span>Guardian name *</span>
                          <input className="input" value={form.guardianName} onChange={setReg('guardianName')} />
                          <FieldError msg={fields.guardianName} />
                        </label>
                        <label className="field">
                          <span>Guardian email *</span>
                          <input className="input" type="email" value={form.guardianEmail} onChange={setReg('guardianEmail')} />
                          <FieldError msg={fields.guardianEmail} />
                        </label>
                      </div>
                      <label className="authCheck">
                        <input type="checkbox" checked={form.guardianConsent} onChange={setReg('guardianConsent')} />
                        <span>I confirm guardian permission has been obtained.</span>
                      </label>
                      <FieldError msg={fields.guardianConsent} />
                    </section>
                  )}

                  <section className="card authSection">
                    <h2 className="authSectionTitle">Working groups you’re interested in</h2>
                    <p className="meta" style={{ marginBottom: 8 }}>
                      Optional — you’ll still complete each WG’s workspace onboarding later to unlock channels.
                    </p>
                    <div className="authCheckGrid">
                      {WG_OPTIONS.map((w) => (
                        <label key={w.slug} className="authCheck">
                          <input type="checkbox" checked={form.wgInterests.includes(w.slug)} onChange={() => toggleWg(w.slug)} />
                          <span>{w.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle">Accredited NGO membership (statistics)</h2>
                    <p className="meta" style={{ marginBottom: 8 }}>Are you a member of an accredited NGO (which is a member of YOUNGO)? *</p>
                    <div className="authChoiceGrid">
                      <label className={`authChoice ${form.memberOfAccreditedNgo === 'yes' ? 'active' : ''}`}>
                        <input type="radio" name="ngoStat" checked={form.memberOfAccreditedNgo === 'yes'} onChange={() => setForm((f) => ({ ...f, memberOfAccreditedNgo: 'yes' }))} />
                        <strong>Yes</strong>
                      </label>
                      <label className={`authChoice ${form.memberOfAccreditedNgo === 'no' ? 'active' : ''}`}>
                        <input type="radio" name="ngoStat" checked={form.memberOfAccreditedNgo === 'no'} onChange={() => setForm((f) => ({ ...f, memberOfAccreditedNgo: 'no' }))} />
                        <strong>No</strong>
                      </label>
                    </div>
                    <FieldError msg={fields.memberOfAccreditedNgo} />
                  </section>

                  <section className="card authSection">
                    <h2 className="authSectionTitle"><Shield size={18} strokeWidth={1.75} aria-hidden /> Agreements *</h2>
                    <label className="authCheck">
                      <input type="checkbox" checked={form.acceptCodeOfConduct} onChange={setReg('acceptCodeOfConduct')} />
                      <span>I agree to respect the YOUNGO Code of Conduct. *</span>
                    </label>
                    <FieldError msg={fields.acceptCodeOfConduct} />
                    <label className="authCheck">
                      <input type="checkbox" checked={form.acceptDataProtection} onChange={setReg('acceptDataProtection')} />
                      <span>I agree to respect the YOUNGO Data Protection Policy. *</span>
                    </label>
                    <FieldError msg={fields.acceptDataProtection} />
                    <label className="authCheck">
                      <input type="checkbox" checked={form.acceptPrinciples} onChange={setReg('acceptPrinciples')} />
                      <span>I agree to respect the YOUNGO Principles. *</span>
                    </label>
                    <FieldError msg={fields.acceptPrinciples} />
                    <label className="authCheck">
                      <input type="checkbox" checked={form.acceptCoiPolicy} onChange={setReg('acceptCoiPolicy')} />
                      <span>I agree to respect the YOUNGO Conflict of Interest Policy. *</span>
                    </label>
                    <FieldError msg={fields.acceptCoiPolicy} />
                  </section>
                </>
              )}

              <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.hpWebsite} onChange={setReg('hpWebsite')} />

              {error && <p className="meta card cardTight" style={{ color: 'var(--danger)' }} role="alert">{error}</p>}

              <div className="authSubmitBar card cardTight">
                <p className="metaMuted" style={{ flex: 1 }}>
                  {isOrg
                    ? 'Submits organisational registration and creates a hub account for the contact on this form.'
                    : 'Submits individual registration and creates your YOUNGO Hub account.'}
                </p>
                <Button
                  type="submit"
                  variant="primary"
                  glow
                  disabled={
                    status === 'submitting'
                    || form.ageBand === '35_plus'
                    || (isOrg && !form.isUnfcccAdmitted)
                  }
                >
                  <Check size={18} strokeWidth={1.75} aria-hidden />
                  {status === 'submitting' ? 'Submitting…' : 'Submit & open hub'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
