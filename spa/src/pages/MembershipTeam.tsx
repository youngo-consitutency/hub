interface ResponseFieldProps {
  label?: string
  children?: import('react').ReactNode
}

interface ResponseGroupProps {
  title?: string
  children?: import('react').ReactNode
}

interface SocialLinksProps {
  links?: AnyValue
}

interface ApplicationResponsesProps {
  item?: AnyValue
}

interface AppealPanelProps {
  item?: AnyValue
  busy?: boolean
  onReview?: AnyValue
}

import type { AnyValue, Doc } from '../lib/types'
import { Children, useState } from 'react'
import { useContentOptionLabels } from '../lib/documents'
import { SidePanel } from '../components/SidePanel.tsx'
import { PageSectionNav } from '../components/PageSectionNav'
import { apiPatch, apiPost, useApi } from '../lib/api'
import { Async, Button, Empty, ErrorCard, FilterPill, PageHeader, Section } from '../components/ui'
import { SearchableSelect } from '../components/FormControls'
import { MemberAvatar } from '../components/MemberAvatar'
import { DestinationIcon } from '../components/DestinationLink'
import { useWorkingGroups } from '../lib/workingGroups'
import {
  TbClipboardCheck as ClipboardCheck,
  TbClock as Clock3,
  TbStack3 as Layers3,
  TbRefresh as RefreshCw,
  TbSearch as Search,
  TbShieldCheck as ShieldCheck,
  TbUserCheck as UserCheck,
  TbUserX as UserX,
  TbScale as Scale,
} from 'react-icons/tb'

const STATUS_LABELS = {
  registered: 'Registered',
  course_passed: 'Course passed',
  awaiting_onboarding: 'Awaiting onboarding',
  active: 'Active member',
  renewal_due: 'Renewal due',
  expired: 'Expired',
  terminated: 'Terminated',
  rejected: 'Rejected',
}

const IDENTITY_LABELS = {
  passport: 'Passport',
  national_id: 'National ID / residence card',
  organisational_letter: 'Organisation letterhead',
  other: 'Other identity proof',
}

const AGE_LABELS = {
  under_18: 'Under 18',
  '18_35': '18–35',
  '35_plus': '35+',
}

const ENTITY_LABELS = {
  individual: 'Individual',
  organization: 'Organisation',
}

const TRACK_LABELS = {
  network: 'Network',
  constituency_work: 'Constituency work',
}

const YOUTH_AFFILIATION_LABELS = {
  primary: 'Yes — Primary',
  secondary: 'Yes — Secondary',
  no: 'No',
}

function yesNo(value: AnyValue) {
  if (value === true || value === 'yes') return 'Yes'
  if (value === false || value === 'no') return 'No'
  return null
}

function formatDateOnly(value: AnyValue) {
  if (!value) return null
  const text = String(value)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (!match) return text
  const date = new Date(`${match[1]}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return match[1]
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function ResponseField({ label, children }: ResponseFieldProps) {
  if (children == null || children === '') return null
  if (Array.isArray(children) && !children.length) return null
  return (
    <div className="membershipResponse">
      <dt>{label}</dt>
      <dd>{Array.isArray(children) ? children.join(', ') : children}</dd>
    </div>
  )
}

function ResponseGroup({ title, children }: ResponseGroupProps) {
  const items = Children.toArray(children)
  if (!items.length) return null
  return (
    <div className="membershipResponseGroup">
      <h3 className="membershipResponseGroupTitle">{title}</h3>
      {items}
    </div>
  )
}

function applicationSearchText(item: Doc) {
  const app = item.application || {}
  return [
    item.name,
    item.email,
    item.country,
    item.organizationName,
    item.firstName,
    item.lastName,
    app.motivation,
    app.gender,
    app.genderOther,
    app.nationality,
    app.region,
    app.phone,
    app.dateOfBirth,
    app.countryOfResidence,
    app.minorityOther,
    ...(app.minorityGroups || []),
    app.orgMission,
    app.orgOperateIn,
    app.orgWebsite,
    app.orgSocial,
    app.dcpName,
    app.dcpEmail,
    app.dcpPhone,
    app.ycpName,
    app.ycpEmail,
    app.ycpPhone,
    app.guardianName,
    app.guardianEmail,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function SocialLinks({ links }: SocialLinksProps) {
  if (!links?.length) return null
  return (
    <div className="membershipSocialLinks">
      {links.map((link: AnyValue) => (
        <a
          key={link.href}
          href={link.href}
          className="membershipSocialLink"
          target="_blank"
          rel="noopener noreferrer"
        >
          <DestinationIcon url={link.href} size={15} />
          {link.host}
        </a>
      ))}
    </div>
  )
}

function ApplicationResponses({ item }: ApplicationResponsesProps) {
  const wg = useWorkingGroups()
  const app = item.application || {}
  const groups = (item.wgInterests || []).map(wg.label)
  const isOrg = (app.entityType || item.entityType) === 'organization'
  const gender =
    app.gender === 'Other' && app.genderOther ? `Other — ${app.genderOther}` : app.gender
  const minorityGroups = [
    ...(app.minorityGroups || []),
    app.minorityOther ? `Other — ${app.minorityOther}` : null,
  ].filter(Boolean)
  return (
    <details className="membershipResponses" open>
      <summary>Registration answers</summary>
      <dl className="membershipResponseList">
        <ResponseGroup title="Account">
          <ResponseField label="Account type">
            {(ENTITY_LABELS as AnyValue)[app.entityType || item.entityType] ||
              app.entityType ||
              item.entityType}
          </ResponseField>
          <ResponseField label="Membership track">
            {(TRACK_LABELS as AnyValue)[app.membershipTrack || item.membershipTrack] ||
              app.membershipTrack ||
              item.membershipTrack}
          </ResponseField>
          <ResponseField label="First name">{app.firstName || item.firstName}</ResponseField>
          <ResponseField label="Last name">{app.lastName || item.lastName}</ResponseField>
          <ResponseField label="Email">{app.email || item.email}</ResponseField>
        </ResponseGroup>
        {!isOrg && (
          <ResponseGroup title="Your details">
            <ResponseField label="Phone">{app.phone}</ResponseField>
            <ResponseField label="Gender">{gender}</ResponseField>
            <ResponseField label="Date of birth">{formatDateOnly(app.dateOfBirth)}</ResponseField>
            <ResponseField label="Age band">
              {(AGE_LABELS as AnyValue)[app.ageBand] || app.ageBand}
            </ResponseField>
          </ResponseGroup>
        )}
        {!isOrg && (
          <ResponseGroup title="Background">
            <ResponseField label="Identifies as part of a minority group">
              {yesNo(app.minorityIdentity)}
            </ResponseField>
            <ResponseField label="Minority groups">{minorityGroups}</ResponseField>
            <ResponseField label="Region (UN classifications)">{app.region}</ResponseField>
            <ResponseField label="Nationality">{app.nationality}</ResponseField>
            <ResponseField label="Country of residence">
              {app.countryOfResidence || item.country}
            </ResponseField>
            <ResponseField label="Why they want to join YOUNGO">{app.motivation}</ResponseField>
          </ResponseGroup>
        )}
        {app.under18 && (
          <ResponseGroup title="Guardian permission (under 18)">
            <ResponseField label="Guardian name">{app.guardianName}</ResponseField>
            <ResponseField label="Guardian email">{app.guardianEmail}</ResponseField>
            <ResponseField label="Guardian permission confirmed">
              {yesNo(app.guardianConsent)}
            </ResponseField>
          </ResponseGroup>
        )}
        {isOrg && (
          <ResponseGroup title="Organisation">
            <ResponseField label="Legal name">
              {app.organizationName || item.organizationName}
            </ResponseField>
            <ResponseField label="Organisation type">{app.organizationType}</ResponseField>
            <ResponseField label="UNFCCC admitted observer NGO">
              {yesNo(app.isUnfcccAdmitted)}
            </ResponseField>
            <ResponseField label="Youth affiliation within the UNFCCC">
              {(YOUTH_AFFILIATION_LABELS as AnyValue)[app.youthAffiliation] || app.youthAffiliation}
            </ResponseField>
            <ResponseField label="Region where legally established">{app.region}</ResponseField>
            <ResponseField label="Country where legally established">
              {app.countryOfResidence || item.country}
            </ResponseField>
            <ResponseField label="Regions and/or countries of operation">
              {app.orgOperateIn}
            </ResponseField>
            <ResponseField label="Website">{app.orgWebsite}</ResponseField>
            <ResponseField label="Social media">{app.orgSocial}</ResponseField>
            <ResponseField label="Mission and activities">{app.orgMission}</ResponseField>
          </ResponseGroup>
        )}
        {(app.dcpName || app.dcpEmail || app.dcpPhone) && (
          <ResponseGroup title="UNFCCC Designated Contact Point">
            <ResponseField label="DCP full name">{app.dcpName}</ResponseField>
            <ResponseField label="DCP email">{app.dcpEmail}</ResponseField>
            <ResponseField label="DCP phone">{app.dcpPhone}</ResponseField>
          </ResponseGroup>
        )}
        {(app.ycpName || app.ycpEmail || app.ycpPhone) && (
          <ResponseGroup title="YOUNGO Contact Point">
            <ResponseField label="Contact Point full name">{app.ycpName}</ResponseField>
            <ResponseField label="Contact Point email">{app.ycpEmail}</ResponseField>
            <ResponseField label="Contact Point phone">{app.ycpPhone}</ResponseField>
          </ResponseGroup>
        )}
        <ResponseGroup title="Working groups">
          <ResponseField label="Working group interests">{groups}</ResponseField>
        </ResponseGroup>
        {!isOrg && (
          <ResponseGroup title="Accredited NGO membership">
            <ResponseField label="Member of an accredited NGO that is a member of YOUNGO">
              {yesNo(app.memberOfAccreditedNgo)}
            </ResponseField>
          </ResponseGroup>
        )}
        <ResponseGroup title="Agreements">
          <ResponseField label="Code of Conduct">{yesNo(app.acceptCodeOfConduct)}</ResponseField>
          <ResponseField label="Data Protection Policy">
            {yesNo(app.acceptDataProtection)}
          </ResponseField>
          <ResponseField label="YOUNGO Principles">{yesNo(app.acceptPrinciples)}</ResponseField>
          <ResponseField label="Conflict of Interest Policy">
            {yesNo(app.acceptCoiPolicy)}
          </ResponseField>
          <ResponseField label="Membership Policy version">
            {app.membershipPolicyVersion}
          </ResponseField>
          <ResponseField label="Privacy notice accepted">{yesNo(app.privacyConsent)}</ResponseField>
          <ResponseField label="Privacy notice version">{app.privacyNoticeVersion}</ResponseField>
          <ResponseField label="Conflict of interest declared">
            {yesNo(app.coiDeclared)}
          </ResponseField>
          <ResponseField label="Conflict of interest details">{app.coiDetails}</ResponseField>
        </ResponseGroup>
      </dl>
    </details>
  )
}

function AppealPanel({ item, busy, onReview }: AppealPanelProps) {
  const appeal = item.appeal
  if (!appeal) return null
  const open = appeal.status === 'submitted'
  const proofHref = `/api/member/team/membership/appeals/${appeal.id}/proof`
  const image = String(appeal.proofContentType || '').startsWith('image/')
  return (
    <div className="membershipAppealPanel">
      <div className="rowGap" style={{ flexWrap: 'wrap' }}>
        <span
          className={`chip ${open ? 'chip-warn' : appeal.status === 'granted' ? 'chip-info' : 'chip-danger'}`}
        >
          Appeal {appeal.status}
        </span>
        <span className="chip chip-neutral">
          {(IDENTITY_LABELS as AnyValue)[appeal.identityKind] || appeal.identityKind}
        </span>
      </div>
      {appeal.statement && <p className="meta">{appeal.statement}</p>}
      {image ? (
        <img
          className="membershipProofImage"
          src={proofHref}
          alt="Identity proof submitted with this appeal"
        />
      ) : (
        <a
          className="membershipSocialLink"
          href={proofHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open identity document ({appeal.proofContentType})
        </a>
      )}
      {open && (
        <div className="rowGap" style={{ flexWrap: 'wrap' }}>
          <Button sm variant="primary" disabled={busy} onClick={() => onReview(item, 'grant')}>
            Grant appeal
          </Button>
          <Button sm variant="danger" disabled={busy} onClick={() => onReview(item, 'uphold')}>
            Uphold rejection
          </Button>
        </div>
      )}
      {appeal.reviewerNote && <p className="metaMuted">Review note: {appeal.reviewerNote}</p>}
    </div>
  )
}

export function MembershipTeam() {
  const { teamLabels } = useContentOptionLabels()
  const [ending, setEnding] = useState<AnyValue>(null)
  const [reason, setReason] = useState('')
  const query = useApi('/member/team/membership/overview')
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<AnyValue>(null)
  const [actionError, setActionError] = useState<AnyValue>(null)

  const setStatus = async (id: AnyValue, status: AnyValue, confirmed = false) => {
    if (status === 'terminated' && !confirmed) {
      setReason('')
      setActionError(null)
      setEnding(id)
      return
    }
    setBusy(id)
    try {
      setActionError(null)
      await apiPatch(`/member/team/membership/accounts/${id}/status`, {
        status,
        reason,
      })
      setEnding(null)
      query.retry()
    } catch (error) {
      setActionError((error as AnyValue).message)
    } finally {
      setBusy(null)
    }
  }

  const reviewAppeal = async (item: Doc, decision: Doc) => {
    setBusy(item.id)
    try {
      setActionError(null)
      await apiPost(`/member/team/membership/appeals/${item.appeal.id}/review`, { decision })
      query.retry()
    } catch (error) {
      setActionError((error as AnyValue).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        icon={UserCheck}
        title="GCT · Membership"
        description="Read the full registration form, then activate, renew, or end membership."
      >
        <PageSectionNav section="membership" />
      </PageHeader>
      <Async query={query} skeletons={5}>
        {(data: Doc) => {
          const active = data.items.filter((item: Doc) => item.membershipStatus === 'active')
          const pending = data.items.filter((item: Doc) => item.membershipStatus !== 'active')
          const appeals = data.items.filter((item: Doc) => item.appeal?.status === 'submitted')
          const rejected = data.items.filter((item: Doc) => item.membershipStatus === 'rejected')
          const shown = data.items.filter((item: Doc) => {
            const stateMatch =
              filter === 'all' ||
              (filter === 'pending'
                ? item.membershipStatus !== 'active'
                : filter === 'appeals'
                  ? item.appeal?.status === 'submitted'
                  : filter === 'rejected'
                    ? item.membershipStatus === 'rejected'
                    : item.membershipStatus === 'active')
            return stateMatch && applicationSearchText(item).includes(search.toLowerCase())
          })
          return (
            <>
              <div className="metricGrid">
                <div className="metricCard">
                  <Clock3 size={18} aria-hidden />
                  <strong>{pending.length}</strong>
                  <span>need lifecycle action</span>
                </div>
                <div className="metricCard">
                  <UserCheck size={18} aria-hidden />
                  <strong>{active.length}</strong>
                  <span>active members</span>
                </div>
                <div className="metricCard">
                  <RefreshCw size={18} aria-hidden />
                  <strong>
                    {
                      data.items.filter((item: Doc) => item.membershipStatus === 'renewal_due')
                        .length
                    }
                  </strong>
                  <span>renewals due</span>
                </div>
              </div>
              <Section label="Application queue">
                {actionError && !ending && <ErrorCard message={actionError} />}
                <div className="queueToolbar">
                  <div className="pillRow" aria-label="Filter applications">
                    {[
                      { key: 'pending', label: 'Pending', icon: Clock3 },
                      {
                        key: 'appeals',
                        label: `Appeals (${appeals.length})`,
                        icon: Scale,
                      },
                      {
                        key: 'rejected',
                        label: `Rejected (${rejected.length})`,
                        icon: UserX,
                      },
                      { key: 'verified', label: 'Active', icon: UserCheck },
                      { key: 'all', label: 'All', icon: Layers3 },
                    ].map((item) => (
                      <FilterPill
                        key={item.key}
                        active={filter === item.key}
                        icon={item.icon}
                        onClick={() => setFilter(item.key)}
                      >
                        {item.label}
                      </FilterPill>
                    ))}
                  </div>
                  <label className="queueSearch">
                    <Search size={16} aria-hidden />
                    <span className="srOnly">Search members</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search members"
                    />
                  </label>
                </div>
                {!shown.length ? (
                  <Empty icon={ClipboardCheck} title="No applications in this view" />
                ) : (
                  <div className="stackSm">
                    {shown.map((item: Doc) => (
                      <div key={item.id} className="card cardTight membershipQueueCard">
                        <div className="queueRow">
                          <div className="queueIdentity membershipQueueIdentity">
                            <MemberAvatar
                              person={{
                                name: item.name,
                                displayName: item.profile?.displayName,
                                photoUrl: item.profile?.photoUrl,
                              }}
                              size="sm"
                            />
                            <div>
                              <strong>{item.name}</strong>
                              <p className="meta">
                                {item.email} · {item.country || 'Country not set'}
                                {item.organizationName ? ` · ${item.organizationName}` : ''}
                              </p>
                              <SocialLinks links={item.application?.links} />
                              <div className="rowGap" style={{ marginTop: 6 }}>
                                <span
                                  className={`taskState ${item.membershipStatus === 'active' ? 'taskState-complete' : 'taskState-review'}`}
                                >
                                  {(STATUS_LABELS as AnyValue)[item.membershipStatus] ||
                                    item.membershipStatus}
                                </span>
                                <span className="chip chip-neutral">
                                  {(ENTITY_LABELS as AnyValue)[item.entityType] || item.entityType}
                                </span>
                                <span className="chip chip-neutral">
                                  Hub: {item.hubAccessStatus}
                                </span>
                                {item.teamRoles?.map((role: AnyValue) => (
                                  <span key={role} className="chip chip-neutral">
                                    {teamLabels[role] || role.replaceAll('_', ' ')}
                                  </span>
                                ))}
                                <span className="chip chip-neutral">
                                  Directory: {item.profile?.directoryVisibility || 'private'}
                                </span>
                                {item.profile?.hasPhoto && (
                                  <span className="chip chip-neutral">Photo</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="membershipQueueActions">
                            <SearchableSelect
                              label="Membership status"
                              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                                value,
                                label,
                              }))}
                              value={item.membershipStatus}
                              onChange={(status: AnyValue) => setStatus(item.id, status)}
                              disabled={busy === item.id}
                              className="queueSelect"
                              searchPlaceholder="Search statuses…"
                            />
                            {item.membershipStatus !== 'active' && (
                              <Button
                                sm
                                variant="primary"
                                disabled={busy === item.id}
                                onClick={() => setStatus(item.id, 'active')}
                              >
                                <ShieldCheck size={16} aria-hidden />
                                {busy === item.id ? 'Saving…' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </div>
                        <ApplicationResponses item={item} />
                        <AppealPanel item={item} busy={busy === item.id} onReview={reviewAppeal} />
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          )
        }}
      </Async>
      {ending && (
        <SidePanel title="End membership" onClose={() => setEnding(null)}>
          <p>Record the reason for ending this membership. This removes the member’s Hub access.</p>
          {actionError && <ErrorCard message={actionError} />}
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault()
              setStatus(ending, 'terminated', true)
            }}
          >
            <label className="field">
              <span>Decision and reason</span>
              <textarea
                className="input textarea"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={8}
              />
            </label>
            <Button type="submit" variant="primary" disabled={busy || reason.trim().length < 8}>
              Confirm end of membership
            </Button>
          </form>
        </SidePanel>
      )}
    </div>
  )
}
