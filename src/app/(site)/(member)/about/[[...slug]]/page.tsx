import { publicPage } from '../../../seo'

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params
  return publicPage(slug?.length ? `/about/${slug.join('/')}` : '/about')
}

// AccessGate renders this path's pre-auth surface; the page is a placeholder.
export default function Page() {
  return null
}
