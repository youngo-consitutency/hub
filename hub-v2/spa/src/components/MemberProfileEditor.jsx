import { regionLabel } from '../lib/regions.js'
import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiPatch, apiPutFile } from '../lib/api.js'
import { Async, Button, ErrorCard } from './ui.jsx'
import { MemberAvatar } from './MemberAvatar.jsx'
import { signOut } from '../lib/logout.js'
import {
  TbRosetteDiscountCheck as BadgeCheck,
  TbCamera as Camera,
  TbLogout as LogOut,
  TbMail as Mail,
  TbPhotoEdit as PhotoEdit,
  TbTrash as Trash,
  TbUsers as Users,
} from 'react-icons/tb'

const MAX_PHOTO_BYTES = 768 * 1024

function formFromProfile(profile) {
  return {
    displayName: profile.displayName || '',
    headline: profile.headline || '',
    bio: profile.bio || '',
    pronouns: profile.pronouns || '',
    expertiseTags: (profile.expertiseTags || []).join(', '),
    directoryVisibility: profile.directoryVisibility || 'private',
    showCountry: Boolean(profile.showCountry),
    showOrganization: Boolean(profile.showOrganization),
    showWorkingGroups: profile.showWorkingGroups !== false,
    showRoles: profile.showRoles !== false,
  }
}

function Detail({ term, children }) {
  if (!children) return null
  return (
    <div className="profileDetail">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function MemberProfileEditor({ query, account, roleLabel }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const fileRef = useRef(null)
  const profile = query.data?.profile

  useEffect(() => {
    if (profile) setForm(formFromProfile(profile))
  }, [profile])

  const change = (event) => {
    const { name, type, checked, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    setFieldErrors({})
    try {
      await apiPatch('/member/profile', {
        ...form,
        expertiseTags: form.expertiseTags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      setMessage('Profile saved.')
      query.retry()
    } catch (caught) {
      setError(caught.message)
      setFieldErrors(caught.fields || {})
    } finally {
      setSaving(false)
    }
  }

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError('Profile photos must be 768 KB or smaller.')
      return
    }
    setPhotoBusy(true)
    setError('')
    setMessage('')
    try {
      await apiPutFile('/member/profile/photo', file)
      setMessage('Profile photo updated.')
      query.retry()
    } catch (caught) {
      setError(caught.message)
    } finally {
      setPhotoBusy(false)
    }
  }

  const removePhoto = async () => {
    setPhotoBusy(true)
    setError('')
    setMessage('')
    try {
      await apiDelete('/member/profile/photo')
      setMessage('Profile photo removed.')
      query.retry()
    } catch (caught) {
      setError(caught.message)
    } finally {
      setPhotoBusy(false)
    }
  }

  return (
    <section
      className="card memberProfileEditor"
      aria-labelledby="crm-profile-title"
    >
      <Async query={query} skeletons={2}>
        {(data) => {
          const current = data.profile
          if (!form) return null
          return (
            <form onSubmit={save}>
              <header className="memberProfileEditorHeader">
                <div className="profileIdentity">
                  <MemberAvatar
                    person={{
                      ...current,
                      name: account?.name || account?.email,
                    }}
                    size="lg"
                  />
                  <div>
                    <p className="pageEyebrow">Your account</p>
                    <h2 id="crm-profile-title">
                      {account?.name || 'YOUNGO member'}
                      {account?.isVerified && (
                        <BadgeCheck
                          className="profileVerified"
                          size={20}
                          strokeWidth={2}
                          aria-label="Verified member"
                        />
                      )}
                    </h2>
                    {account?.email && (
                      <a
                        className="profileEmail"
                        href={`mailto:${account.email}`}
                      >
                        <Mail size={15} aria-hidden />
                        {account.email}
                      </a>
                    )}
                    {!account?.isVerified && (
                      <span className="chip chip-warn profileStatus">
                        Onboarding in progress
                      </span>
                    )}
                  </div>
                </div>
                <div className="memberProfileHeaderActions">
                  <div className="profilePhotoActions">
                    <input
                      ref={fileRef}
                      className="srOnly"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={uploadPhoto}
                    />
                    <Button
                      sm
                      disabled={photoBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {current.hasPhoto ? (
                        <PhotoEdit size={16} aria-hidden />
                      ) : (
                        <Camera size={16} aria-hidden />
                      )}
                      {current.hasPhoto ? 'Change photo' : 'Add photo'}
                    </Button>
                    {current.hasPhoto && (
                      <Button
                        sm
                        variant="ghost"
                        disabled={photoBusy}
                        onClick={removePhoto}
                      >
                        <Trash size={16} aria-hidden />
                        Remove
                      </Button>
                    )}
                    <Button
                      sm
                      variant="secondary"
                      className="profileSignOut"
                      onClick={signOut}
                    >
                      <LogOut size={16} strokeWidth={1.75} aria-hidden />
                      Sign out
                    </Button>
                    <small>JPEG, PNG or WebP · max 768 KB</small>
                  </div>
                </div>
              </header>

              <div className="memberProfileOverview">
                <div>
                  <p className="pageEyebrow">Member directory</p>
                  <h3>Profile information</h3>
                  <p className="meta">
                    Your Hub roles and group connections update automatically.
                    You control the profile fields shared with verified members.
                  </p>
                </div>
                <div className="profileMembershipBlock">
                  <p className="pageEyebrow">Membership</p>
                  <dl className="profileDetails">
                    <Detail term="Role">{roleLabel}</Detail>
                    <Detail term="Country">{account?.country}</Detail>
                    <Detail term="Region">
                      {regionLabel(account?.region)}
                    </Detail>
                    <Detail term="Course score">
                      {account?.courseScore == null
                        ? null
                        : `${account.courseScore} correct answers`}
                    </Detail>
                  </dl>
                  <p className="metaMuted profileHelp">
                    Need a correction?{' '}
                    <a
                      className="inlineLink"
                      href="mailto:membership@youngoclimate.org"
                    >
                      Contact the Membership Team
                    </a>
                    .
                  </p>
                </div>
              </div>

              {error && <ErrorCard message={error} />}
              <p className="srOnly" aria-live="polite">
                {message}
              </p>
              {message && <p className="profileSaveMessage">{message}</p>}

              <div className="memberProfileFields">
                <label className="field">
                  <span className="fieldLabel">Display name</span>
                  <input
                    className="input"
                    name="displayName"
                    value={form.displayName}
                    onChange={change}
                    maxLength={100}
                    aria-invalid={Boolean(fieldErrors.displayName)}
                  />
                  {fieldErrors.displayName && (
                    <small className="fieldError">
                      {fieldErrors.displayName}
                    </small>
                  )}
                </label>
                <label className="field">
                  <span className="fieldLabel">Pronouns</span>
                  <input
                    className="input"
                    name="pronouns"
                    value={form.pronouns}
                    onChange={change}
                    maxLength={40}
                    placeholder="Optional"
                  />
                </label>
                <label className="field memberProfileWide">
                  <span className="fieldLabel">Headline</span>
                  <input
                    className="input"
                    name="headline"
                    value={form.headline}
                    onChange={change}
                    maxLength={140}
                    placeholder="What you work on or can help with"
                  />
                </label>
                <label className="field memberProfileWide">
                  <span className="fieldLabel">About</span>
                  <textarea
                    className="input textarea"
                    name="bio"
                    value={form.bio}
                    onChange={change}
                    maxLength={1200}
                    rows={4}
                    placeholder="A short introduction for other YOUNGO members"
                  />
                </label>
                <label className="field memberProfileWide">
                  <span className="fieldLabel">Skills and topic tags</span>
                  <input
                    className="input"
                    name="expertiseTags"
                    value={form.expertiseTags}
                    onChange={change}
                    placeholder="Climate finance, facilitation, policy"
                    aria-invalid={Boolean(fieldErrors.expertiseTags)}
                  />
                  <small className="fieldHint">
                    Up to 8 tags, separated by commas. Tags become directory
                    filters.
                  </small>
                </label>
              </div>

              <fieldset className="profileVisibility">
                <legend>
                  <Users size={17} aria-hidden /> Directory visibility
                </legend>
                <label className="field">
                  <span className="fieldLabel">Who can find this profile?</span>
                  <select
                    className="input"
                    name="directoryVisibility"
                    value={form.directoryVisibility}
                    onChange={change}
                  >
                    <option value="private">Only me and Membership Team</option>
                    <option value="members">Verified YOUNGO members</option>
                  </select>
                </label>
                <div className="profileVisibilityChecks">
                  {[
                    ['showCountry', 'Show my country'],
                    ['showOrganization', 'Show my organisation'],
                    ['showWorkingGroups', 'Show my working groups'],
                    ['showRoles', 'Show my Hub roles'],
                  ].map(([name, label]) => (
                    <label key={name} className="authCheck">
                      <input
                        type="checkbox"
                        name={name}
                        checked={form[name]}
                        onChange={change}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <footer className="memberProfileEditorFooter">
                <div className="memberProfileEditorFooterCopy">
                  <p className="metaMuted">
                    Email, phone, age, minority and guardian data are never
                    shown in the member directory.
                  </p>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={saving || photoBusy}
                >
                  {saving ? 'Saving…' : 'Save profile'}
                </Button>
              </footer>
            </form>
          )
        }}
      </Async>
    </section>
  )
}
