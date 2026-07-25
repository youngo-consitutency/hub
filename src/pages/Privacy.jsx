import { ShieldCheck, ExternalLink, Mail } from 'lucide-react'
import {
  PRIVACY_META,
  PRIVACY_VERSION,
  PRIVACY_SECTIONS,
  DATA_CATEGORIES,
} from '../../shared/privacyNotice.js'
import { POLICY_BY_SLUG } from '../content/policies.js'

function ExtLink({ href, children }) {
  if (!href) return <span>{children}</span>
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mandateExtLink"
    >
      {children}
      <ExternalLink
        size={12}
        strokeWidth={1.75}
        aria-hidden
        style={{ marginLeft: 4 }}
      />
    </a>
  )
}

function DataCategory({ category }) {
  return (
    <section className="card cardTight" style={{ marginBottom: 12 }}>
      <h3 style={{ fontSize: 15 }}>{category.label}</h3>
      <ul
        className="mandateBulletGroup"
        style={{ margin: '8px 0 10px', paddingLeft: 18 }}
      >
        {category.fields.map((field) => (
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
    </section>
  )
}

function Body() {
  return (
    <>
      <section className="mandateSection">
        <h2>What this platform collects about you</h2>
        <p className="meta mandatePara">
          Every field the registration form asks for is listed below, with what
          it is used for and who can see it. If a new field is ever added to the
          form, it is added here in the same change.
        </p>
        {DATA_CATEGORIES.map((category) => (
          <DataCategory key={category.id} category={category} />
        ))}
      </section>

      {PRIVACY_SECTIONS.map((section) => (
        <section
          key={section.id}
          className="mandateSection"
          id={`privacy-${section.id}`}
        >
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((para, i) => (
            <p key={`${section.id}-p-${i}`} className="meta mandatePara">
              {para}
            </p>
          ))}
          {section.bullets?.map((group) => (
            <div key={group.label} className="mandateBulletGroup">
              <h3>{group.label}</h3>
              <ul>
                {group.items.map((item, i) => (
                  <li key={`${group.label}-${i}`} className="meta">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {section.paragraphsAfter?.map((para, i) => (
            <p key={`${section.id}-pa-${i}`} className="meta mandatePara">
              {para}
            </p>
          ))}
        </section>
      ))}

      <section className="mandateSection">
        <h2>Related YOUNGO policies</h2>
        <p className="meta mandatePara">
          This notice explains what the Hub platform does. It sits under the
          policies the constituency has adopted, and does not replace them.
        </p>
        <ul className="mandateBulletGroup" style={{ paddingLeft: 18 }}>
          {PRIVACY_META.relatedPolicies.map((related) => (
            <li key={related.slug} className="meta">
              <ExtLink href={POLICY_BY_SLUG[related.slug]?.href}>
                {related.label}
              </ExtLink>
            </li>
          ))}
        </ul>
        <h3 style={{ fontSize: 15, marginTop: 14 }}>
          Who processes data on YOUNGO’s behalf
        </h3>
        <ul className="mandateBulletGroup" style={{ paddingLeft: 18 }}>
          {PRIVACY_META.processors.map((processor) => (
            <li key={processor.name} className="meta">
              <ExtLink href={processor.href}>{processor.name}</ExtLink> —{' '}
              {processor.role}
            </li>
          ))}
        </ul>
      </section>

      <p className="metaMuted mandateEndMark">
        End of notice · version {PRIVACY_VERSION} · effective{' '}
        {PRIVACY_META.effectiveFrom} · contact{' '}
        <a
          href={`mailto:${PRIVACY_META.contactEmail}`}
          className="mandateExtLink"
        >
          {PRIVACY_META.contactEmail}
        </a>
      </p>
    </>
  )
}

function Header() {
  return (
    <div
      className="rowGap"
      style={{ alignItems: 'flex-start', paddingBottom: 12 }}
    >
      <span className="iconTile" aria-hidden>
        <ShieldCheck size={22} strokeWidth={1.75} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p className="metaMuted" style={{ marginBottom: 4 }}>
          Version {PRIVACY_VERSION} · effective {PRIVACY_META.effectiveFrom}
        </p>
        <h1>{PRIVACY_META.name}</h1>
        <p className="meta" style={{ marginTop: 6, maxWidth: 620 }}>
          Plain language, no defaults hidden in the small print: what the YOUNGO
          Hub collects, why, who can see it, how long it is kept, and how to get
          it deleted.
        </p>
        <p className="metaMuted" style={{ marginTop: 8 }}>
          {PRIVACY_META.status}
        </p>
      </div>
    </div>
  )
}

/**
 * Renders the privacy notice inside the app or as a standalone public page.
 * The standalone route lets visitors review it before registration.
 */
export function Privacy({ standalone = false }) {
  if (standalone) {
    return (
      <div className="mandateGate">
        <div className="mandateShell">
          <header className="mandateHeader">
            <Header />
          </header>
          <div className="mandateBody">
            <div className="mandatePolicy">
              <Body />
            </div>
          </div>
          <footer className="mandateFooter">
            <div className="rowBetween" style={{ gap: 12, flexWrap: 'wrap' }}>
              <p className="metaMuted" style={{ flex: 1, minWidth: 160 }}>
                <Mail
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ marginRight: 6 }}
                />
                Questions or a deletion request: {PRIVACY_META.contactEmail}
              </p>
              <a className="btn btn-primary btn-glow" href="/">
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
      <p className="metaMuted" style={{ marginBottom: 6 }}>
        Data protection
      </p>
      <Header />
      <div className="mandatePolicy" style={{ marginTop: 16 }}>
        <Body />
      </div>
    </div>
  )
}
