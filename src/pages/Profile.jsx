import { useAccount } from '../lib/accountContext.jsx'
import { useApi } from '../lib/api.js'
import { A, PageHeader, Section } from '../components/ui.jsx'
import { OrgAffiliation } from '../components/OrgAffiliation.jsx'
import { MyFeedback } from '../components/MyFeedback.jsx'
import { MemberProfileEditor } from '../components/MemberProfileEditor.jsx'
import { NotificationSettings } from '../components/NotificationSettings.jsx'
import { workingGroupIcon } from '../lib/workingGroupIcons.js'
import {
  workingGroupLabel,
  WORKING_GROUP_TOPICS,
} from '../../shared/workingGroups.js'
import {
  TbBook2 as BookOpenCheck,
  TbSchool as GraduationCap,
  TbLibrary as Library,
  TbLock as LockKeyhole,
  TbUsers as Users,
} from 'react-icons/tb'

const ROLE_LABELS = {
  admin: 'Administrator',
  focal_point: 'Global Focal Point',
  ngo_admin: 'Organisation administrator',
  member: 'Member',
}

const TEAM_LABELS = {
  membership_team: 'Membership Team',
  gys_policy_team: 'Global Youth Statement Policy Team',
  content_editor: 'Content editor',
  content_publisher: 'Content publisher',
}

export function Profile() {
  const { account } = useAccount()
  const profileQuery = useApi('/member/profile')
  const access = account?.access || {}
  const teamRoles = access.teamRoles || account?.teamRoles || []
  const wgAssignments = access.wgAssignments || []
  const interests = account?.wgInterests || []
  const interestGroups = WORKING_GROUP_TOPICS.map((topic) => ({
    ...topic,
    groups: topic.groups.filter((slug) => interests.includes(slug)),
  })).filter((topic) => topic.groups.length > 0)

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Your membership details, roles, and useful starting points."
      />

      <div className="profileGrid">
        <MemberProfileEditor
          query={profileQuery}
          account={account}
          roleLabel={ROLE_LABELS[account?.role] || account?.role}
        />
        <div className="profileSideStack">
          <OrgAffiliation />
          <NotificationSettings />
        </div>
      </div>

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
                      <A
                        href={`/groups/${assignment.wgSlug}`}
                        className="inlineLink"
                        peek
                      >
                        {assignment.wgName ||
                          workingGroupLabel(assignment.wgSlug)}
                      </A>{' '}
                      · {assignment.role || 'member'}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {interests.length > 0 && (
              <div className="card cardTight profileInterestCard">
                <h3>Working-group interests</h3>
                <div className="profileInterestGroups">
                  {interestGroups.map((topic) => (
                    <section key={topic.key} className="profileInterestGroup">
                      <h4>{topic.label}</h4>
                      <ul>
                        {topic.groups.map((slug) => {
                          const GroupIcon = workingGroupIcon(slug)
                          return (
                            <li key={slug}>
                              <A
                                href={`/groups/${slug}`}
                                className="chip chip-neutral personLinkChip"
                                peek
                              >
                                <GroupIcon
                                  size={13}
                                  strokeWidth={1.75}
                                  aria-hidden
                                />
                                {workingGroupLabel(slug)}
                              </A>
                            </li>
                          )
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
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
