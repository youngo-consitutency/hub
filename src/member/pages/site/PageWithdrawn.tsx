import { TbFileOff as FileOff } from 'react-icons/tb'
import { A } from '../../components/ui'

// A reviewed public page that a publisher withdrew; nothing stale is shown.
export function PageWithdrawn({ title }: { title?: string }) {
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <h1>{title}</h1>
      </header>
      <section className="card siteWithdrawn" role="status">
        <FileOff size={22} strokeWidth={1.75} aria-hidden />
        <div>
          <h2>This page is temporarily unpublished</h2>
          <p className="meta">
            The team is updating it. In the meantime, see{' '}
            <A href="/about" className="inlineLink">
              about YOUNGO
            </A>{' '}
            or sign in to the Hub.
          </p>
        </div>
      </section>
    </div>
  )
}
