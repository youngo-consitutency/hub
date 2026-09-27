import { ResourceCatalogue } from '../../components/ResourceHub.jsx'
import {
  TbBook2 as BookOpen,
  TbChevronRight as ChevronRight,
} from 'react-icons/tb'

export function SiteResources() {
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">Open climate knowledge</p>
        <h1>Resources</h1>
        <p className="sitePageLead">
          Explore climate resources for climate work, research, learning, and
          funding. The catalogue is public; YOUNGO members can suggest additions
          for independent review. Each listing shows whether its link has been
          checked.
        </p>
      </header>
      <div className="siteResourceCatalogue">
        <ResourceCatalogue heading="Public catalogue" />
      </div>
      <section className="siteCtaBand card">
        <BookOpen size={24} strokeWidth={1.75} aria-hidden />
        <div>
          <h2>Know a useful resource?</h2>
          <p className="meta">
            Verified members can suggest resources for review.
          </p>
        </div>
        <a className="btn btn-primary" href="/resources">
          Suggest a resource
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </a>
      </section>

    </div>
  )
}
