interface FaqItemProps {
  q?: AnyValue
  a?: AnyValue
  id?: string
}

import type { AnyValue, Doc } from '../../lib/types'
import { useState } from 'react'
import {
  Button,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  Heading,
  type Key,
} from 'react-aria-components'
import { TbChevronDown as ChevronDown } from 'react-icons/tb'
import { A, Skeletons } from '../../components/ui'
import { useDocument } from '../../lib/documents'
import { useApi } from '../../lib/api'
import { useCatalogue } from '../../lib/useCatalogue'
import { PublicSearch } from './PublicSearch'
import { SiteSection } from './SitePage'
import { PageWithdrawn } from './PageWithdrawn'

const text = (item: Doc) => [item.q, item.a]

// one question: react-aria's Disclosure supplies the button, heading and panel semantics
function FaqItem({ q, a, id }: FaqItemProps) {
  return (
    <Disclosure id={id} className="siteFaqItem">
      <Heading level={3}>
        <Button slot="trigger" className="siteFaqTrigger">
          <span>{q}</span>
          <ChevronDown size={17} strokeWidth={1.75} aria-hidden />
        </Button>
      </Heading>
      <DisclosurePanel>
        <p className="meta">{a}</p>
      </DisclosurePanel>
    </Disclosure>
  )
}

// a help-centre list: search first, answers stay collapsed until asked for
function FaqList({ items }: { items: Doc[] }) {
  const list = useCatalogue(items, { text, pageSize: items.length || 1 })
  const [expanded, setExpanded] = useState<Set<Key>>(new Set())
  // ids follow the question's place in the full list, so they survive filtering
  const idOf = (item: Doc) => `faq-${items.indexOf(item)}`
  return (
    <div className="siteFaqBody">
      <div className="siteFaqTools">
        <PublicSearch
          large
          label="Search the questions"
          value={list.search}
          onChange={list.setSearch}
        />
        <div className="siteFaqMeta">
          <p className="metaMuted" role="status">
            {list.search
              ? `${list.matches.length} of ${items.length} questions`
              : `${items.length} questions`}
          </p>
          <span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded(new Set(list.matches.map(idOf)))}
            >
              Expand all
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded(new Set())}
            >
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
        <DisclosureGroup
          allowsMultipleExpanded
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
          className="siteFaqList"
        >
          {list.matches.map((item: Doc) => (
            <FaqItem key={idOf(item)} q={item.q} a={item.a} id={idOf(item)} />
          ))}
        </DisclosureGroup>
      )}
    </div>
  )
}

export function FaqSection() {
  const { doc: site, loading } = useDocument('site')
  // title, intro and questions come from the reviewed page; the rest of the
  // page furniture stays in the site document
  const page = useApi('/pages/faq')
  const faq = site?.faq
  if (!faq || page.loading) return loading || page.loading ? <Skeletons n={5} /> : null
  if (page.data?.state === 'unpublished')
    return (
      <SiteSection id="faq" title={faq.title}>
        <PageWithdrawn />
      </SiteSection>
    )
  const doc = page.data?.document
  const items = doc
    ? doc.sections.map((section: Doc) => ({ q: section.title, a: section.body }))
    : faq.items || []
  const more = faq.more || {}
  return (
    <SiteSection
      id="faq"
      eyebrow={faq.eyebrow}
      title={doc?.title || faq.title}
      lead={doc?.intro || faq.lead}
    >
      <FaqList items={items} />
      <p className="meta siteFaqMore">
        {more.before}{' '}
        <a href="#contact" className="inlineLink">
          {more.contactLabel}
        </a>{' '}
        {more.middle}{' '}
        <A href="/" className="inlineLink">
          {more.introLabel}
        </A>{' '}
        {more.after}
      </p>
    </SiteSection>
  )
}
