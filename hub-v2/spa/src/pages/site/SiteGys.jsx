import {
  TbArrowUpRight as ArrowUpRight,
  TbChevronRight as ChevronRight,
  TbScript as Statement,
} from 'react-icons/tb'
import { A, Async } from '../../components/ui.jsx'
import { useApi } from '../../lib/api.js'

export function SiteGys() {
  const query = useApi('/gys')
  return (
    <div className="siteMain">
      <Async query={query} skeletons={4}>
        {(gys) => (
          <>
            <header className="sitePageHeader">
              <p className="pageEyebrow">Youth policy</p>
              <h1>Global Youth Statement</h1>
              <p className="sitePageLead">{gys.current.intro}</p>
            </header>

            <section
              className="siteSection"
              aria-labelledby="gys-process-heading"
            >
              <h2 id="gys-process-heading">
                From local input to global advocacy
              </h2>
              <p className="siteSectionLead">
                The GYS is a year-long policy process. Inputs from young people,
                working groups, LCOYs, and RCOYs are synthesised, endorsed
                around COY, and carried into COP advocacy.
              </p>
              <ol className="siteGysSteps">
                {gys.process.map((item, index) => (
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
                  href="https://climatecoy.com/gys"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  GYS on climatecoy.com
                  <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                </a>
                <a className="btn btn-primary" href="/gys">
                  Open member workspace
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </a>
              </div>
            </section>
            <p className="metaMuted sitePageFootnote">
              The Conference of Youth and its local and regional editions feed
              into the statement.{' '}
              <A href="/about/coy" className="inlineLink">
                See the COY family
              </A>
              .
            </p>
          </>
        )}
      </Async>
    </div>
  )
}
