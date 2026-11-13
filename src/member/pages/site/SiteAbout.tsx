import { useDocument } from '../../lib/documents'
import { OrganisationSection } from '../../features/platform/PublicPlatform'
import { ContactSection } from './SiteContact'
import { FaqSection } from './SiteFaq'
import { SitePage, type PageSection } from './SitePage'

const SECTIONS: PageSection[] = [
  { id: 'organisation', label: 'Organisation' },
  { id: 'faq', label: 'Questions' },
  { id: 'contact', label: 'Contact' },
]

// who YOUNGO is, the questions people ask, and where to write
export function SiteAbout() {
  const { doc: site } = useDocument('site')
  const about = site?.about
  return (
    <SitePage
      title={about?.title ?? 'About YOUNGO'}
      lead={about?.lead}
      motif="arcs"
      sections={SECTIONS}
    >
      <OrganisationSection />
      <FaqSection />
      <ContactSection />
    </SitePage>
  )
}
