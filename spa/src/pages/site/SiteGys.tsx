import {
  TbArrowUpRight as ArrowUpRight,
  TbChevronRight as ChevronRight,
  TbScript as Statement,
} from 'react-icons/tb'
import { A, Async } from '../../components/ui'
import { useApi } from '../../lib/api'
import { useDocument } from '../../lib/documents'

export function SiteGys() {
  const query = useApi('/gys')
  const { doc: site } = useDocument('site')
  const gysCopy = site?.gys || {}
  const processCopy = gysCopy.process || {}
  const cta = gysCopy.cta || {}
  const footnote = gysCopy.footnote || {}
  return (
    <div className="siteMain">
      <Async query={query} skeletons={4}>
        {(gys: any) => (
          <>
            <header className="sitePageHeader">
              <p className="pageEyebrow">{gysCopy.eyebrow}</p>
              <h1>{gysCopy.title}</h1>
              <p className="sitePageLead">{gys.current.intro}</p>
            </header>

            <section className="siteSection" aria-labelledby="gys-process-heading">
              <h2 id="gys-process-heading">{processCopy.title}</h2>
              <p className="siteSectionLead">{processCopy.lead}</p>
              <ol className="siteGysSteps">
                {(Array.isArray(gys.process) ? gys.process : []).map((item: any, index: any) => (
                  <li key={item.step} className="card">
                    <span className="stepNum" aria-hidden>
                      {index + 1}
                    </span>
                    <div>
                      <h3>{item.step}</h3>
                      <p className="meta">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="siteCtaBand card">
              <Statement size={24} strokeWidth={1.75} aria-hidden />
              <div>
                <h2>{gys.current.title}</h2>
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
              <A href="/about/coy" className="inlineLink">
                {footnote.linkLabel}
              </A>
              .
            </p>
          </>
        )}
      </Async>
    </div>
  )
}
