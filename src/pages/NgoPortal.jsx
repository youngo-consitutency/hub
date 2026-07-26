import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '../lib/api.js'
import { useAccount } from '../lib/accountContext.jsx'
import { usePath } from '../lib/router.js'
import {
  A,
  Button,
  Section,
  Empty,
  ErrorCard,
  PageHeader,
} from '../components/ui.jsx'
import { DatePicker, SearchableSelect } from '../components/FormControls.jsx'
import { NgoOpportunities } from '../components/NgoOpportunities.jsx'
import { Award, BadgeCheck, UserPlus, Copy, Check } from 'lucide-react'

export function NgoPortal() {
  const { account, setAccount } = useAccount()
  const path = usePath()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
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
  const [decisionRole, setDecisionRole] = useState({})
  const [inviteResult, setInviteResult] = useState(null)
  const [copied, setCopied] = useState(false)
  const [acceptMsg, setAcceptMsg] = useState(null)
  const [inviteToken, setInviteToken] = useState(null)
  const [invitePreview, setInvitePreview] = useState(null)

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

  const create = async (e) => {
    e.preventDefault()
    try {
      await apiPost('/member/ngo/requests', {
        ...form,
        deadlineAt: form.deadlineAt
          ? new Date(form.deadlineAt).toISOString()
          : null,
      })
      setForm({ kind: 'endorse', title: '', body: '', deadlineAt: '' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setInviteResult(null)
    try {
      const res = await apiPost('/member/ngo/seats/invite', invite)
      setInviteResult(res)
      setInvite({ email: '', name: '', seatRole: 'representative' })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const revoke = async (id) => {
    try {
      await apiPost(`/member/ngo/seats/${id}/revoke`, {})
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const decideAffiliation = async (id, decision) => {
    try {
      await apiPost(`/member/ngo/affiliations/${id}/decide`, {
        decision,
        seatRole: decisionRole[id] || 'affiliate',
      })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const markDone = async (id) => {
    try {
      const res = await apiPatch(`/member/ngo/requests/${id}`, {
        status: 'done',
      })
      if (res?.awardSuggestion) {
        setAcceptMsg(
          `Marked done. Staff can award ~${res.awardSuggestion.suggestedPoints} pts (${res.awardSuggestion.suggestedReasonLabel}) from the NGO points queue.`,
        )
      }
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const copyLink = async () => {
    if (!inviteResult?.inviteUrl) return
    await navigator.clipboard.writeText(inviteResult.inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <PageHeader
        eyebrow="Organisation"
        title="NGO platform"
        description={`${account?.organizationName || 'Your organisation'} — deadlines, requests, contribution points, and team seats.`}
      />
      {acceptMsg && (
        <p className="meta" style={{ color: 'var(--accent)' }}>
          {acceptMsg}
        </p>
      )}
      {error && <ErrorCard message={error} onRetry={load} />}
      {invitePreview && (
        <div className="card stack" style={{ marginTop: 16 }}>
          <h2>Join {invitePreview.organizationName || 'organisation team'}?</h2>
          <p className="meta">
            This invitation is for {invitePreview.email} with the{' '}
            {invitePreview.seatRole} role.
          </p>
          <Button variant="primary" onClick={acceptInvite}>
            Accept invitation
          </Button>
        </div>
      )}

      {data?.points && (
        <Section label="Contribution points">
          <div className="card">
            <div
              className="rowBetween"
              style={{ alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}
            >
              <div>
                <p className="metaMuted rowGap">
                  <Award size={16} strokeWidth={1.75} aria-hidden /> Recognition
                  ledger
                </p>
                <p
                  className="mono"
                  style={{ fontSize: 32, fontWeight: 600, marginTop: 4 }}
                >
                  {data.points.balance}
                </p>
                <p className="meta">points for verified contributions</p>
              </div>
              <div style={{ maxWidth: 280 }}>
                {data.points.recognition?.current ? (
                  <p className="meta rowGap">
                    <BadgeCheck
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      color="var(--accent)"
                    />
                    <strong>{data.points.recognition.current.label}</strong>
                  </p>
                ) : (
                  <p className="meta">
                    No recognition tier yet — staff awards points after verified
                    badge or UNFCCC submission support.
                  </p>
                )}
                {data.points.recognition?.next && (
                  <p className="metaMuted" style={{ marginTop: 6 }}>
                    {data.points.recognition.pointsToNext} pts to{' '}
                    {data.points.recognition.next.label}
                  </p>
                )}
              </div>
            </div>
            <p className="metaMuted" style={{ marginTop: 12 }}>
              Points are awarded by YOUNGO staff (admins, Focal Points,
              Membership Team) when your organisation supports pool badges,
              endorses documents, or contributes to UNFCCC submissions — not
              self-claimed.
            </p>
            {data.points.recognition?.earned?.length > 0 && (
              <div
                className="rowGap"
                style={{ marginTop: 10, flexWrap: 'wrap' }}
              >
                {data.points.recognition.earned.map((t) => (
                  <span key={t.id} className="chip chip-accent">
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {(data.points.ledger || []).length > 0 && (
            <div className="stackSm" style={{ marginTop: 12 }}>
              {data.points.ledger.map((entry) => (
                <div key={entry.id} className="card cardTight rowBetween">
                  <div>
                    <strong>{entry.title}</strong>
                    <p className="meta">
                      {entry.reasonLabel} ·{' '}
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleDateString()
                        : ''}
                    </p>
                  </div>
                  <span
                    className="mono"
                    style={{
                      color:
                        entry.points > 0 ? 'var(--accent)' : 'var(--danger)',
                      fontWeight: 600,
                    }}
                  >
                    {entry.points > 0 ? `+${entry.points}` : entry.points}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {data && <NgoOpportunities />}

      {data && (
        <Section label="Deadlines for NGOs">
          <div className="stackSm">
            {(data?.deadlines || []).map((d, i) => (
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
              body="Log endorsement or submission requests below."
            />
          ) : (
            data.items.map((r) => (
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
            ))
          )}
        </Section>
      )}

      {data?.permissions?.canWriteRequests && (
        <Section label="Log a request">
          <form className="card stack" onSubmit={create}>
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
              onChange={(kind) => setForm((current) => ({ ...current, kind }))}
              searchPlaceholder="Search request types…"
            >
              <p className="metaMuted" style={{ marginTop: 4 }}>
                Logging a request tracks work; contribution points are awarded
                separately by staff after verification.
              </p>
            </SearchableSelect>
            <label className="field">
              <span>Title</span>
              <input
                className="input"
                required
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="input textarea"
                rows={3}
                value={form.body}
                onChange={(e) =>
                  setForm((f) => ({ ...f, body: e.target.value }))
                }
              />
            </label>
            <DatePicker
              label="Deadline"
              value={form.deadlineAt}
              onChange={(deadlineAt) =>
                setForm((current) => ({ ...current, deadlineAt }))
              }
            />
            <Button type="submit" variant="primary">
              Save request
            </Button>
          </form>
        </Section>
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
                          {s.email} — asked to be listed as part of this
                          organisation.
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
                            onChange={(seatRole) =>
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
                        <p className="metaMuted">
                          An owner of this organisation can decide.
                        </p>
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

            {data.permissions?.canManageSeats && (
              <form
                className="card stack"
                style={{ marginTop: 12 }}
                onSubmit={sendInvite}
              >
                <h3>Invite representative</h3>
                <div className="formRow">
                  <label className="field">
                    <span>Email *</span>
                    <input
                      className="input"
                      type="email"
                      required
                      value={invite.email}
                      onChange={(e) =>
                        setInvite((f) => ({ ...f, email: e.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Name</span>
                    <input
                      className="input"
                      value={invite.name}
                      onChange={(e) =>
                        setInvite((f) => ({ ...f, name: e.target.value }))
                      }
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
                  onChange={(seatRole) =>
                    setInvite((current) => ({ ...current, seatRole }))
                  }
                  searchPlaceholder="Search seat roles…"
                />
                <Button type="submit" variant="primary">
                  <UserPlus size={18} strokeWidth={1.75} aria-hidden />
                  Send invite
                </Button>
              </form>
            )}

            {data.permissions?.canManageSeats && inviteResult && (
              <div className="card cardTight" style={{ marginTop: 12 }}>
                <p className="meta">{inviteResult.note}</p>
                {inviteResult.inviteUrl && (
                  <div
                    className="rowBetween"
                    style={{ marginTop: 8, gap: 8, flexWrap: 'wrap' }}
                  >
                    <code
                      className="mono"
                      style={{ fontSize: 12, wordBreak: 'break-all' }}
                    >
                      {inviteResult.inviteUrl}
                    </code>
                    <Button sm variant="secondary" onClick={copyLink}>
                      {copied ? (
                        <Check size={16} strokeWidth={1.75} aria-hidden />
                      ) : (
                        <Copy size={16} strokeWidth={1.75} aria-hidden />
                      )}
                      {copied ? 'Copied' : 'Copy link'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}
