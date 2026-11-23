import { loadPublicDocuments } from '../../../lib/publicDocuments'
import { MemberProviders } from './MemberProviders'

// The public pages are prerendered with their CMS copy; edits reach them within a minute.
export const revalidate = 60

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  return <MemberProviders documents={await loadPublicDocuments()}>{children}</MemberProviders>
}
