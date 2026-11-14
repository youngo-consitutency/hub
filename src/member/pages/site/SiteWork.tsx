import { TbGlobe as Globe, TbMapPin as MapPin, TbUsers as Users } from 'react-icons/tb'
import { useApi } from '../../lib/api'
import { useDocument } from '../../lib/documents'
import { regionKey } from '../../lib/regions'
import { ConferencesSection } from './SiteCoy'
import { StatementSection } from './SiteGys'
import { SiteCtaBand, SitePage, type PageSection } from './SitePage'
import { WorkingGroupsSection } from './SiteWorkingGroups'

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
  // the numbers come from the same public lists the sections below use
  const groups = useApi('/groups').data?.items ?? []
  const conferences = useApi('/coys').data?.items ?? []
  const regions = new Set(
    conferences.map((coy: { region?: string }) => regionKey(coy.region)).filter(Boolean),
  )
  return (
    <SitePage
      eyebrow={work?.eyebrow ?? 'What we do'}
      title={work?.title ?? 'Our work'}
      lead={work?.lead}
      art="network"
      facts={[
        { icon: Users, value: groups.length, label: 'Working groups' },
        { icon: MapPin, value: conferences.length, label: 'Conferences of Youth' },
        { icon: Globe, value: regions.size, label: 'World regions' },
      ]}
      sections={SECTIONS}
    >
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
