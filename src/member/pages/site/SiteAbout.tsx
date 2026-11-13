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
  return (
    <SitePage
      title="About YOUNGO"
      lead="How the constituency is organised, answers to common questions, and where to get in touch."
      motif="arcs"
      sections={SECTIONS}
    >
      <OrganisationSection />
      <FaqSection />
      <ContactSection />
    </SitePage>
  )
}
