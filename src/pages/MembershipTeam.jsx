import { useState } from 'react'
import { apiPatch, useApi } from '../lib/api.js'
import { Async, Button, Empty, ErrorCard, Section } from '../components/ui.jsx'
import { ClipboardCheck, Clock3, RefreshCw, Search, ShieldCheck, UserCheck } from 'lucide-react'

const STATUS_LABELS = {
  registered: 'Registered', course_passed: 'Course passed', awaiting_onboarding: 'Awaiting onboarding',
  active: 'Active member', renewal_due: 'Renewal due', expired: 'Expired', terminated: 'Terminated',
}

export function MembershipTeam() {
  const query = useApi('/member/team/membership/overview')
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  const setStatus = async (id, status) => {
    setBusy(id)
    try { setActionError(null); await apiPatch(`/member/team/membership/accounts/${id}/status`, { status }); query.retry() }
    catch (error) { setActionError(error.message) }
    finally { setBusy(null) }
  }

  return (
    <div>
      <p className="eyebrow">Member lifecycle</p>
      <h1>Membership Team</h1>
      <p className="meta pageIntro">Move applications from registration through onboarding, activation, renewal, and offboarding.</p>
      <Async query={query} skeletons={5}>
        {(data) => {
          const active = data.items.filter((item) => item.membershipStatus === 'active')
          const pending = data.items.filter((item) => item.membershipStatus !== 'active')
          const shown = data.items.filter((item) => {
            const stateMatch = filter === 'all' || (filter === 'pending' ? item.membershipStatus !== 'active' : item.membershipStatus === 'active')
            const text = `${item.name} ${item.email} ${item.country || ''} ${item.organizationName || ''}`.toLowerCase()
            return stateMatch && text.includes(search.toLowerCase())
          })
          return <>
            <div className="metricGrid">
              <div className="metricCard"><Clock3 size={18} aria-hidden /><strong>{pending.length}</strong><span>need lifecycle action</span></div>
              <div className="metricCard"><UserCheck size={18} aria-hidden /><strong>{active.length}</strong><span>active members</span></div>
              <div className="metricCard"><RefreshCw size={18} aria-hidden /><strong>{data.items.filter((item) => item.membershipStatus === 'renewal_due').length}</strong><span>renewals due</span></div>
            </div>
            <Section label="Application queue">
              {actionError && <ErrorCard message={actionError} />}
              <div className="queueToolbar">
                <div className="pillRow" aria-label="Filter applications">{['pending', 'verified', 'all'].map((item) => <button key={item} className={`pill ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>{item === 'verified' ? 'Active' : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
                <label className="queueSearch"><Search size={16} aria-hidden /><span className="srOnly">Search members</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search members" /></label>
              </div>
              {!shown.length ? <Empty icon={ClipboardCheck} title="No applications in this view" /> : <div className="stackSm">{shown.map((item) => (
                <div key={item.id} className="card cardTight queueRow">
                  <div className="queueIdentity">
                    <strong>{item.name}</strong>
                    <p className="meta">{item.email} · {item.country || 'Country not set'}</p>
                    <div className="rowGap" style={{ marginTop: 6 }}><span className={`taskState ${item.membershipStatus === 'active' ? 'taskState-complete' : 'taskState-review'}`}>{STATUS_LABELS[item.membershipStatus] || item.membershipStatus}</span><span className="chip chip-neutral">Hub: {item.hubAccessStatus}</span>{item.teamRoles?.map((role) => <span key={role} className="chip chip-neutral">{role.replaceAll('_', ' ')}</span>)}</div>
                  </div>
                  <label className="meta">Membership status<select disabled={busy === item.id} value={item.membershipStatus} onChange={(event) => setStatus(item.id, event.target.value)} style={{ display: 'block', marginTop: 4 }}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  {item.membershipStatus !== 'active' && <Button sm variant="primary" disabled={busy === item.id} onClick={() => setStatus(item.id, 'active')}><ShieldCheck size={16} aria-hidden />{busy === item.id ? 'Saving…' : 'Activate'}</Button>}
                </div>
              ))}</div>}
            </Section>
          </>
        }}
      </Async>
    </div>
  )
}
