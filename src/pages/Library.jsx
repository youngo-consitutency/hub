import { A, Section } from '../components/ui.jsx'
import { Library as LibIcon } from 'lucide-react'
import { COURSE_MODULES } from '../content/membershipCourse.js'

const OPEN_GUIDES = [
  {
    title: 'How YOUNGO works (overview)',
    body: 'Constituency structure, Network vs Constituency Work, and where decisions are made.',
    href: '/onboarding/course',
  },
  {
    title: 'Working Group engagement',
    body: 'Join a WG, complete workspace onboarding, then use WhatsApp and CP contacts responsibly.',
    href: '/groups',
  },
  {
    title: 'Membership Policy (mandate)',
    body: 'Who can join, rights, renewal, and end of membership — required first-visit read.',
    href: '/onboarding',
  },
  {
    title: 'Workflows (draft)',
    body: 'What is done by whom after registration, course pass, WG join, and CP approvals — expand with RACI.',
    href: '/onboarding',
  },
]

export function Library() {
  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>Capacity Building</p>
      <h1 className="rowGap"><LibIcon size={24} strokeWidth={1.75} aria-hidden /> Library</h1>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        Open-access guides for coordination and learning. The graded membership course remains under Onboarding.
      </p>

      <Section label="Open guides">
        <div className="stack">
          {OPEN_GUIDES.map((g) => (
            <A key={g.title} href={g.href} className="card">
              <h3>{g.title}</h3>
              <p className="meta" style={{ marginTop: 4 }}>{g.body}</p>
            </A>
          ))}
        </div>
      </Section>

      <Section label="Course modules (preview)">
        <div className="grid2">
          {COURSE_MODULES.map((m) => (
            <div key={m.id} className="card cardTight">
              <h3>{m.title}</h3>
              <p className="metaMuted" style={{ marginTop: 4 }}>~{m.minutes} min</p>
              <p className="meta" style={{ marginTop: 6 }}>{m.body[0]}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
