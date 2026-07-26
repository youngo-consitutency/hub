import { A, Section, PageHeader } from '../components/ui.jsx'
import { ExternalLink, FolderOpen } from 'lucide-react'
import {
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
    body: 'Join a working group, read its introduction, and use its channels and Contact Point details responsibly.',
    href: '/groups',
  },
  {
    title: 'Membership Policy',
    body: 'Who can join, member rights, renewal, and how membership ends.',
    href: '/onboarding',
  },
  {
    title: 'Member workflows',
    body: 'What happens after registration, course completion, working-group onboarding, and Contact Point approval.',
    href: '/onboarding',
  },
]

function ExternalRow({ title, body, href, meta }) {
  return (
    <a
      href={href}
      className="resourceRow"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="resourceCopy">
        <strong>{title}</strong>
        {body && <span className="meta">{body}</span>}
      </span>
      <span className="resourceMeta">
        {meta && <span className="metaMuted">{meta}</span>}
        <ExternalLink size={14} strokeWidth={1.75} aria-hidden />
      </span>
    </a>
  )
}

export function Library() {
  return (
    <div>
      <PageHeader
        eyebrow="Capacity building"
        title="Library"
        description="Official policies and practical guides for YOUNGO members."
      />

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
        {POLICY_CATEGORIES.map((cat) => {
          const docs = policiesInCategory(cat.id)
          if (!docs.length) return null
          return (
            <div key={cat.id} className="libraryCategory">
              <h3 className="libraryCategoryTitle">{cat.label}</h3>
              <div className="resourceList">
                {docs.map((doc) => (
                  <ExternalRow
                    key={doc.id}
                    title={doc.title}
                    body={doc.note}
                    href={doc.href}
                    meta={[
                      doc.year ? String(doc.year) : null,
                      doc.kind === 'pdf'
                        ? 'PDF'
                        : doc.kind === 'image'
                          ? 'Image'
                          : 'Google Doc',
                    ]
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
        <div className="resourceList">
          {OPEN_GUIDES.map((g) => (
            <A key={g.title} href={g.href} className="resourceRow">
              <span className="resourceCopy">
                <strong>{g.title}</strong>
                <span className="meta">{g.body}</span>
              </span>
            </A>
          ))}
        </div>
      </Section>
    </div>
  )
}
