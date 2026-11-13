import { TbUsers as Users } from 'react-icons/tb'
import { useDocument } from '../../lib/documents'
import { ConferencesSection } from './SiteCoy'
import { StatementSection } from './SiteGys'
import { SiteCtaBand, SitePage, type PageSection } from './SitePage'
import { WorkingGroupsSection } from './SiteWorkingGroups'
import { WorkReach } from './WorkReach'

const SECTIONS: PageSection[] = [
  { id: 'working-groups', label: 'Working groups' },
  { id: 'conferences', label: 'Conferences' },
  { id: 'statement', label: 'Global Youth Statement' },
]

// where the policy work happens: the groups, the conferences and the statement they produce
export function SiteWork() {
  const { doc: site } = useDocument('site')
  const cta = site?.workingGroups?.cta
  const work = site?.work
  return (
    <SitePage title={work?.title ?? 'Our work'} lead={work?.lead} motif="rings" sections={SECTIONS}>
      <WorkReach />
      <WorkingGroupsSection />
      <ConferencesSection />
      <StatementSection />
      {cta && (
        <SiteCtaBand
          icon={Users}
          title={cta.title}
          body={cta.body}
          label={cta.label}
          href="/join"
        />
      )}
    </SitePage>
  )
}
