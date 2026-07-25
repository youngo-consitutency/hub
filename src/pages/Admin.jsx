import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { Button, Section, ErrorCard, Skeletons } from '../components/ui.jsx'
import { Shield } from 'lucide-react'

export function Admin() {
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    setError(null)
    apiGet('/member/admin/accounts')
      .then((d) => setItems(d.items || []))
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
        All members and NGOs (no passwords). Administrator promotion is an explicit operator command; WG roles are scoped inside each WG console.
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
                </div>
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
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
