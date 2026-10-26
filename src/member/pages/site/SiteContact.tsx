import type { AnyValue } from '../../lib/types'
import {
  TbArrowUpRight as ArrowUpRight,
  TbAt as AtSign,
  TbHeartHandshake as HeartHandshake,
  TbLifebuoy as LifeBuoy,
  TbSitemap as Network,
  TbUsers as Users,
} from 'react-icons/tb'
import { A, Skeletons } from '../../components/ui'
import { DestinationIcon } from '../../components/DestinationLink'
import { PartnerEnquiry } from '../../features/platform/PublicPlatform.tsx'
import { publishedLinks, useDocument } from '../../lib/documents'
import { useApi } from '../../lib/api'
import { PageWithdrawn } from './PageWithdrawn'

// Icon names are stored in the site document; components live here.
const ROUTE_ICONS = { Users, Network, AtSign, LifeBuoy }

export function SiteContact() {
  const { doc: connect } = useDocument('connect')
  const { doc: site, loading } = useDocument('site')
  const page = useApi('/pages/contact')
  const contact = site?.contact
  if (!contact || page.loading) return loading || page.loading ? <Skeletons n={4} /> : null
  if (page.data?.state === 'unpublished') return <PageWithdrawn title={contact.title} />
  const doc = page.data?.document
  // reviewed sections become routes; icons stay with the site document's routes
  const baseRoutes = contact.routes || []
  const routes = doc
    ? doc.sections.map((section: AnyValue, i: number) => ({
        icon: baseRoutes[i]?.icon,
        title: section.title,
        body: section.body,
        cta: section.linkUrl
          ? {
              label: section.linkLabel,
              href: section.linkUrl,
              internal: section.linkUrl.startsWith('/'),
              external: /^https?:/.test(section.linkUrl),
            }
          : null,
      }))
    : baseRoutes
  const socials = publishedLinks(connect?.SOCIAL_LINKS)
  const partnership = contact.partnership || {}
  const follow = contact.socials || {}
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">{contact.eyebrow}</p>
        <h1>{doc?.title || contact.title}</h1>
        <p className="sitePageLead">{doc?.intro || contact.lead}</p>
      </header>

      <section className="siteSection" aria-labelledby="routes-heading">
        <h2 id="routes-heading">{contact.routesTitle}</h2>
        <div className="cardGrid">
          {routes.map(({ icon, title, body, cta }: AnyValue) => {
            const Icon = (ROUTE_ICONS as AnyValue)[icon] || Users
            return (
              <article key={title} className="card siteContactCard">
                <span className="iconTile" aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p className="meta">{body}</p>
                  {!cta ? null : cta.internal ? (
                    <A className="siteContactLink" href={cta.href}>
                      {cta.label}
                      <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                    </A>
                  ) : cta.external ? (
                    <a
                      className="siteContactLink"
                      href={cta.href}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {cta.label}
                      <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                    </a>
                  ) : (
                    <a className="siteContactLink" href={cta.href}>
                      {cta.label}
                      <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="siteSection">
        <h2>{partnership.title}</h2>
        <p className="siteSectionLead">{partnership.lead}</p>
        <PartnerEnquiry />
      </section>

      {socials.length > 0 && (
        <section className="siteSection" aria-labelledby="socials-heading">
          <h2 id="socials-heading">{follow.title}</h2>
          <p className="siteSectionLead">{follow.lead}</p>
          <ul className="siteSocialList" aria-label="Official YOUNGO channels">
            {socials.map((link: AnyValue) => (
              <li key={link.key}>
                <a href={link.url} target="_blank" rel="noreferrer noopener">
                  <DestinationIcon url={link.url} size={16} />
                  {link.label}
                  <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card cardTight siteContactNote">
        <HeartHandshake size={20} strokeWidth={1.75} aria-hidden />
        <p className="meta">{contact.note}</p>
      </section>
    </div>
  )
}
