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
      <p className="siteResourceNote">
        <strong>How we check links.</strong> A Content Publisher opens each link, confirms it works
        and that the description and tags are right, then marks it checked. A report from a member
        removes the mark until it is resolved, and a check older than a year lapses.
      </p>
    </SitePage>
  )
}
