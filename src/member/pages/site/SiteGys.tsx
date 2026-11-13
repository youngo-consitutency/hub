import type { AnyValue, Doc } from '../../lib/types'
import { SiteSection } from './SitePage'
import { ScrollTimeline } from '../../components/fx/ScrollTimeline'
import {
  TbArrowUpRight as ArrowUpRight,
  TbChevronRight as ChevronRight,
  TbScript as Statement,
} from 'react-icons/tb'
import { Async } from '../../components/ui'
import { useApi } from '../../lib/api'
import { useDocument } from '../../lib/documents'

export function StatementSection() {
  const query = useApi('/gys')
  const { doc: site } = useDocument('site')
  const gysCopy = site?.gys || {}
  const processCopy = gysCopy.process || {}
  const cta = gysCopy.cta || {}
  const footnote = gysCopy.footnote || {}
  return (
    <Async query={query} skeletons={4}>
      {(gys: AnyValue) => (
        <SiteSection
          id="statement"
          eyebrow={gysCopy.eyebrow}
          title={gysCopy.title}
          lead={gys.current.intro}
        >
          <div className="siteSub">
            <h3>{processCopy.title}</h3>
            <p className="siteSectionLead">{processCopy.lead}</p>
            <ScrollTimeline
              entries={(Array.isArray(gys.process) ? gys.process : []).map(
                (item: Doc, index: number) => ({
                  label: String(index + 1).padStart(2, '0'),
                  title: item.step,
                  body: item.body,
                }),
              )}
            />
          </div>

          <section className="siteCtaBand card">
            <Statement size={24} strokeWidth={1.75} aria-hidden />
            <div>
              <h3>{gys.current.title}</h3>
              <p className="meta">
                {gys.current.edition} · {gys.current.location} · prepared for{' '}
                {gys.current.targetSession}
              </p>
            </div>
            <div className="siteCtaActions">
              <a
                className="btn btn-secondary"
                href={cta.external?.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                {cta.external?.label}
                <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
              </a>
              <a className="btn btn-primary" href="/gys">
                {cta.memberLabel}
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
              </a>
            </div>
          </section>
          <p className="metaMuted sitePageFootnote">
            {footnote.before}{' '}
            <a href="#conferences" className="inlineLink">
              {footnote.linkLabel}
            </a>
            .
          </p>
        </SiteSection>
      )}
    </Async>
  )
}
