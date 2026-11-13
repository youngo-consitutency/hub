import { TbFileOff as FileOff } from 'react-icons/tb'
import { A } from '../../components/ui'

// a reviewed public page that a publisher withdrew; nothing stale is shown
export function PageWithdrawn() {
  return (
    <div className="card siteWithdrawn" role="status">
      <FileOff size={22} strokeWidth={1.75} aria-hidden />
      <div>
        <h3>This page is temporarily unpublished</h3>
        <p className="meta">
          The team is updating it. In the meantime, see{' '}
          <A href="/our-work" className="inlineLink">
            our work
          </A>{' '}
          or sign in to the Hub.
        </p>
      </div>
    </div>
  )
}
