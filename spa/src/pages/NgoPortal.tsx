import { SidePanel } from '../components/SidePanel.tsx'
import { TbBuildingCommunity as OrganisationIcon } from 'react-icons/tb'
import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '../lib/api'
import { useAccount } from '../lib/accountContext'
import { usePath } from '../lib/router'
import { A, Button, Section, Empty, ErrorCard, PageHeader } from '../components/ui'
import { DatePicker, SearchableSelect } from '../components/FormControls'
import { NgoOpportunities } from '../components/NgoOpportunities'
import {
  TbAward as Award,
  TbRosetteDiscountCheck as BadgeCheck,
  TbUserPlus as UserPlus,
} from 'react-icons/tb'

export function NgoPortal() {
  const [panel, setPanel] = useState<any>(null)
  const { account, setAccount } = useAccount()
  const path = usePath()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const [form, setForm] = useState<Record<string, any>>({
    kind: 'endorse',
    title: '',
    body: '',
    deadlineAt: '',
  })
  const [invite, setInvite] = useState<Record<string, any>>({
    email: '',
    name: '',
    seatRole: 'representative',
  })
  // Seat role the organisation intends to grant, per pending request.
  const [decisionRole, setDecisionRole] = useState<Record<string, any>>({})
  const [inviteResult, setInviteResult] = useState<any>(null)
  const [acceptMsg, setAcceptMsg] = useState<any>(null)
  const [inviteToken, setInviteToken] = useState<any>(null)
  const [invitePreview, setInvitePreview] = useState<any>(null)

  const load = () => {
    setError(null)
    apiGet('/member/ngo/requests')
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    if (!path.includes('accept')) load()
  }, [path])

  // Preview first; accepting requires an explicit user action.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!path.includes('accept') && !token) return
    if (!token) return
    setInviteToken(token)
    apiGet(`/member/ngo/invite/${encodeURIComponent(token)}`)
      .then(({ seat }) => setInvitePreview(seat))
      .catch((e) => setError(e.message))
  }, [path])

  const acceptInvite = () => {
    if (!inviteToken) return
    setError(null)
    apiPost(`/member/ngo/invite/${encodeURIComponent(inviteToken)}/accept`, {})
      .then((res) => {
        setAcceptMsg('You joined the organisation team.')
        if (res.account) setAccount(res.account)
        setInvitePreview(null)
        setInviteToken(null)
        load()
        window.history.replaceState({}, '', '/ngo')
      })
      .catch((e) => setError(e.message))
  }

  const create = async (e: any) => {
    e.preventDefault()
    try {
      await apiPost('/member/ngo/requests', {
        ...form,
        deadlineAt: form.deadlineAt ? new Date(form.deadlineAt).toISOString() : null,
      })
      setForm({ kind: 'endorse', title: '', body: '', deadlineAt: '' })
      setPanel(null)
      load()
    } catch (err) {
      setError((err as any).message)
    }
  }

  const sendInvite = async (e: any) => {
    e.preventDefault()
    setInviteResult(null)
    try {
      const res = await apiPost('/member/ngo/seats/invite', invite)
      setInviteResult(res)
      setInvite({ email: '', name: '', seatRole: 'representative' })
      load()
    } catch (err) {
      setError((err as any).message)
    }
  }

  const revoke = async (id: any) => {
    try {
      await apiPost(`/member/ngo/seats/${id}/revoke`, {})
      load()
    } catch (err) {
      setError((err as any).message)
    }
  }

  const decideAffiliation = async (id: any, decision: any) => {
    try {
      await apiPost(`/member/ngo/affiliations/${id}/decide`, {
        decision,
        seatRole: decisionRole[id] || 'affiliate',
      })
      load()
    } catch (err) {
      setError((err as any).message)
    }
  }

  const markDone = async (id: any) => {
    try {
      const res = await apiPatch(`/member/ngo/requests/${id}`, {
        status: 'done',
      })
      if (res?.awardSuggestion) {
        setAcceptMsg('Request marked done.')
      }
      load()
    } catch (err) {
      setError((err as any).message)
    }
  }

  return (
    <div>
      <PageHeader
        icon={OrganisationIcon}
        title="NGO platform"
        action={
          <div className="rowGap">
            {data?.permissions?.canWriteRequests && (
              <Button
                onClick={() => {
                  setError(null)
                  setPanel('request')
                }}
              >
                Log a request
              </Button>
            )}
            {data?.permissions?.canManageSeats && (
              <Button
                variant="secondary"
                onClick={() => {
                  setError(null)
                  setPanel('invite')
                }}
              >
                <UserPlus size={17} aria-hidden />
                Invite representative
              </Button>
            )}
          </div>
        }
        description={`${account?.organizationName || 'Your organisation'} — requests, opportunities, and team seats.`}
      />
      {acceptMsg && (
        <p className="meta" style={{ color: 'var(--accent)' }}>
          {acceptMsg}
        </p>
      )}
      {error && !panel && <ErrorCard message={error} onRetry={load} />}
      {invitePreview && (
        <div className="card stack" style={{ marginTop: 16 }}>
          <h2>Join {invitePreview.organizationName || 'organisation team'}?</h2>
          <p className="meta">
            This invitation is for {invitePreview.email} with the {invitePreview.seatRole} role.
          </p>
          <Button variant="primary" onClick={acceptInvite}>
            Accept invitation
          </Button>
        </div>
      )}

      {data && <NgoOpportunities />}

      {data && (
        <Section label="Deadlines for NGOs">
          <div className="stackSm">
            {(data?.deadlines || []).map((d: any, i: any) => (
              <div key={i} className="card cardTight">
                <h3>{d.title}</h3>
                <p className="meta" style={{ marginTop: 4 }}>
                  {d.note}
                </p>
                {d.href && (
                  <A href={d.href} className="metaMuted">
                    Open →
                  </A>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {data && (
        <Section label="Requests inbox">
          {!data?.items?.length ? (
            <Empty
              title="No requests yet"
              body="Use Log a request to track an endorsement or submission."
            />
          ) : (
            <div className="stackSm">
              {data.items.map((r: any) => (
                <div key={r.id} className="card cardTight rowBetween">
                  <div>
                    <span className="chip chip-info">{r.kind}</span>
                    <h3 style={{ marginTop: 6 }}>{r.title}</h3>
                    <p className="meta">
                      {r.status}
                      {r.deadline_at
                        ? ` · due ${new Date(r.deadline_at).toLocaleDateString()}`
                        : ''}
                    </p>
                  </div>
                  {data.permissions?.canWriteRequests && r.status === 'open' && (
                    <Button sm variant="secondary" onClick={() => markDone(r.id)}>
                      Mark done
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {data?.permissions?.canWriteRequests && panel === 'request' && (
        <SidePanel title="Log a request" onClose={() => setPanel(null)}>
          {error && <ErrorCard message={error} />}
          <form className="stack" onSubmit={create}>
            <SearchableSelect
              label="Type"
              options={[
                { value: 'endorse', label: 'Endorse document' },
                {
                  value: 'submit',
                  label: 'UNFCCC / constituency submission',
                },
                {
                  value: 'badge_support',
                  label: 'Support badge allocation',
                },
                { value: 'represent', label: 'Represent NGO' },
                { value: 'deadline', label: 'Deadline' },
                { value: 'other', label: 'Other' },
              ]}
              value={form.kind}
              onChange={(kind: any) => setForm((current) => ({ ...current, kind }))}
              searchPlaceholder="Search request types…"
            >
              <p className="metaMuted" style={{ marginTop: 4 }}>
                Log a request to keep its owner, status and follow-up visible.
              </p>
            </SearchableSelect>
            <label className="field">
              <span>Title</span>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="input textarea"
                rows={3}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </label>
            <DatePicker
              label="Deadline"
              value={form.deadlineAt}
              onChange={(deadlineAt: any) => setForm((current) => ({ ...current, deadlineAt }))}
            />
            <Button type="submit" variant="primary">
              Save request
            </Button>
          </form>
        </SidePanel>
      )}

      {data && (
        <>
          {/* People who asked to be linked to this organisation. The org
              decides whether that is a label only, or also opens the portal. */}
          {(data?.seats || []).some((s: any) => s.status === 'requested') && (
            <Section label="Affiliation requests">
              <div className="stack">
                {(data?.seats || [])
                  .filter((s: any) => s.status === 'requested')
                  .map((s: any) => (
                    <div key={s.id} className="card affiliationRequest">
                      <div>
                        <strong>{s.memberName || s.name || s.email}</strong>
                        <p className="meta">
                          {s.email} — asked to be listed as part of this organisation.
                        </p>
                      </div>
                      {data.permissions?.canManageSeats ? (
                        <div className="affiliationDecide">
                          <SearchableSelect
                            label="Approve as"
                            options={[
                              {
                                value: 'affiliate',
                                label: 'Affiliation only (no portal access)',
                              },
                              { value: 'viewer', label: 'Viewer (read-only)' },
                              {
                                value: 'representative',
                                label: 'Representative (can act)',
                              },
                            ]}
                            value={decisionRole[s.id] || 'affiliate'}
                            onChange={(seatRole: any) =>
                              setDecisionRole((current) => ({
                                ...current,
                                [s.id]: seatRole,
                              }))
                            }
                          />
                          <div className="affiliationActions">
                            <Button
                              sm
                              variant="primary"
                              onClick={() => decideAffiliation(s.id, 'approve')}
                            >
                              Approve
                            </Button>
                            <Button
                              sm
                              variant="ghost"
                              onClick={() => decideAffiliation(s.id, 'decline')}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="metaMuted">An owner of this organisation can decide.</p>
                      )}
                    </div>
                  ))}
              </div>
            </Section>
          )}

          <Section label="Team seats">
            <div className="stack">
              {(data?.seats || [])
                .filter((s: any) => s.status !== 'requested')
                .map((s: any) => (
                  <div key={s.id} className="card cardTight rowBetween">
                    <div>
                      <strong>{s.memberName || s.name || s.email}</strong>
                      <p className="meta">
                        {s.email} · {s.seatRole} · {s.status}
                      </p>
                    </div>
                    {data.permissions?.canManageSeats &&
                      s.seatRole !== 'owner' &&
                      s.status !== 'revoked' && (
                        <Button sm variant="ghost" onClick={() => revoke(s.id)}>
                          Revoke
                        </Button>
                      )}
                  </div>
                ))}
              {!data?.seats?.length && (
                <Empty
                  title="No seats yet"
                  body="Invite representatives who can act for this NGO."
                />
              )}
            </div>

            {data.permissions?.canManageSeats && panel === 'invite' && (
              <SidePanel title="Invite representative" onClose={() => setPanel(null)}>
                {error && <ErrorCard message={error} />}
                {inviteResult && <p role="status">{inviteResult.note}</p>}
                <form className="stack" style={{ marginTop: 12 }} onSubmit={sendInvite}>
                  <div className="formRow">
                    <label className="field">
                      <span>Email *</span>
                      <input
                        className="input"
                        type="email"
                        required
                        value={invite.email}
                        onChange={(e) => setInvite((f) => ({ ...f, email: e.target.value }))}
                      />
                    </label>
                    <label className="field">
                      <span>Name</span>
                      <input
                        className="input"
                        value={invite.name}
                        onChange={(e) => setInvite((f) => ({ ...f, name: e.target.value }))}
                      />
                    </label>
                  </div>
                  <SearchableSelect
                    label="Seat role"
                    options={[
                      { value: 'representative', label: 'Representative' },
                      { value: 'viewer', label: 'Viewer' },
                    ]}
                    value={invite.seatRole}
                    onChange={(seatRole: any) => setInvite((current) => ({ ...current, seatRole }))}
                    searchPlaceholder="Search seat roles…"
                  />
                  <Button type="submit" variant="primary">
                    <UserPlus size={18} strokeWidth={1.75} aria-hidden />
                    Send invite
                  </Button>
                </form>
              </SidePanel>
            )}

            {data.permissions?.canManageSeats && inviteResult && (
              <div className="card cardTight" style={{ marginTop: 12 }}>
                <p className="meta">{inviteResult.note}</p>
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
