import { useState } from 'react'
import { apiPatch, apiPost, useApi } from '../lib/api.js'
import { A, Async, Button, Empty, ErrorCard, Section, StatusChip } from '../components/ui.jsx'
import { PenTool, Inbox, Layers3, MessagesSquare, CheckCircle2, ArrowRight } from 'lucide-react'

const NEXT = { submitted: ['triaged', 'rejected'], triaged: ['drafting', 'rejected'], drafting: ['needs_review'], needs_review: ['drafting', 'approved', 'rejected'], approved: ['published', 'drafting'], rejected: ['triaged'], published: [] }

export function GysPolicyTeam() {
  const query = useApi('/member/team/gys/overview')
  const [draft, setDraft] = useState({ title: '', body: '', theme: '' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const create = async (event) => {
    event.preventDefault(); setBusy(true)
    try { setActionError(null); await apiPost('/member/team/gys/contributions', draft); setDraft({ title: '', body: '', theme: '' }); query.retry() }
    catch (error) { setActionError(error.message) }
    finally { setBusy(false) }
  }
  const move = async (id, status) => {
    setBusy(true)
    try { setActionError(null); await apiPatch(`/member/team/gys/contributions/${id}`, { status }); query.retry() }
    catch (error) { setActionError(error.message) }
    finally { setBusy(false) }
  }
  return (
    <div>
      <p className="eyebrow">Policy production</p>
      <h1>Global Youth Statement</h1>
      <p className="meta pageIntro">Turn youth inputs into a reviewed, negotiation-ready statement with a visible handover.</p>
      <Async query={query} skeletons={5}>
        {(data) => <>
          <div className="cycleBanner card"><div><span className="taskState taskState-review">Active cycle</span><h2 style={{ marginTop: 8 }}>{data.current?.title || 'Global Youth Statement'}</h2><p className="meta" style={{ marginTop: 4 }}>{data.current?.tagline || data.current?.status}</p></div><A href="/gys" className="btn btn-secondary">View public statement <ArrowRight size={16} aria-hidden /></A></div>
          <div className="metricGrid">
            <div className="metricCard"><Inbox size={18} aria-hidden /><strong>{data.contributions?.length || 0}</strong><span>tracked contributions</span></div>
            <div className="metricCard"><MessagesSquare size={18} aria-hidden /><strong>{data.decisions.length}</strong><span>active consultations</span></div>
            <div className="metricCard"><Layers3 size={18} aria-hidden /><strong>{data.process.length}</strong><span>production stages</span></div>
          </div>
          <Section label="Production cycle"><ol className="workflowSteps">{data.process.map((step, index) => <li key={step.step} className={index === 0 ? 'active' : ''}><span>{index + 1}</span><div><strong>{step.step}</strong><p className="meta">{step.body}</p></div></li>)}</ol></Section>
          <Section label="Contribution workflow">
            {actionError && <ErrorCard message={actionError} />}
            <form className="card cardTight stackSm" onSubmit={create}>
              <div className="formGrid"><label>Title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>Theme<input value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value })} /></label></div>
              <label>Contribution<textarea required rows="3" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
              <div><Button sm variant="primary" disabled={busy}>Add contribution</Button></div>
            </form>
            {!data.contributions?.length ? <Empty icon={PenTool} title="No tracked contributions yet" /> : <div className="stackSm" style={{ marginTop: 12 }}>{data.contributions.map((item) => <div key={item.id} className="card cardTight queueRow"><div><strong>{item.title}</strong><p className="meta">{item.theme || 'No theme'} · version {item.version}</p></div><div className="rowGap"><StatusChip status={item.status} /><select disabled={busy || !NEXT[item.status]?.length} value={item.status} onChange={(event) => move(item.id, event.target.value)} aria-label={`Change status for ${item.title}`}><option value={item.status}>{item.status.replaceAll('_', ' ')}</option>{NEXT[item.status]?.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div></div>)}</div>}
          </Section>
          <Section label="Open public inputs">{!data.submissions.length ? <Empty icon={PenTool} title="No open inputs" /> : <div className="stackSm">{data.submissions.map((item) => <A key={item.slug} href={`/submissions/${item.slug}`} className="card cardTight queueRow"><div><strong>{item.title}</strong><p className="meta">{item.wg?.name || 'Cross-constituency input'}</p></div><StatusChip status={item.status} /></A>)}</div>}</Section>
          <Section label="Handover readiness"><div className="card cardTight rowGap"><CheckCircle2 size={20} color="var(--accent)" aria-hidden /><div><strong>Authorship and review are traceable</strong><p className="meta">Each contribution records author, reviewer, version, status changes, and approval decisions.</p></div></div></Section>
        </>}
      </Async>
    </div>
  )
}
