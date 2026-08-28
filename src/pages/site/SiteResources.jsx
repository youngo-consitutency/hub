import { ResourceCatalogue } from '../../components/ResourceHub.jsx'
import { A } from '../../components/ui.jsx'
import {
  TbBook2 as BookOpen,
  TbChevronRight as ChevronRight,
} from 'react-icons/tb'

export function SiteResources() {
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">Open climate knowledge</p>
        <h1>Science Resource Hub</h1>
        <p className="sitePageLead">
          Explore reviewed resources for climate work, research, learning, and
          funding. The catalogue is public; YOUNGO members can suggest additions
          for independent review.
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
            Sign in as a verified member to send it to the Content Publisher
            review queue. Drafts are never shown publicly.
          </p>
        </div>
        <a className="btn btn-primary" href="/resources">
          Suggest a resource
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </a>
      </section>
      <p className="metaMuted sitePageFootnote">
        Looking for YOUNGO processes instead? Visit the{' '}
        <A href="/about/gys" className="inlineLink">
          Global Youth Statement
        </A>{' '}
        or{' '}
        <A href="/about/coy" className="inlineLink">
          Conference of Youth
        </A>{' '}
        pages.
      </p>
    </div>
  )
}
