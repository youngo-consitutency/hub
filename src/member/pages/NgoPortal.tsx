import type { NgoRequestsResponse } from '../../shared/contracts'
import { SidePanel } from '../components/SidePanel.tsx'
import { TbBuildingCommunity as OrganisationIcon } from 'react-icons/tb'
import { useEffect, useState, type FormEvent } from 'react'
import { apiPost, apiPatch, useApi, errorMessage } from '../lib/api'
import { useAccount } from '../lib/accountContext'
import { replace, usePath, useQuery } from '../lib/router'
import { Button, Section, Empty, ErrorCard, PageHeader } from '../components/ui'
import { DatePicker, SearchableSelect } from '../components/FormControls'
import { NgoOpportunities } from '../components/NgoOpportunities'
import { TbUserPlus as UserPlus } from 'react-icons/tb'

export function NgoPortal() {
  const [panel, setPanel] = useState<'request' | 'invite' | null>(null)
  const { account, setAccount, reloadAccess } = useAccount()
  const path = usePath()
  const query = useQuery()
  const requests = useApi<NgoRequestsResponse>(
    path.includes('accept') ? null : '/member/ngo/requests',
  )
  const data = requests.data
  const [actionError, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    kind: 'endorse',
    title: '',
    body: '',
    deadlineAt: '',
  })
  const [invite, setInvite] = useState({
    email: '',
    name: '',
    seatRole: 'representative',
  })
  // Seat role the organisation intends to grant, per pending request.
  const [decisionRole, setDecisionRole] = useState<Record<number, string>>({})
  const [inviteResult, setInviteResult] = useState<{ note: string } | null>(null)
  const [acceptMsg, setAcceptMsg] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  // preview first; accepting requires an explicit user action
  const preview = useApi<{ seat: { organizationName?: string; email: string; seatRole: string } }>(
    inviteToken ? `/member/ngo/invite/${encodeURIComponent(inviteToken)}` : null,
  )
  const invitePreview = inviteToken ? preview.data?.seat : null
  const error = actionError || requests.error || (inviteToken && preview.error)

  const load = () => {
    setError(null)
    requests.retry()
    preview.retry()
  }

  useEffect(() => {
    setInviteToken(query.get('token'))
  }, [query])

  const acceptInvite = () => {
    if (!inviteToken) return
    setError(null)
    apiPost(`/member/ngo/invite/${encodeURIComponent(inviteToken)}/accept`, {})
      .then((res) => {
        setAcceptMsg('You joined the organisation team.')
        if (res.account) setAccount(res.account)
        // the new seat changes access
        reloadAccess()
        setInviteToken(null)
        // leaving /ngo/accept switches the requests fetch on
        replace('/ngo')
      })
      .catch((e) => setError(errorMessage(e)))
  }

  const create = async (e: FormEvent<HTMLFormElement>) => {
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
      setError(errorMessage(err))
    }
  }

  const sendInvite = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInviteResult(null)
    try {
      const res = await apiPost<{ note: string }>('/member/ngo/seats/invite', invite)
      setInviteResult(res)
      setInvite({ email: '', name: '', seatRole: 'representative' })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const revoke = async (id: number) => {
    try {
      await apiPost(`/member/ngo/seats/${id}/revoke`, {})
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const decideAffiliation = async (id: number, decision: 'approve' | 'decline') => {
    try {
      await apiPost(`/member/affiliations/${id}/decide`, {
        decision,
        seatRole: decisionRole[id] || 'affiliate',
      })
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const markDone = async (id: number) => {
    try {
      await apiPatch(`/member/ngo/requests/${id}`, { status: 'done' })
      setAcceptMsg('Request marked done.')
      load()
    } catch (err) {
      setError(errorMessage(err))
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
        <Section label="Requests inbox">
          {!data?.items?.length ? (
            <Empty
              title="No requests yet"
              body="Use Log a request to track an endorsement or submission."
            />
          ) : (
            <div className="stackSm">
              {data.items.map((r) => (
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
              onChange={(kind: string) => setForm((current) => ({ ...current, kind }))}
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
              onChange={(deadlineAt: string) => setForm((current) => ({ ...current, deadlineAt }))}
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
          {(data?.seats || []).some((s) => s.status === 'requested') && (
            <Section label="Affiliation requests">
              <div className="stack">
                {(data?.seats || [])
                  .filter((s) => s.status === 'requested')
                  .map((s) => (
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
                            onChange={(seatRole: string) =>
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
                .filter((s) => s.status !== 'requested')
                .map((s) => (
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
                    onChange={(seatRole: string) =>
                      setInvite((current) => ({ ...current, seatRole }))
                    }
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
