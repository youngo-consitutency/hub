import { TEAM_LABELS } from '../../shared/responsibilities.js'
import { SidePanel } from '../components/SidePanel.tsx'
import { TbUserCheck as MembershipIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav.jsx'
import { useState } from 'react'
import { apiPatch, useApi } from '../lib/api.js'
import {
  Async,
  Button,
  Empty,
  ErrorCard,
  FilterPill,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { SearchableSelect } from '../components/FormControls.jsx'
import { MemberAvatar } from '../components/MemberAvatar.jsx'
import {
  TbClipboardCheck as ClipboardCheck,
  TbClock as Clock3,
  TbStack3 as Layers3,
  TbRefresh as RefreshCw,
  TbSearch as Search,
  TbShieldCheck as ShieldCheck,
  TbUserCheck as UserCheck,
} from 'react-icons/tb'

const STATUS_LABELS = {
  registered: 'Registered',
  course_passed: 'Course passed',
  awaiting_onboarding: 'Awaiting onboarding',
  active: 'Active member',
  renewal_due: 'Renewal due',
  expired: 'Expired',
  terminated: 'Terminated',
}

export function MembershipTeam() {
  const [ending, setEnding] = useState(null)
  const [reason, setReason] = useState('')
  const query = useApi('/member/team/membership/overview')
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  const setStatus = async (id, status, confirmed = false) => {
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
      setActionError(error.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        icon={MembershipIcon}
        title="GCT · Membership"
        description="Move applications from registration through onboarding, activation, renewal, and offboarding."
      >
        <PageSectionNav section="membership" />
      </PageHeader>
      <Async query={query} skeletons={5}>
        {(data) => {
          const active = data.items.filter(
            (item) => item.membershipStatus === 'active',
          )
          const pending = data.items.filter(
            (item) => item.membershipStatus !== 'active',
          )
          const shown = data.items.filter((item) => {
            const stateMatch =
              filter === 'all' ||
              (filter === 'pending'
                ? item.membershipStatus !== 'active'
                : item.membershipStatus === 'active')
            const text =
              `${item.name} ${item.email} ${item.country || ''} ${item.organizationName || ''}`.toLowerCase()
            return stateMatch && text.includes(search.toLowerCase())
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
                      data.items.filter(
                        (item) => item.membershipStatus === 'renewal_due',
                      ).length
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
                  <Empty
                    icon={ClipboardCheck}
                    title="No applications in this view"
                  />
                ) : (
                  <div className="stackSm">
                    {shown.map((item) => (
                      <div key={item.id} className="card cardTight queueRow">
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
                            </p>
                            <div className="rowGap" style={{ marginTop: 6 }}>
                              <span
                                className={`taskState ${item.membershipStatus === 'active' ? 'taskState-complete' : 'taskState-review'}`}
                              >
                                {STATUS_LABELS[item.membershipStatus] ||
                                  item.membershipStatus}
                              </span>
                              <span className="chip chip-neutral">
                                Hub: {item.hubAccessStatus}
                              </span>
                              {item.teamRoles?.map((role) => (
                                <span key={role} className="chip chip-neutral">
                                  {TEAM_LABELS[role] ||
                                    role.replaceAll('_', ' ')}
                                </span>
                              ))}
                              <span className="chip chip-neutral">
                                Directory:{' '}
                                {item.profile?.directoryVisibility || 'private'}
                              </span>
                              {item.profile?.hasPhoto && (
                                <span className="chip chip-neutral">Photo</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <SearchableSelect
                          label="Membership status"
                          options={Object.entries(STATUS_LABELS).map(
                            ([value, label]) => ({ value, label }),
                          )}
                          value={item.membershipStatus}
                          onChange={(status) => setStatus(item.id, status)}
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
          <p>
            Record the reason for ending this membership. This removes the
            member’s Hub access.
          </p>
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
            <Button
              type="submit"
              variant="primary"
              disabled={busy || reason.trim().length < 8}
            >
              Confirm end of membership
            </Button>
          </form>
        </SidePanel>
      )}
    </div>
  )
}
