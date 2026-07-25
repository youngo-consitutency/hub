import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { useApi } from '../lib/api.js'
import { A, Button, Async, Section, Empty, ErrorCard, PageHeader } from '../components/ui.jsx'
import { WG_ACTIVITY_KINDS } from '../../shared/workflows.js'

export function CpManage({ slug }) {
  const groups = useApi('/groups')
  const [members, setMembers] = useState([])
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ kind: 'call', title: '', body: '', startsAt: '' })
  const [msg, setMsg] = useState(null)

  const load = () => {
    setError(null)
    apiGet(`/member/cp/${encodeURIComponent(slug)}/members`)
      .then((d) => setMembers(d.items || []))
      .catch((e) => setError(e.message))
  }

  useEffect(() => { load() }, [slug])

  const setRole = async (accountId, role, status) => {
    try {
      await apiPost(`/member/cp/${encodeURIComponent(slug)}/members/${accountId}/role`, { role, status })
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

  return (
    <div>
      <A href="/groups" className="backLink">← Groups</A>
      <Async query={groups} skeletons={2}>
        {(g) => {
          const group = (g.items || []).find((x) => x.slug === slug)
          return (
            <>
              <PageHeader
                eyebrow="Contact Point console"
                title={group?.name || slug}
                description="Review joiners, assign WG roles, and register activities."
              />
              {error && <ErrorCard message={error} onRetry={load} />}
              {msg && <p className="meta" style={{ color: 'var(--accent)' }}>{msg}</p>}

              <Section label="Recent members">
                {members.length === 0
                  ? <Empty title="No joiners yet" body="When members unlock this workspace they appear here." />
                  : members.map((m) => (
                    <div key={`${m.account_id}-${m.wg_slug}`} className="card cardTight rowBetween">
                      <div>
                        <strong>{m.name || m.email}</strong>
                        <p className="meta">{m.email} · {m.status} · {m.role_in_wg}</p>
                      </div>
                      <div className="rowGap">
                        <Button sm variant="secondary" onClick={() => setRole(m.account_id, 'member', 'active')}>Approve</Button>
                        <Button sm variant="ghost" onClick={() => setRole(m.account_id, 'contact', 'active')}>Make CP</Button>
                        <Button sm variant="ghost" onClick={() => setRole(m.account_id, 'member', 'rejected')}>Reject</Button>
                      </div>
                    </div>
                  ))}
              </Section>

              <Section label="Register activity">
                <form className="card stack" onSubmit={addActivity}>
                  <label className="field">
                    <span>Kind</span>
                    <select className="input" value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                      {WG_ACTIVITY_KINDS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Title</span>
                    <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
                  </label>
                  <label className="field">
                    <span>Details</span>
                    <textarea className="input textarea" rows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
                  </label>
                  <label className="field">
                    <span>Starts (optional)</span>
                    <input className="input" type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
                  </label>
                  <Button type="submit" variant="primary">Add activity</Button>
                </form>
              </Section>
            </>
          )
        }}
      </Async>
    </div>
  )
}
