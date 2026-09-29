import { ResourceCatalogue } from '../../components/ResourceHub.jsx'
import { TbBook2 as BookOpen, TbChevronRight as ChevronRight } from 'react-icons/tb'
import { Skeletons } from '../../components/ui.jsx'
import { useDocument } from '../../lib/documents.js'

export function SiteResources() {
  const { doc: site, loading } = useDocument('site')
  const res = site?.resources
  if (!res) return loading ? <Skeletons n={3} /> : null
  const cta = res.cta || {}
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">{res.eyebrow}</p>
        <h1>{res.title}</h1>
        <p className="sitePageLead">{res.lead}</p>
      </header>
      <div className="siteResourceCatalogue">
        <ResourceCatalogue heading={res.catalogueHeading} />
      </div>
      <section className="siteCtaBand card">
        <BookOpen size={24} strokeWidth={1.75} aria-hidden />
        <div>
          <h2>{cta.title}</h2>
          <p className="meta">{cta.body}</p>
        </div>
        <a className="btn btn-primary" href="/resources">
          {cta.label}
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </a>
      </section>
    </div>
  )
}
