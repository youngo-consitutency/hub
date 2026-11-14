import { ResourceCatalogue } from '../../components/ResourceHub'
import { useDocument } from '../../lib/documents'
import { SitePage } from './SitePage'

export function SiteResources() {
  const { doc: site } = useDocument('site')
  const res = site?.resources
  if (!res) return null
  return (
    <SitePage title={res.title} eyebrow={res.eyebrow ?? 'Resources'} lead={res.lead} art="shelf">
      <div className="siteResourceCatalogue">
        <ResourceCatalogue heading={res.catalogueHeading} />
      </div>
    </SitePage>
  )
}
