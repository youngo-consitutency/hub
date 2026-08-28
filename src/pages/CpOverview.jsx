import { useEffect, useMemo, useState } from 'react'
import { apiGet, useApi } from '../lib/api.js'
import { A, Async, Empty, StatusChip } from '../components/ui.jsx'
import {
  MissionCountdown,
  MissionMetric,
  MissionMonogram,
} from '../components/MissionConsole.jsx'
import { useAccount } from '../lib/accountContext.jsx'
import {
  TbArrowRight as ArrowRight,
  TbBriefcase as Briefcase,
  TbListCheck as ListChecks,
  TbRadio as Radio,
  TbUsers as Users,
} from 'react-icons/tb'

function roleForGroup(access, slug) {
  return (
    access.wgAssignments?.find((item) => item.wgSlug === slug)?.role ||
    (access.manageAllWgs ? 'admin' : 'contact')
  )
}

export function CpOverview() {
  const groups = useApi('/groups')
  const { account } = useAccount()
  const access = account?.access || { wgAssignments: [], manageAllWgs: false }
  const [pendingByWg, setPendingByWg] = useState({})

  const assignedSlugs = useMemo(() => {
    if (access.manageAllWgs) return null
    return new Set(
      (access.wgAssignments || []).map((item) => item.wgSlug).filter(Boolean),
    )
  }, [access.manageAllWgs, access.wgAssignments])

  useEffect(() => {
    const items = groups.data?.items
    if (!items?.length) return
    const assigned = access.manageAllWgs
      ? items
      : items.filter((group) => assignedSlugs?.has(group.slug))
    let cancelled = false
    Promise.all(
      assigned.map(async (group) => {
        try {
          const data = await apiGet(
            `/member/cp/${encodeURIComponent(group.slug)}/members`,
          )
          const pending = (data.items || []).filter(
            (m) => m.status === 'pending_approval' || m.status === 'interested',
          ).length
          return [group.slug, pending]
        } catch {
          return [group.slug, 0]
        }
      }),
    ).then((pairs) => {
      if (cancelled) return
      setPendingByWg(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [groups.data, access.manageAllWgs, assignedSlugs])

  const pendingTotal = Object.values(pendingByWg).reduce((sum, n) => sum + n, 0)

  return (
    <div className="mcConsole">
      <div className="mcHero">
        <MissionCountdown />
        <div className="mcHeroMetrics">
          <MissionMetric
            value={
              access.manageAllWgs
                ? 'ALL'
                : String(access.wgAssignments?.length || 0)
            }
            label="Assigned groups"
          />
          <MissionMetric
            value={String(pendingTotal)}
            label="Awaiting review"
            tone={pendingTotal > 0 ? 'warn' : undefined}
          />
          <MissionMetric value="CP" label="Your mandate" />
        </div>
      </div>

      <section className="mcSection">
        <div className="mcSectionHead">
          <h2>Your WG workspaces</h2>
          <span className="mcSectionHint">
            <Radio size={14} aria-hidden /> Open a group to review joiners
          </span>
        </div>

        <Async
          query={groups}
          empty={(data) =>
            !data.items?.length ? (
              <Empty icon={Briefcase} title="No working groups available" />
            ) : null
          }
        >
          {(data) => {
            const assigned = access.manageAllWgs
              ? data.items
              : data.items.filter((group) => assignedSlugs?.has(group.slug))
            if (!assigned.length) {
              return (
                <Empty
                  icon={Briefcase}
                  title="No WG assignment yet"
                  body="An admin or existing Contact Point must assign you to a specific working group."
                />
              )
            }
            return (
              <div className="mcBento">
                {assigned.map((group) => {
                  const pending = pendingByWg[group.slug] || 0
                  const role = roleForGroup(access, group.slug)
                  return (
                    <A
                      key={group.slug}
                      href={`/cp/${group.slug}`}
                      className="mcWgTile"
                    >
                      <div className="mcWgTileTop">
                        <MissionMonogram>
                          {group.monogram || group.name.slice(0, 2)}
                        </MissionMonogram>
                        <StatusChip status="active" />
                      </div>
                      <h3>{group.name}</h3>
                      <p className="mcWgFocus">{group.focusLine}</p>
                      <div className="mcWgMeta">
                        <span className="mcPill mono">{role}</span>
                        {pending > 0 ? (
                          <span className="mcPill mcPillWarn mono">
                            <ListChecks size={12} aria-hidden />
                            {pending} pending
                          </span>
                        ) : (
                          <span className="mcPill mono">
                            <Users size={12} aria-hidden />
                            clear
                          </span>
                        )}
                      </div>
                      <span className="mcWgCta">
                        Open console <ArrowRight size={15} aria-hidden />
                      </span>
                    </A>
                  )
                })}
              </div>
            )
          }}
        </Async>
      </section>
    </div>
  )
}
