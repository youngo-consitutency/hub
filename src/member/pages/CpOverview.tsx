import type { AnyValue, Doc } from '../lib/types'
import { useContentOptionLabels } from '../lib/documents'
import { useMemo } from 'react'
import useSWR from 'swr'
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

function roleForGroup(access: AnyValue, slug: AnyValue) {
  return (
    access.wgAssignments?.find((item: Doc) => item.wgSlug === slug)?.role ||
    (access.manageAllWgs ? 'officer' : 'contact')
  )
}

export function CpOverview() {
  const { assignmentLabels } = useContentOptionLabels()
  const groups = useApi('/groups')
  const { account } = useAccount()
  const access = account?.access || { wgAssignments: [], manageAllWgs: false }

  const assignedSlugs = useMemo(() => {
    if (access.manageAllWgs) return null
    return new Set((access.wgAssignments || []).map((item: Doc) => item.wgSlug).filter(Boolean))
  }, [access.manageAllWgs, access.wgAssignments])

  // no batched endpoint exists, so one SWR entry runs the per-group reads together:
  // cached, deduped and ignored after unmount (the old effect refetched on every change)
  const pendingSlugs: string[] = (groups.data?.items || [])
    .filter((group: Doc) => access.manageAllWgs || assignedSlugs?.has(group.slug))
    .map((group: Doc) => group.slug)
  const { data: pendingByWg, error: pendingError } = useSWR<Record<string, number>>(
    pendingSlugs.length ? ['cp-pending', ...pendingSlugs] : null,
    async ([, ...slugs]: string[]) =>
      Object.fromEntries(
        await Promise.all(
          // a failed read rejects so SWR keeps the last counts and retries, never a fake zero
          slugs.map(async (slug) => {
            const data = await apiGet(`/member/cp/${encodeURIComponent(slug)}/members`)
            const pending = (data.members || []).filter(
              ({ progress }: AnyValue) =>
                progress.status === 'pending_approval' || progress.status === 'interested',
            ).length
            return [slug, pending]
          }),
        ),
      ),
  )

  const pendingTotal = pendingByWg && Object.values(pendingByWg).reduce((sum, n) => sum + n, 0)
  const pendingUnavailable = !pendingByWg && pendingError

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
          <strong>{pendingUnavailable ? '–' : (pendingTotal ?? 0)}</strong>
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
          empty={(data: Doc) =>
            !data.items?.length ? (
              <Empty icon={Briefcase} title="No working groups available" />
            ) : null
          }
        >
          {(data: Doc) => {
            const assigned = access.manageAllWgs
              ? data.items
              : data.items.filter((group: Doc) => assignedSlugs?.has(group.slug))
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
                {assigned.map((group: Doc) => {
                  const pending = pendingByWg?.[group.slug] || 0
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
                        {pendingUnavailable ? (
                          <span className="mcPill mono">unavailable</span>
                        ) : pending > 0 ? (
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
