import { TbArrowLeft as ArrowLeft, TbExternalLink as ExternalLink } from 'react-icons/tb'
import { useDocument } from '../lib/documents'
import { Brand } from '../components/Brand'

function ExtLink({ href, children }: any) {
  if (!href) return <span>{children}</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mandateExtLink">
      {children}
      <ExternalLink className="policyInlineIcon" size={12} strokeWidth={1.75} aria-hidden />
    </a>
  )
}

function DataCategory({ category }: any) {
  return (
    <div className="privacyDataCategory">
      <h3>{category.label}</h3>
      <ul className="privacyFields">
        {category.fields.map((field: any) => (
          <li key={field} className="meta">
            {field}
          </li>
        ))}
      </ul>
      <p className="meta mandatePara">
        <strong>Why:</strong> {category.purpose}
      </p>
      <p className="meta mandatePara">
        <strong>Who can see it:</strong> {category.whoSees}
      </p>
    </div>
  )
}

function Body({ notice, policies }: any) {
  const PRIVACY_META = notice?.PRIVACY_META || {}
  const PRIVACY_VERSION = notice?.PRIVACY_VERSION
  const PRIVACY_SECTIONS = notice?.PRIVACY_SECTIONS || []
  const DATA_CATEGORIES = notice?.DATA_CATEGORIES || []
  const POLICY_BY_SLUG = policies?.POLICY_BY_SLUG || {}
  return (
    <>
      <section className="mandateAnalysis card privacySummary">
        <h2>What this platform collects about you</h2>
        <p className="meta mandateAnalysisLead">
          Every field the registration form asks for is listed below, with what it is used for and
          who can see it. If a new field is ever added to the form, it is added here in the same
          change.
        </p>
        <div className="mandatePoints privacyDataList">
          {DATA_CATEGORIES.map((category: any) => (
            <DataCategory key={category.id} category={category} />
          ))}
        </div>
      </section>

      {PRIVACY_SECTIONS.map((section: any) => (
        <section
          key={section.id}
          className="mandateSection card privacySection"
          id={`privacy-${section.id}`}
        >
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((para: any, i: any) => (
            <p key={`${section.id}-p-${i}`} className="meta mandatePara">
              {para}
            </p>
          ))}
          {section.bullets?.map((group: any) => (
            <div key={group.label} className="mandateBulletGroup">
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((item: any, i: any) => (
                  <li key={`${group.label}-${i}`} className="meta">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {section.paragraphsAfter?.map((para: any, i: any) => (
            <p key={`${section.id}-pa-${i}`} className="meta mandatePara">
              {para}
            </p>
          ))}
        </section>
      ))}

      <section className="mandateSection card privacySection">
        <h2>Related YOUNGO policies</h2>
        <p className="meta mandatePara">
          This notice explains what the Hub platform does. It sits under the policies the
          constituency has adopted, and does not replace them.
        </p>
        <ul className="mandateBulletGroup privacyBulletList">
          {PRIVACY_META.relatedPolicies.map((related: any) => (
            <li key={related.slug} className="meta">
              <ExtLink href={POLICY_BY_SLUG[related.slug]?.href}>{related.label}</ExtLink>
            </li>
          ))}
        </ul>
        <h3>Who processes data on YOUNGO’s behalf</h3>
        <ul className="mandateBulletGroup privacyBulletList">
          {PRIVACY_META.processors.map((processor: any) => (
            <li key={processor.name} className="meta">
              <ExtLink href={processor.href}>{processor.name}</ExtLink> — {processor.role}
            </li>
          ))}
        </ul>
      </section>

      <p className="metaMuted mandateEndMark">
        End of notice · version {PRIVACY_VERSION} · effective {PRIVACY_META.effectiveFrom} · contact{' '}
        <a href={`mailto:${PRIVACY_META.contactEmail}`} className="mandateExtLink">
          {PRIVACY_META.contactEmail}
        </a>
      </p>
    </>
  )
}

function Header({ notice }: any) {
  const PRIVACY_META = notice?.PRIVACY_META || {}
  const PRIVACY_VERSION = notice?.PRIVACY_VERSION
  return (
    <div className="privacyNoticeHeader">
      <p className="metaMuted">
        Version {PRIVACY_VERSION} · effective {PRIVACY_META.effectiveFrom}
      </p>
      <h1>{PRIVACY_META.name}</h1>
      <p className="meta privacyNoticeLead">
        What the YOUNGO Hub collects, why it is needed, who can see it, how long it is kept, and how
        to ask for a copy or deletion.
      </p>
      <p className="metaMuted">{PRIVACY_META.status}</p>
    </div>
  )
}

/**
 * Renders the privacy notice inside the app or as a standalone public page.
 * The standalone route lets visitors review it before registration.
 */
export function Privacy({ standalone = false }: any) {
  const { doc: notice, loading, error, retry } = useDocument('privacy-notice')
  const { doc: policies } = useDocument('policies')
  if (loading) {
    return (
      <main className="mandateGate" aria-busy="true">
        <div className="mandateShell">
          <p className="meta" role="status">
            Loading the Privacy Notice…
          </p>
        </div>
      </main>
    )
  }
  if (error || !notice) {
    return (
      <main className="mandateGate">
        <div className="mandateShell">
          <p className="meta" role="alert">
            The Privacy Notice could not be loaded.{' '}
            <button type="button" className="btn btn-secondary" onClick={retry}>
              Try again
            </button>
          </p>
        </div>
      </main>
    )
  }
  const PRIVACY_META = notice.PRIVACY_META || {}
  if (standalone) {
    return (
      <div className="mandateGate mandatePolicyGate privacyGate">
        <div className="mandateShell">
          <header className="mandateHeader privacyGateHeader">
            <div className="gateBrand">
              <Brand />
            </div>
            <Header notice={notice} />
          </header>
          <div className="mandateBody">
            <div className="mandatePolicy privacyDocument">
              <Body notice={notice} policies={policies} />
            </div>
          </div>
          <footer className="mandateFooter privacyGateFooter">
            <div className="privacyFooterRow">
              <p className="metaMuted privacyFooterCopy">
                Questions or deletion requests:{' '}
                <a className="mandateExtLink" href={`mailto:${PRIVACY_META.contactEmail}`}>
                  {PRIVACY_META.contactEmail}
                </a>
              </p>
              <a className="btn btn-primary btn-glow" href="/">
                <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
                Back to YOUNGO Hub
              </a>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="pageEyebrow">Data protection</p>
      <Header notice={notice} />
      <div className="mandatePolicy privacyDocument">
        <Body notice={notice} policies={policies} />
      </div>
    </div>
  )
}
