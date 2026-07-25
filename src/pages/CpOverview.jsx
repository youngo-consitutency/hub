import { useApi } from '../lib/api.js'
import { A, Async, Empty, Section, StatusChip } from '../components/ui.jsx'
import { useAccount } from '../lib/accountContext.jsx'
import {
  Briefcase,
  Users,
  CalendarDays,
  ListChecks,
  ArrowRight,
} from 'lucide-react'

export function CpOverview() {
  const groups = useApi('/groups')
  const { account } = useAccount()
  const access = account?.access || { wgAssignments: [], manageAllWgs: false }

  return (
    <div>
      <p className="eyebrow">Coordination workspace</p>
      <h1>Working Group Contact Points</h1>
      <p className="meta pageIntro">
        Review joiners, keep activities visible, and move WG action points
        forward.
      </p>

      <div className="metricGrid">
        <div className="metricCard">
          <Users size={18} aria-hidden />
          <strong>
            {access.manageAllWgs ? 'All' : access.wgAssignments.length}
          </strong>
          <span>assigned groups</span>
        </div>
        <div className="metricCard">
          <ListChecks size={18} aria-hidden />
          <strong>Review</strong>
          <span>new joiners first</span>
        </div>
        <div className="metricCard">
          <CalendarDays size={18} aria-hidden />
          <strong>Update</strong>
          <span>calls and actions</span>
        </div>
      </div>

      <Section label="Your WG workspaces">
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
              : data.items.filter((group) =>
                  access.wgAssignments.some(
                    (item) => item.wgSlug === group.slug,
                  ),
                )
            if (!assigned.length)
              return (
                <Empty
                  icon={Briefcase}
                  title="No WG assignment yet"
                  body="An admin or existing Contact Point must assign you to a specific working group."
                />
              )
            return (
              <div className="grid2">
                {assigned.map((group) => (
                  <A
                    key={group.slug}
                    href={`/cp/${group.slug}`}
                    className="card roleCard"
                  >
                    <div className="rowBetween">
                      <span className="monogram">{group.monogram}</span>
                      <StatusChip status="active" />
                    </div>
                    <h3 style={{ marginTop: 12 }}>{group.name}</h3>
                    <p className="meta" style={{ marginTop: 4 }}>
                      {group.focusLine}
                    </p>
                    <span className="roleCardAction">
                      Open management <ArrowRight size={15} aria-hidden />
                    </span>
                  </A>
                ))}
              </div>
            )
          }}
        </Async>
      </Section>
    </div>
  )
}
