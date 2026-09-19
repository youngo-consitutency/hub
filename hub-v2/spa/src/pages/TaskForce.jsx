import { useApi } from '../lib/api.js'
import {
  A,
  Async,
  BackLink,
  Empty,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { WgActivityCard } from '../components/WgActivityCard.jsx'
import { taskForceBySlug } from '../../shared/taskForces.js'
import { TbFlag as Flag, TbLock as Lock } from 'react-icons/tb'

export function TaskForce({ slug, extra }) {
  const groupQuery = useApi(`/groups/${encodeURIComponent(slug || '')}`, [slug])
  const workspaceQuery = useApi(
    `/member/workspace/${encodeURIComponent(slug || '')}`,
    [slug],
  )

  return (
    <div className="detailPage">
      <BackLink href={slug ? `/groups/${slug}` : '/groups'}>
        {groupQuery.data?.name || 'Working group'}
      </BackLink>
      <Async query={groupQuery} skeletons={2}>
        {(group) => {
          const force = taskForceBySlug(group, extra)
          if (!force) {
            return (
              <Empty
                icon={Flag}
                title="Unknown task force"
                body="This working group has not published that task force."
              />
            )
          }
          const unlocked = Boolean(
            workspaceQuery.data?.progress?.presentation_ok &&
            workspaceQuery.data?.progress?.rules_ok,
          )
          const activities = (workspaceQuery.data?.activities || []).filter(
            (activity) =>
              (activity.taskForceSlug || activity.task_force_slug) ===
              force.slug,
          )
          return (
            <>
              <PageHeader
                title={force.name}
                description={force.purpose || group.focusLine}
              />
              <p className="metaMuted">
                A task force of{' '}
                <A href={`/groups/${group.slug}`} className="inlineLink">
                  {group.name}
                </A>
                .
              </p>

              <Section label="Activities">
                {!unlocked ? (
                  <Empty
                    icon={Lock}
                    title="Unlock the group workspace"
                    body="Task-force calls and files open after the group introduction."
                    cta={
                      <A
                        href={`/workspace/${group.slug}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Open workspace
                      </A>
                    }
                  />
                ) : activities.length ? (
                  <div className="cardGrid">
                    {activities.map((activity) => (
                      <WgActivityCard key={activity.id} activity={activity} />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Flag}
                    title="Nothing posted yet"
                    body="Contact Points can register a call or action for this task force."
                  />
                )}
              </Section>
            </>
          )
        }}
      </Async>
    </div>
  )
}
