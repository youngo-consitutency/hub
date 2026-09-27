import { TbBooks as LibraryIcon } from 'react-icons/tb'
import { A, PageHeader, Section } from '../components/ui.jsx'

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

export function Library() {
  return (
    <div>
      <PageHeader
        icon={LibraryIcon}
        title="Member guides"
        description="Practical guides for learning how YOUNGO works and taking part."
      />
      <Section label="Open guides">
        <div className="resourceList">
          {OPEN_GUIDES.map((guide) => (
            <A key={guide.title} href={guide.href} className="resourceRow">
              <span className="resourceCopy">
                <strong>{guide.title}</strong>
                <span className="meta">{guide.body}</span>
              </span>
            </A>
          ))}
        </div>
      </Section>
    </div>
  )
}
