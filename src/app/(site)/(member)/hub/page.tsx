import type { Metadata } from 'next'
import { HubRoutes } from '../../../../member/hub/HubRoutes'

// the signed-in app: nothing in it is for search engines
export const metadata: Metadata = { title: 'YOUNGO Hub', robots: { index: false, follow: false } }

export default function Page() {
  return <HubRoutes />
}
