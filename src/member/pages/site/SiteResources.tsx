import { TbBook as BookOpen } from 'react-icons/tb'
import { ResourceCatalogue } from '../../components/ResourceHub'
import { useDocument } from '../../lib/documents'
import { SiteCtaBand, SitePage } from './SitePage'

export function SiteResources() {
  const { doc: site } = useDocument('site')
  const res = site?.resources
  if (!res) return null
  const cta = res.cta || {}
  return (
    <SitePage title={res.title} eyebrow={res.eyebrow} lead={res.lead} motif="grid">
      <div className="siteResourceCatalogue">
        <ResourceCatalogue heading={res.catalogueHeading} />
      </div>
      <SiteCtaBand
        icon={BookOpen}
        title={cta.title}
        body={cta.body}
        label={cta.label}
        href="/resources"
      />
    </SitePage>
  )
}
