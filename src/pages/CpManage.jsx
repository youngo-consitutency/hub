import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, useApi } from '../lib/api.js'
import {
  A,
  Async,
  BackLink,
  Button,
  Empty,
  ErrorCard,
} from '../components/ui.jsx'
import { SearchableSelect } from '../components/FormControls.jsx'
import {
  MissionCountdown,
  MissionMetric,
  MissionMonogram,
} from '../components/MissionConsole.jsx'
import { WG_ACTIVITY_KINDS } from '../../shared/workflows.js'

export function CpManage({ slug }) {
  const groups = useApi('/groups')
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    kind: 'call',
    title: '',
    body: '',
    startsAt: '',
  })
  const [msg, setMsg] = useState(null)

  const load = () => {
    setError(null)
    apiGet(`/member/cp/${encodeURIComponent(slug)}/members`)
      .then((d) => setMembers(d.items || []))
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [slug])

  const setRole = async (accountId, role, status) => {
    try {
      await apiPost(
        `/member/cp/${encodeURIComponent(slug)}/members/${accountId}/role`,
        { role, status },
      )
      load()
    } catch (e) {
      setError(e.message)
    }
  }

  const addActivity = async (e) => {
    e.preventDefault()
    setMsg(null)
    try {
      await apiPost(`/member/cp/${encodeURIComponent(slug)}/activities`, {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      })
      setForm({ kind: 'call', title: '', body: '', startsAt: '' })
      setMsg('Activity registered.')
    } catch (err) {
      setError(err.message)
    }
  }

  const pending = useMemo(
    () =>
      members.filter(
        (m) => m.status === 'pending_approval' || m.status === 'interested',
      ),
    [members],
  )
  const active = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members],
  )

  return (
    <div className="mcConsole">
      <BackLink href="/cp">all WG consoles</BackLink>

      <Async query={groups} skeletons={2}>
        {(g) => {
          const group = (g.items || []).find((x) => x.slug === slug)
          const monogram =
            group?.monogram || String(slug).slice(0, 2).toUpperCase()
          return (
            <>
              <div className="mcHero">
                <div className="mcHeroIdentity">
                  <MissionMonogram>{monogram}</MissionMonogram>
                  <div>
                    <p className="mcEyebrow">Contact Point console</p>
                    <h1 className="mcTitle">{group?.name || slug}</h1>
                    {group?.focusLine && (
                      <p className="mcLead">{group.focusLine}</p>
                    )}
                  </div>
                </div>
                <MissionCountdown />
                <div className="mcHeroMetrics">
                  <MissionMetric
                    value={String(pending.length)}
                    label="Awaiting review"
                    tone={pending.length ? 'warn' : undefined}
                  />
                  <MissionMetric
                    value={String(active.length)}
                    label="Active members"
                  />
                  <MissionMetric
                    value={String(members.length)}
                    label="In queue total"
                  />
                </div>
              </div>

              {error && <ErrorCard message={error} onRetry={load} />}
              {msg && <p className="mcFlash">{msg}</p>}

              <div className="mcSplit">
                <section className="mcPanel">
                  <div className="mcSectionHead">
                    <h2>Joiner queue</h2>
                    <span className="mcSectionHint mono">
                      {members.length} records
                    </span>
                  </div>
                  {members.length === 0 ? (
                    <Empty
                      title="No joiners yet"
                      body="When members unlock this workspace they appear here."
                    />
                  ) : (
                    <div className="mcQueue">
                      {members.map((m) => {
                        const needsReview =
                          m.status === 'pending_approval' ||
                          m.status === 'interested'
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
                                {m.status}
                                <span aria-hidden> · </span>
                                {m.role_in_wg}
                              </p>
                            </div>
                            <div className="mcQueueActions">
                              <Button
                                sm
                                variant="secondary"
                                onClick={() =>
                                  setRole(m.account_id, 'member', 'active')
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                sm
                                variant="ghost"
                                onClick={() =>
                                  setRole(m.account_id, 'contact', 'active')
                                }
                              >
                                Make CP
                              </Button>
                              <Button
                                sm
                                variant="ghost"
                                onClick={() =>
                                  setRole(m.account_id, 'member', 'rejected')
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="mcPanel">
                  <div className="mcSectionHead">
                    <h2>Register activity</h2>
                  </div>
                  <form className="mcForm" onSubmit={addActivity}>
                    <SearchableSelect
                      label="Kind"
                      options={WG_ACTIVITY_KINDS.map(([value, label]) => ({
                        value,
                        label,
                      }))}
                      value={form.kind}
                      onChange={(kind) =>
                        setForm((current) => ({ ...current, kind }))
                      }
                      searchPlaceholder="Search activity types…"
                    />
                    <label className="field">
                      <span>Title</span>
                      <input
                        className="input"
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Details</span>
                      <textarea
                        className="input textarea"
                        rows={3}
                        value={form.body}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, body: e.target.value }))
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Starts (optional)</span>
                      <input
                        className="input"
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, startsAt: e.target.value }))
                        }
                      />
                    </label>
                    <Button type="submit" variant="primary" glow>
                      Add activity
                    </Button>
                  </form>
                </section>
              </div>
            </>
          )
        }}
      </Async>
    </div>
  )
}
