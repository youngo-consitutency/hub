import { A, Section } from '../components/ui.jsx'
import { ExternalLink, FolderOpen, Library as LibIcon } from 'lucide-react'
import { COURSE_MODULES } from '../content/membershipCourse.js'
import {
  OFFICIAL_POLICIES,
  POLICIES_FOLDER,
  POLICY_CATEGORIES,
  policiesInCategory,
} from '../content/policies.js'

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

function ExternalCard({ title, body, href, meta }) {
  return (
    <a
      href={href}
      className="card"
      target="_blank"
      rel="noopener noreferrer"
    >
      <h3 className="rowGap" style={{ alignItems: 'flex-start' }}>
        <span style={{ flex: 1 }}>{title}</span>
        <ExternalLink size={14} strokeWidth={1.75} aria-hidden style={{ flexShrink: 0, marginTop: 3, opacity: 0.7 }} />
      </h3>
      {body ? <p className="meta" style={{ marginTop: 4 }}>{body}</p> : null}
      {meta ? <p className="metaMuted" style={{ marginTop: 6 }}>{meta}</p> : null}
    </a>
  )
}

export function Library() {
  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>Capacity Building</p>
      <h1 className="rowGap"><LibIcon size={24} strokeWidth={1.75} aria-hidden /> Library</h1>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        Open-access guides plus the official YOUNGO Policies & Guidelines folder on Drive.
        Canonical legal text stays in Drive — the hub points you there.
      </p>

      <Section
        label="Official policies"
        action={
          <a
            className="btn btn-secondary btn-sm"
            href={POLICIES_FOLDER.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FolderOpen size={14} strokeWidth={1.75} aria-hidden />
            Open full folder
          </a>
        }
      >
        <div className="card cardTight" style={{ marginBottom: 12 }}>
          <p className="meta" style={{ margin: 0 }}>
            Source:{' '}
            <a href={POLICIES_FOLDER.href} target="_blank" rel="noopener noreferrer">
              {POLICIES_FOLDER.title}
            </a>
            {' · '}
            <a
              href={POLICIES_FOLDER.translationsFolder.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              Translations
            </a>
            {' · '}
            {OFFICIAL_POLICIES.length} core English documents indexed below.
          </p>
        </div>

        {POLICY_CATEGORIES.map((cat) => {
          const docs = policiesInCategory(cat.id)
          if (!docs.length) return null
          return (
            <div key={cat.id} style={{ marginBottom: 16 }}>
              <p className="metaMuted" style={{ marginBottom: 8 }}>{cat.label}</p>
              <div className="stack">
                {docs.map((doc) => (
                  <ExternalCard
                    key={doc.id}
                    title={doc.title}
                    body={doc.note}
                    href={doc.href}
                    meta={[doc.year ? String(doc.year) : null, doc.kind === 'pdf' ? 'PDF' : doc.kind === 'image' ? 'Image' : 'Google Doc']
                      .filter(Boolean)
                      .join(' · ')}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </Section>

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
