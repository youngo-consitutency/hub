interface FaqItemProps {
  q?: AnyValue
  a?: AnyValue
  id?: string
}

import type { AnyValue, Doc } from '../../lib/types'
import { TbChevronDown as ChevronDown } from 'react-icons/tb'
import { A, Skeletons } from '../../components/ui'
import { useDocument } from '../../lib/documents'
import { useApi } from '../../lib/api'
import { PageWithdrawn } from './PageWithdrawn'

function FaqItem({ q, a, id }: FaqItemProps) {
  return (
    <li>
      <details className="siteFaqItem" id={id}>
        <summary>
          <span>{q}</span>
          <ChevronDown size={17} strokeWidth={1.75} aria-hidden />
        </summary>
        <p className="meta">{a}</p>
      </details>
    </li>
  )
}

export function SiteFaq() {
  const { doc: site, loading } = useDocument('site')
  // title, intro and questions come from the reviewed page; the rest of the
  // page furniture stays in the site document
  const page = useApi('/pages/faq')
  const faq = site?.faq
  if (!faq || page.loading) return loading || page.loading ? <Skeletons n={5} /> : null
  if (page.data?.state === 'unpublished') return <PageWithdrawn title={faq.title} />
  const doc = page.data?.document
  const items = doc
    ? doc.sections.map((section: Doc) => ({ q: section.title, a: section.body }))
    : faq.items || []
  const more = faq.more || {}
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">{faq.eyebrow}</p>
        <h1>{doc?.title || faq.title}</h1>
        <p className="sitePageLead">{doc?.intro || faq.lead}</p>
      </header>

      <ul className="siteFaqList">
        {items.map((item: Doc, index: number) => (
          <FaqItem key={item.q} q={item.q} a={item.a} id={`faq-${index}`} />
        ))}
      </ul>

      <p className="meta siteFaqMore">
        {more.before}{' '}
        <A href="/about/contact" className="inlineLink">
          {more.contactLabel}
        </A>{' '}
        {more.middle}{' '}
        <A href="/about" className="inlineLink">
          {more.introLabel}
        </A>{' '}
        {more.after}
      </p>
    </div>
  )
}
