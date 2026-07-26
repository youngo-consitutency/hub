import { useAccount } from '../lib/accountContext.jsx'
import { A, PageHeader, Section } from '../components/ui.jsx'
import { OrgAffiliation } from '../components/OrgAffiliation.jsx'
import { MyFeedback } from '../components/MyFeedback.jsx'
import { workingGroupLabel } from '../../shared/workingGroups.js'
import {
  BookOpenCheck,
  GraduationCap,
  Library,
  LockKeyhole,
  Mail,
  Users,
} from 'lucide-react'

const ROLE_LABELS = {
  admin: 'Administrator',
  focal_point: 'Focal Point',
  ngo_admin: 'Organisation administrator',
  member: 'Member',
}

const TEAM_LABELS = {
  membership_team: 'Membership Team',
  gys_policy_team: 'Global Youth Statement Policy Team',
  content_editor: 'Content editor',
  content_publisher: 'Content publisher',
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

export function Profile() {
  const { account } = useAccount()
  const access = account?.access || {}
  const teamRoles = access.teamRoles || account?.teamRoles || []
  const wgAssignments = access.wgAssignments || []
  const interests = account?.wgInterests || []

  return (
    <div>
      <PageHeader
        eyebrow="Your account"
        title="Profile"
        description="Your membership details, roles, and useful starting points."
      />

      <div className="profileGrid">
        <section
          className="card profileSummary"
          aria-labelledby="profile-account-title"
        >
          <div className="profileAvatar" aria-hidden>
            {(account?.name || account?.email || '?')
              .trim()
              .slice(0, 1)
              .toUpperCase()}
          </div>
          <div>
            <h2 id="profile-account-title">
              {account?.name || 'YOUNGO member'}
            </h2>
            <a className="profileEmail" href={`mailto:${account?.email}`}>
              <Mail size={15} aria-hidden />
              {account?.email}
            </a>
            <span
              className={`chip ${account?.isVerified ? 'chip-accent' : 'chip-warn'} profileStatus`}
            >
              {account?.isVerified
                ? 'Verified member'
                : 'Onboarding in progress'}
            </span>
          </div>
        </section>

        <section className="card" aria-labelledby="profile-details-title">
          <h2 id="profile-details-title">Membership details</h2>
          <dl className="profileDetails">
            <Detail term="Role">
              {ROLE_LABELS[account?.role] || account?.role}
            </Detail>
            <Detail term="Country">{account?.country}</Detail>
            <Detail term="Region">{account?.region}</Detail>
            <Detail term="Organisation">{account?.organizationName}</Detail>
            <Detail term="Course score">
              {account?.courseScore == null
                ? null
                : `${account.courseScore} correct answers`}
            </Detail>
          </dl>
          <p className="metaMuted profileHelp">
            To correct membership details, contact{' '}
            <a
              className="inlineLink"
              href="mailto:membership@youngoclimate.org"
            >
              membership@youngoclimate.org
            </a>
            .
          </p>
        </section>
      </div>

      <OrgAffiliation />

      <MyFeedback />

      {(teamRoles.length > 0 ||
        wgAssignments.length > 0 ||
        interests.length > 0) && (
        <Section label="Your participation">
          <div className="grid2">
            {teamRoles.length > 0 && (
              <div className="card cardTight">
                <h3>Teams</h3>
                <ul className="profileList">
                  {teamRoles.map((role) => (
                    <li key={role}>{TEAM_LABELS[role] || role}</li>
                  ))}
                </ul>
              </div>
            )}
            {wgAssignments.length > 0 && (
              <div className="card cardTight">
                <h3>Working-group roles</h3>
                <ul className="profileList">
                  {wgAssignments.map((assignment) => (
                    <li
                      key={`${assignment.wgSlug}-${assignment.role || 'member'}`}
                    >
                      {assignment.wgName || assignment.wgSlug} ·{' '}
                      {assignment.role || 'member'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {interests.length > 0 && (
              <div className="card cardTight">
                <h3>Working-group interests</h3>
                <p className="meta">
                  {interests.map(workingGroupLabel).join(', ')}
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      <Section label="Start here">
        <div className="profileLinks">
          <A href="/onboarding" className="card profileLink">
            <BookOpenCheck size={21} aria-hidden />
            <span>
              <strong>Onboarding guide</strong>
              <small>How the Hub and YOUNGO membership work</small>
            </span>
          </A>
          <A href="/onboarding/course" className="card profileLink">
            <GraduationCap size={21} aria-hidden />
            <span>
              <strong>Membership course</strong>
              <small>Review the course whenever you need it</small>
            </span>
          </A>
          <A href="/library" className="card profileLink">
            <Library size={21} aria-hidden />
            <span>
              <strong>Resource library</strong>
              <small>Guides, policies, and practical materials</small>
            </span>
          </A>
          <A href="/groups" className="card profileLink">
            <Users size={21} aria-hidden />
            <span>
              <strong>Working groups</strong>
              <small>Find a group and complete its onboarding</small>
            </span>
          </A>
          <A href="/privacy" className="card profileLink">
            <LockKeyhole size={21} aria-hidden />
            <span>
              <strong>Privacy notice</strong>
              <small>What the Hub stores and who can see it</small>
            </span>
          </A>
        </div>
      </Section>
    </div>
  )
}
