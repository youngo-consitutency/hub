// Component gallery — Phase 0 gate: proves every component renders in both themes.
import { Button, StatusChip, CountdownChip, Empty, Skeletons } from '../components/ui.jsx'
import { EventCard, SubmissionCard, DecisionCard, CoyCard, GroupCard } from '../components/cards.jsx'
import { CalendarOff } from 'lucide-react'

const now = Date.now()
const at = (h) => new Date(now + h * 3600000).toISOString()

const STATUSES = ['live_now', 'open', 'drafting', 'internal_review', 'submitted', 'registration_open', 'applications_open', 'announced', 'concluded', 'proposed', 'open_for_input', 'objection_window', 'adopted', 'not_adopted', 'withdrawn']

export function Gallery() {
  return (
    <div className="stack">
      <h1>Component gallery</h1>
      <p className="meta">Toggle the theme (sidebar / top bar) — every token and component must hold in both.</p>

      <section>
        <div className="sectionLabel"><span>Buttons</span></div>
        <div className="rowGap">
          <Button variant="primary">Primary</Button>
          <Button variant="primary" glow>Primary glow</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary" sm>Small</Button>
        </div>
      </section>

      <section>
        <div className="sectionLabel"><span>Status chips</span></div>
        <div className="rowGap">{STATUSES.map((s) => <StatusChip key={s} status={s} />)}</div>
      </section>

      <section>
        <div className="sectionLabel"><span>Countdown chips</span></div>
        <div className="rowGap">
          <CountdownChip iso={at(24 * 10)} />
          <CountdownChip iso={at(24 * 3 + 6)} />
          <CountdownChip iso={at(26)} />
          <CountdownChip iso={at(0.7)} />
        </div>
      </section>

      <section>
        <div className="sectionLabel"><span>Cards</span></div>
        <div className="stackSm">
          <EventCard event={{ slug: 'x', title: 'Constituency call', type: 'constituency_call', startsAt: at(26), wg: null }} />
          <SubmissionCard sub={{ slug: 'x', title: 'Call for input: ACE dialogue topics', status: 'drafting', deadlineAt: at(40), wg: { name: 'ACE' } }} />
          <DecisionCard decision={{ slug: 'x', title: 'Adopt social media policy', status: 'objection_window', objectionDeadline: at(70), summary: 'Codifies who can post from constituency accounts.', proposer: 'Focal points' }} />
          <CoyCard coy={{ slug: 'x', type: 'lcoy', title: 'LCOY Kenya 2026', city: 'Nairobi', country: 'Kenya', startsOn: '2026-09-12', endsOn: '2026-09-14', status: 'registration_open' }} />
          <GroupCard group={{ slug: 'x', name: 'ACE', monogram: 'AC', focusLine: 'Action for Climate Empowerment', cadenceNote: 'Biweekly Thursdays 15:00 UTC', whatsappUrl: '#', groupUrl: '#' }} />
        </div>
      </section>

      <section>
        <div className="sectionLabel"><span>Empty state</span></div>
        <Empty icon={CalendarOff} title="Nothing scheduled this week" body="Subscribe and you’ll never miss a call." />
      </section>

      <section>
        <div className="sectionLabel"><span>Loading skeletons</span></div>
        <Skeletons n={3} />
      </section>
    </div>
  )
}
