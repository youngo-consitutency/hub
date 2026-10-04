interface FaqItemProps {
  q?: AnyValue
  a?: AnyValue
  id?: string
}

import type { AnyValue, Doc } from '../../lib/types'
import { TbChevronDown as ChevronDown } from 'react-icons/tb'
import { A, Skeletons } from '../../components/ui'
import { useDocument } from '../../lib/documents'

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
  const faq = site?.faq
  if (!faq) return loading ? <Skeletons n={5} /> : null
  const more = faq.more || {}
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">{faq.eyebrow}</p>
        <h1>{faq.title}</h1>
        <p className="sitePageLead">{faq.lead}</p>
      </header>

      <ul className="siteFaqList">
        {(faq.items || []).map((item: Doc, index: number) => (
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
