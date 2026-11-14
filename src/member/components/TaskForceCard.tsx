import { Button, Disclosure, DisclosurePanel, Heading } from 'react-aria-components'
import { TbChevronDown as ChevronDown, TbFlag as Flag, TbLock as Lock } from 'react-icons/tb'
import { useApi } from '../lib/api'
import type { AnyValue } from '../lib/types'
import { A, Async, Empty } from './ui'
import { WgActivityCard } from './WgActivityCard'

/** A task force inside its group's panel: opens in place to show the activities posted to it. */
export function TaskForceCard({ group, force }: { group: AnyValue; force: AnyValue }) {
  return (
    <Disclosure className="group card cardTight self-start data-[expanded]:col-span-full">
      {({ isExpanded }) => (
        <>
          <Heading className="m-0">
            <Button
              slot="trigger"
              className="flex w-full cursor-pointer items-start justify-between gap-3 border-0 bg-transparent p-0 text-left text-inherit"
            >
              <span>
                <span className="block font-semibold text-ink">{force.name}</span>
                {force.purpose && <span className="meta block">{force.purpose}</span>}
              </span>
              <ChevronDown
                size={18}
                strokeWidth={1.75}
                aria-hidden
                className="mt-0.5 shrink-0 transition-transform group-data-[expanded]:rotate-180"
              />
            </Button>
          </Heading>
          <DisclosurePanel>
            {/* mounted only once opened, so a group with many task forces loads none up front */}
            {isExpanded && <TaskForceActivities group={group} force={force} />}
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}

function TaskForceActivities({ group, force }: { group: AnyValue; force: AnyValue }) {
  const workspace = useApi(`/member/workspace/${encodeURIComponent(group.slug)}`)
  return (
    <Async query={workspace} skeletons={1}>
      {(data: AnyValue) => {
        const unlocked = Boolean(data?.progress?.presentation_ok && data?.progress?.rules_ok)
        const activities = (data?.activities || []).filter(
          (activity: AnyValue) =>
            (activity.taskForceSlug || activity.task_force_slug) === force.slug,
        )
        if (!unlocked)
          return (
            <Empty
              icon={Lock}
              title="Unlock the group workspace"
              body="Task-force calls and files open after the group introduction."
              cta={
                <A href={`/workspace/${group.slug}`} className="btn btn-secondary btn-sm">
                  Open workspace
                </A>
              }
            />
          )
        if (!activities.length)
          return (
            <Empty
              icon={Flag}
              title="Nothing posted yet"
              body="Contact Points can register a call or action for this task force."
            />
          )
        return (
          <div className="cardGrid">
            {activities.map((activity: AnyValue) => (
              <WgActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )
      }}
    </Async>
  )
}
