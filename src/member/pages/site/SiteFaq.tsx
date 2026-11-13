interface FaqItemProps {
  q?: AnyValue
  a?: AnyValue
  id?: string
}

import type { AnyValue, Doc } from '../../lib/types'
import { useRef } from 'react'
import { TbChevronDown as ChevronDown, TbSearch as Search } from 'react-icons/tb'
import { A, Skeletons } from '../../components/ui'
import { useDocument } from '../../lib/documents'
import { useApi } from '../../lib/api'
import { useCatalogue } from '../../lib/useCatalogue'
import { PageWithdrawn } from './PageWithdrawn'

const text = (item: Doc) => [item.q, item.a]

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

// a help-centre list: search first, answers stay collapsed until asked for
function FaqList({ items }: { items: Doc[] }) {
  const list = useCatalogue(items, { text, pageSize: items.length || 1 })
  const ref = useRef<HTMLUListElement>(null)
  const setAll = (open: boolean) =>
    ref.current?.querySelectorAll('details').forEach((details) => (details.open = open))
  return (
    <div className="siteFaqBody">
      <div className="siteFaqTools">
        <label className="siteFaqSearch">
          <Search size={18} aria-hidden />
          <span className="srOnly">Search the questions</span>
          <input
            type="search"
            value={list.search}
            placeholder="Search the questions"
            onChange={(e) => list.setSearch(e.target.value)}
          />
        </label>
        <div className="siteFaqMeta">
          <p className="metaMuted" role="status">
            {list.search
              ? `${list.matches.length} of ${items.length} questions`
              : `${items.length} questions`}
          </p>
          <span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(true)}>
              Expand all
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll(false)}>
              Collapse all
            </button>
          </span>
        </div>
      </div>
      {list.matches.length === 0 ? (
        <p className="meta siteFaqEmpty">
          Nothing matches “{list.search}”.{' '}
          <button type="button" className="inlineLink" onClick={list.reset}>
            Clear the search
          </button>
        </p>
      ) : (
        <ul className="siteFaqList" ref={ref}>
          {list.matches.map((item: Doc, index: number) => (
            <FaqItem key={item.q} q={item.q} a={item.a} id={`faq-${index}`} />
          ))}
        </ul>
      )}
    </div>
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
      <header className="sitePageHeader" data-motif="arcs">
        <p className="pageEyebrow">{faq.eyebrow}</p>
        <h1>{doc?.title || faq.title}</h1>
        <p className="sitePageLead">{doc?.intro || faq.lead}</p>
      </header>

      <FaqList items={items} />

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
