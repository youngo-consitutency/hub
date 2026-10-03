interface CpManageProps {
  slug: string
}

import { SidePanel } from '../components/SidePanel.tsx'
import { TbUsers as Users, TbPlus as Plus } from 'react-icons/tb'
import { useContentOptionLabels, useContentOptions } from '../lib/documents'
import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, useApi } from '../lib/api'
import { Async, BackLink, Button, Empty, ErrorCard, PageHeader, FilterPill } from '../components/ui'
import { SearchableSelect } from '../components/FormControls'

export function CpManage({ slug }: CpManageProps) {
  const { assignmentLabels } = useContentOptionLabels()
  const { wgActivityKinds } = useContentOptions()
  const [activityBusy, setActivityBusy] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [filter, setFilter] = useState('pending')
  const groups = useApi('/groups')
  const [members, setMembers] = useState<any[]>([])
  const [error, setError] = useState<any>(null)
  const [form, setForm] = useState<Record<string, any>>({
    kind: 'call',
    title: '',
    body: '',
    startsAt: '',
  })
  const [msg, setMsg] = useState<any>(null)

  const load = () => {
    setError(null)
    apiGet(`/member/cp/${encodeURIComponent(slug)}/members`)
      .then((d) => setMembers(d.items || []))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [slug])

  const setRole = async (accountId: any, role: any, status: any) => {
    try {
      await apiPost(`/member/cp/${encodeURIComponent(slug)}/members/${accountId}/role`, {
        role,
        status,
      })
      load()
    } catch (e) {
      setError((e as any).message)
    }
  }

  const addActivity = async (e: any) => {
    e.preventDefault()
    setMsg(null)
    setError(null)
    setActivityBusy(true)
    try {
      await apiPost(`/member/cp/${encodeURIComponent(slug)}/activities`, {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      })
      setForm({ kind: 'call', title: '', body: '', startsAt: '' })
      setActivityOpen(false)
      setMsg('Activity registered.')
    } catch (err) {
      setError((err as any).message)
    } finally {
      setActivityBusy(false)
    }
  }

  const pending = useMemo(
    () => members.filter((m) => m.status === 'pending_approval' || m.status === 'interested'),
    [members],
  )
  const active = useMemo(() => members.filter((m) => m.status === 'active'), [members])

  return (
    <div className="stack">
      <BackLink href="/cp">Working Group workspaces</BackLink>

      <Async query={groups} skeletons={2}>
        {(g: any) => {
          const group = (g.items || []).find((x: any) => x.slug === slug)
          return (
            <>
              <PageHeader
                icon={Users}
                title={group?.name || slug}
                description="Contact Point workspace · Review membership requests and organise group activities."
                action={
                  <Button
                    onClick={() => {
                      setError(null)
                      setActivityOpen(true)
                    }}
                  >
                    <Plus size={18} aria-hidden />
                    Add activity
                  </Button>
                }
              />
              <div className="filterRow" aria-label="Membership requests">
                <FilterPill active={filter === 'pending'} onClick={() => setFilter('pending')}>
                  Awaiting review ({pending.length})
                </FilterPill>
                <FilterPill active={filter === 'active'} onClick={() => setFilter('active')}>
                  Active members ({active.length})
                </FilterPill>
                <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
                  All ({members.length})
                </FilterPill>
              </div>
              {error && !activityOpen && <ErrorCard message={error} onRetry={load} />}
              {msg && <p className="mcFlash">{msg}</p>}

              <div>
                <section className="card">
                  <div className="mcSectionHead">
                    <h2>Group membership</h2>
                    <span className="mcSectionHint mono">{members.length} records</span>
                  </div>
                  {(filter === 'pending' ? pending : filter === 'active' ? active : members)
                    .length === 0 ? (
                    <Empty
                      title="No members in this view"
                      body="When members unlock this workspace they appear here."
                    />
                  ) : (
                    <div className="mcQueue">
                      {(filter === 'pending'
                        ? pending
                        : filter === 'active'
                          ? active
                          : members
                      ).map((m) => {
                        const needsReview =
                          m.status === 'pending_approval' || m.status === 'interested'
                        return (
                          <div
                            key={`${m.account_id}-${m.wg_slug}`}
                            className={`mcQueueRow${needsReview ? ' mcQueueRowWarn' : ''}`}
                          >
                            <div className="mcQueueCopy">
                              <strong>{m.name || m.email}</strong>
                              <p className="mcQueueMeta mono">
                                {m.email}
                                <span aria-hidden> · </span>
                                {m.status.replaceAll('_', ' ')}
                                <span aria-hidden> · </span>
                                {assignmentLabels[m.role_in_wg] || m.role_in_wg}
                              </p>
                            </div>
                            {needsReview && (
                              <div className="mcQueueActions">
                                <Button
                                  sm
                                  variant="secondary"
                                  onClick={() => setRole(m.account_id, 'member', 'active')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  sm
                                  variant="ghost"
                                  onClick={() => setRole(m.account_id, 'member', 'rejected')}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                {activityOpen && (
                  <SidePanel title="Add activity" onClose={() => setActivityOpen(false)}>
                    {error && <ErrorCard message={error} />}
                    <form className="stack" onSubmit={addActivity}>
                      <SearchableSelect
                        label="Kind"
                        options={wgActivityKinds}
                        value={form.kind}
                        onChange={(kind: any) => setForm((current) => ({ ...current, kind }))}
                        searchPlaceholder="Search activity types…"
                      />
                      <label className="field">
                        <span>Title</span>
                        <input
                          className="input"
                          value={form.title}
                          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                          required
                        />
                      </label>
                      <label className="field">
                        <span>Details</span>
                        <textarea
                          className="input textarea"
                          rows={3}
                          value={form.body}
                          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                        />
                      </label>
                      <label className="field">
                        <span>Starts (optional)</span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={form.startsAt}
                          onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                        />
                      </label>
                      <Button type="submit" variant="primary" disabled={activityBusy}>
                        {activityBusy ? 'Saving…' : 'Add activity'}
                      </Button>
                    </form>
                  </SidePanel>
                )}
              </div>
            </>
          )
        }}
      </Async>
    </div>
  )
}
