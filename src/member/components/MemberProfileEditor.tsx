import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import type { Account } from '../lib/types'
import type { OwnProfile, OwnProfileResponse } from '../../shared/contracts'
import { useDocument } from '../lib/documents'
import { regionLabel } from '../lib/regions'
import { useEffect, useState } from 'react'
import { apiPatch, errorMessage, fieldErrors as apiFieldErrors, type ApiQuery } from '../lib/api'
import { Async, Button, ErrorCard } from './ui'
import { AvatarBuilder } from './AvatarBuilder'
import { MemberAvatar } from './MemberAvatar'
import { signOut } from '../lib/session'
import {
  TbRosetteDiscountCheck as BadgeCheck,
  TbLogout as LogOut,
  TbMail as Mail,
  TbUsers as Users,
} from 'react-icons/tb'

interface DetailProps {
  term?: string
  children?: ReactNode
}

interface MemberProfileEditorProps {
  query: ApiQuery<OwnProfileResponse>
  account?: Account | null
  roleLabel?: string
}

/** The editable fields; the tags are held as one comma-separated string while typing. */
interface ProfileForm {
  displayName: string
  headline: string
  bio: string
  pronouns: string
  expertiseTags: string
  directoryVisibility: string
  showCountry: boolean
  showOrganization: boolean
  showWorkingGroups: boolean
  showRoles: boolean
}

type VisibilityFlag = 'showCountry' | 'showOrganization' | 'showWorkingGroups' | 'showRoles'

const VISIBILITY_CHECKS: [VisibilityFlag, string][] = [
  ['showCountry', 'Show my country'],
  ['showOrganization', 'Show my organisation'],
  ['showWorkingGroups', 'Show my working groups'],
  ['showRoles', 'Show my Hub roles'],
]

function formFromProfile(profile: OwnProfile): ProfileForm {
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

function Detail({ term, children }: DetailProps) {
  if (!children) return null
  return (
    <div className="profileDetail">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function MemberProfileEditor({ query, account, roleLabel }: MemberProfileEditorProps) {
  const { doc: privacyNotice } = useDocument('privacy-notice')
  const privacyContactEmail = privacyNotice?.PRIVACY_META?.contactEmail

  const [form, setForm] = useState<ProfileForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const profile = query.data?.profile

  useEffect(() => {
    // seed once: a refetch (say, after saving the avatar) must not wipe typing
    if (profile) setForm((current) => current ?? formFromProfile(profile))
  }, [profile])

  const change = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const target = event.target
    const next =
      target instanceof HTMLInputElement && target.type === 'checkbox'
        ? target.checked
        : target.value
    setForm((current) => (current ? { ...current, [target.name]: next } : current))
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
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
      setError(errorMessage(caught))
      setFieldErrors(apiFieldErrors(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card memberProfileEditor" aria-labelledby="crm-profile-title">
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
                      <a className="profileEmail" href={`mailto:${account.email}`}>
                        <Mail size={15} aria-hidden />
                        {account.email}
                      </a>
                    )}
                    {!account?.isVerified && (
                      <span className="chip chip-warn profileStatus">Onboarding in progress</span>
                    )}
                  </div>
                </div>
                <div className="memberProfileHeaderActions">
                  <AvatarBuilder
                    accountId={current.accountId}
                    saved={current.avatar}
                    onSaved={query.retry}
                  />
                  <Button sm variant="secondary" className="profileSignOut" onClick={signOut}>
                    <LogOut size={16} strokeWidth={1.75} aria-hidden />
                    Sign out
                  </Button>
                </div>
              </header>

              <div className="memberProfileOverview">
                <div>
                  <p className="pageEyebrow">Member directory</p>
                  <h3>Profile information</h3>
                  <p className="meta">
                    Your Hub roles and group connections update automatically. You control the
                    profile fields shared with verified members.
                  </p>
                </div>
                <div className="profileMembershipBlock">
                  <p className="pageEyebrow">Membership</p>
                  <dl className="profileDetails">
                    <Detail term="Role">{roleLabel}</Detail>
                    <Detail term="Country">{account?.country}</Detail>
                    <Detail term="Region">{regionLabel(account?.region)}</Detail>
                    <Detail term="Course score">
                      {account?.courseScore == null
                        ? null
                        : `${account.courseScore} correct answers`}
                    </Detail>
                  </dl>
                  <p className="metaMuted profileHelp">
                    Need a correction?{' '}
                    <a className="inlineLink" href={`mailto:${privacyContactEmail}`}>
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
                    <small className="fieldError">{fieldErrors.displayName}</small>
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
                    Up to 8 tags, separated by commas. Tags become directory filters.
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
                  {VISIBILITY_CHECKS.map(([name, label]) => (
                    <label key={name} className="authCheck">
                      <input type="checkbox" name={name} checked={form[name]} onChange={change} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <footer className="memberProfileEditorFooter">
                <div className="memberProfileEditorFooterCopy">
                  <p className="metaMuted">
                    Email, phone, age, minority and guardian data are never shown in the member
                    directory.
                  </p>
                </div>
                <Button type="submit" variant="primary" disabled={saving}>
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
