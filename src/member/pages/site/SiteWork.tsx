import { TbGlobe as Globe, TbMapPin as MapPin, TbUsers as Users } from 'react-icons/tb'
import { useApi } from '../../lib/api'
import { useDocument } from '../../lib/documents'
import { regionKey } from '../../lib/regions'
import { ConferencesSection } from './SiteCoy'
import { StatementSection } from './SiteGys'
import { SitePage } from './SitePage'
import { WorkingGroupsSection } from './SiteWorkingGroups'

// where the policy work happens: the groups, the conferences and the statement they produce
export function SiteWork() {
  const { doc: site } = useDocument('site')
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
    >
      <WorkingGroupsSection />
      <ConferencesSection />
      <StatementSection />
    </SitePage>
  )
}
