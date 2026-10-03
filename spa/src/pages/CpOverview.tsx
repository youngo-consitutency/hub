import { useContentOptionLabels } from '../lib/documents'
import { useEffect, useMemo, useState } from 'react'
import { apiGet, useApi } from '../lib/api'
import { A, Async, Empty, StatusChip, PageHeader } from '../components/ui'
import { useAccount } from '../lib/accountContext'
import {
  TbArrowRight as ArrowRight,
  TbBriefcase as Briefcase,
  TbListCheck as ListChecks,
  TbRadio as Radio,
  TbUsers as Users,
} from 'react-icons/tb'

function roleForGroup(access: any, slug: any) {
  return (
    access.wgAssignments?.find((item: any) => item.wgSlug === slug)?.role ||
    (access.manageAllWgs ? 'officer' : 'contact')
  )
}

export function CpOverview() {
  const { assignmentLabels } = useContentOptionLabels()
  const groups = useApi('/groups')
  const { account } = useAccount()
  const access = account?.access || { wgAssignments: [], manageAllWgs: false }
  const [pendingByWg, setPendingByWg] = useState<Record<string, any>>({})

  const assignedSlugs = useMemo(() => {
    if (access.manageAllWgs) return null
    return new Set((access.wgAssignments || []).map((item: any) => item.wgSlug).filter(Boolean))
  }, [access.manageAllWgs, access.wgAssignments])

  useEffect(() => {
    const items = groups.data?.items
    if (!items?.length) return
    const assigned = access.manageAllWgs
      ? items
      : items.filter((group: any) => assignedSlugs?.has(group.slug))
    let cancelled = false
    Promise.all(
      assigned.map(async (group: any) => {
        try {
          const data = await apiGet(`/member/cp/${encodeURIComponent(group.slug)}/members`)
          const pending = (data.items || []).filter(
            (m: any) => m.status === 'pending_approval' || m.status === 'interested',
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
      <PageHeader
        icon={Briefcase}
        title="Working Group workspaces"
        description="Review membership requests and organise activities in your assigned groups."
      />
      <div className="metricGrid">
        <div className="metricCard">
          <Users size={20} aria-hidden />
          <strong>{access.manageAllWgs ? 'All' : access.wgAssignments?.length || 0}</strong>
          <span>Accessible groups</span>
        </div>
        <div className="metricCard">
          <ListChecks size={20} aria-hidden />
          <strong>{pendingTotal}</strong>
          <span>Awaiting review</span>
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
          empty={(data: any) =>
            !data.items?.length ? (
              <Empty icon={Briefcase} title="No working groups available" />
            ) : null
          }
        >
          {(data: any) => {
            const assigned = access.manageAllWgs
              ? data.items
              : data.items.filter((group: any) => assignedSlugs?.has(group.slug))
            if (!assigned.length) {
              return (
                <Empty
                  icon={Briefcase}
                  title="No WG assignment yet"
                  body="An administrator can record your selected Contact Point mandate, with its appointment evidence and term."
                />
              )
            }
            return (
              <div className="cardGrid">
                {assigned.map((group: any) => {
                  const pending = pendingByWg[group.slug] || 0
                  const role = roleForGroup(access, group.slug)
                  return (
                    <A key={group.slug} href={`/cp/${group.slug}`} className="card entityCard">
                      <div className="mcWgTileTop">
                        <Users size={22} aria-hidden />
                        <StatusChip status="active" />
                      </div>
                      <h3>{group.name}</h3>
                      <p className="mcWgFocus">{group.focusLine}</p>
                      <div className="mcWgMeta">
                        <span className="mcPill mono">
                          {role === 'officer' ? 'Platform officer' : assignmentLabels[role] || role}
                        </span>
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
                        Open workspace <ArrowRight size={15} aria-hidden />
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
