import { Home } from '../../../member/pages/Home'
import { publicPage } from '../seo'

export const metadata = publicPage('/')

export default function Page() {
  return <Home />
}
