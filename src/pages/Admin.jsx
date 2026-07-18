import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { Button, Section, ErrorCard, Skeletons } from '../components/ui.jsx'
import { Shield } from 'lucide-react'

export function Admin() {
  const [items, setItems] = useState(null)
  const [audit, setAudit] = useState([])
  const [error, setError] = useState(null)

  const load = () => {
    setError(null)
    Promise.all([apiGet('/member/admin/accounts'), apiGet('/member/admin/audit?limit=50')])
      .then(([accounts, history]) => { setItems(accounts.items || []); setAudit(history.items || []) })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [])

  const verify = async (id) => {
    await apiPost(`/member/admin/accounts/${id}/verify`, {})
    load()
  }

  const setRole = async (id, role) => {
    await apiPost(`/member/admin/accounts/${id}/role`, { role })
    load()
  }

  const setTeamRole = async (id, teamRole, enabled) => {
    await apiPost(`/member/admin/accounts/${id}/team-role`, { teamRole, enabled })
    load()
  }

  const [resetInfo, setResetInfo] = useState(null)

  const issueReset = async (id) => {
    try {
      const res = await apiPost(`/member/admin/accounts/${id}/reset-link`, {})
      setResetInfo(res)
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <ErrorCard message={error} onRetry={load} />
  if (!items) return <Skeletons n={5} />

  const individuals = items.filter((a) => a.entityType === 'individual')
  const orgs = items.filter((a) => a.entityType === 'organization')

  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>Staff</p>
      <h1 className="rowGap"><Shield size={24} strokeWidth={1.75} aria-hidden /> Admin</h1>
      <p className="meta" style={{ marginTop: 6 }}>
        All members and NGOs (no passwords). Set <code className="mono">ADMIN_EMAILS</code> on Railway to grant admin.
      </p>

      {resetInfo && (
        <div className="card cardTight" style={{ marginBottom: 16 }}>
          <h3>Password reset link for {resetInfo.email}</h3>
          <p className="meta" style={{ marginTop: 4 }}>Expires {new Date(resetInfo.expiresAt).toLocaleString()} · one-time use</p>
          <code className="mono" style={{ fontSize: 12, wordBreak: 'break-all', display: 'block', marginTop: 8 }}>{resetInfo.resetUrl}</code>
          <div className="detailActions">
            <Button sm variant="secondary" onClick={() => navigator.clipboard.writeText(resetInfo.resetUrl)}>Copy link</Button>
            <Button sm variant="ghost" onClick={() => setResetInfo(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <Section label={`Individuals (${individuals.length})`}>
        <div className="stackSm">
          {individuals.map((a) => (
            <div key={a.id} className="card cardTight">
              <div className="rowBetween">
                <div>
                  <strong>{a.name}</strong>
                  <p className="meta">{a.email} · {a.memberStatus} · {a.role} · {a.country}</p>
                  {a.wgInterests?.length > 0 && (
                    <p className="metaMuted">WGs: {a.wgInterests.join(', ')}</p>
                  )}
                </div>
                <div className="rowGap">
                  {a.memberStatus !== 'verified' && (
                    <Button sm variant="secondary" onClick={() => verify(a.id)}>Verify</Button>
                  )}
                  <Button sm variant="ghost" onClick={() => issueReset(a.id)}>Reset password</Button>
                  <Button sm variant="ghost" onClick={() => setRole(a.id, 'member')}>Member</Button>
                  <Button sm variant={a.role === 'focal_point' ? 'secondary' : 'ghost'} onClick={() => setRole(a.id, 'focal_point')}>Focal Point</Button>
                </div>
              </div>
              <div className="rowGap" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <Button sm variant={a.teamRoles?.includes('membership_team') ? 'secondary' : 'ghost'} onClick={() => setTeamRole(a.id, 'membership_team', !a.teamRoles?.includes('membership_team'))}>Membership Team</Button>
                <Button sm variant={a.teamRoles?.includes('gys_policy_team') ? 'secondary' : 'ghost'} onClick={() => setTeamRole(a.id, 'gys_policy_team', !a.teamRoles?.includes('gys_policy_team'))}>GYS Policy Team</Button>
                <span className="metaMuted">WG Contact Points are assigned inside a specific WG workspace.</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label={`Organisations (${orgs.length})`}>
        <div className="stackSm">
          {orgs.map((a) => (
            <div key={a.id} className="card cardTight">
              <strong>{a.organizationName || a.name}</strong>
              <p className="meta">
                {a.email} · {a.organizationType} · admitted={String(a.isUnfcccAdmitted)} · {a.memberStatus}
              </p>
              <div className="rowGap" style={{ marginTop: 8 }}>
                {a.memberStatus !== 'verified' && (
                  <Button sm variant="secondary" onClick={() => verify(a.id)}>Verify</Button>
                )}
                <Button sm variant="ghost" onClick={() => setRole(a.id, 'ngo_admin')}>NGO admin</Button>
                <a className="btn btn-ghost btn-sm" href="/staff/points">Award points</a>
              </div>
            </div>
          ))}
        </div>
      </Section>
      <p className="metaMuted" style={{ marginTop: 8 }}>
        Contribution points for badge support and UNFCCC submissions are managed at{' '}
        <a className="inlineLink" href="/staff/points">/staff/points</a>.
      </p>

      <Section label="Governance audit (latest 50)">
        <div className="stackSm">
          {audit.map((entry) => <div key={entry.id || `${entry.createdAt}-${entry.action}`} className="card cardTight rowBetween"><div><strong>{entry.action}</strong><p className="meta">{entry.target_type || entry.targetType}: {entry.target_id || entry.targetId || '—'} · {entry.actor_email || entry.actorId || 'system'}</p></div><time className="metaMuted">{new Date(entry.created_at || entry.createdAt).toLocaleString()}</time></div>)}
          {!audit.length && <p className="metaMuted">No audited governance changes yet.</p>}
        </div>
      </Section>
    </div>
  )
}
