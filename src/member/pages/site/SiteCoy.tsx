import type { AnyValue, Doc } from '../../lib/types'
import { BorderBeam } from '../../components/fx/BorderBeam'
import {
  TbCalendar as CalendarDays,
  TbWorld as Globe,
  TbMap as Map,
  TbMapPin as MapPin,
  TbVideo as Video,
  TbArrowUpRight as ArrowUpRight,
} from 'react-icons/tb'
import { A, Async, Empty, Skeletons } from '../../components/ui'
import { useDocument } from '../../lib/documents'

// Icon names are stored in the site document; components live here.
const FORMAT_ICONS = { Globe, Map, MapPin, Video }
import { useApi } from '../../lib/api'
import { CoyDirectory, FeaturedConference } from './CoyDirectory'
import { SiteSection } from './SitePage'

export function ConferencesSection() {
  const { doc: connect } = useDocument('connect')
  const { doc: site, loading } = useDocument('site')
  const COY_CURRENT = connect?.COY_CURRENT || {}
  const COY_SITE_LINKS = connect?.COY_SITE_LINKS || []
  const coy = site?.coy
  const query = useApi('/coys')
  if (!coy) return loading ? <Skeletons n={4} /> : null
  const official = coy.officialSite || {}
  const upcoming = coy.upcoming || {}
  const footnote = upcoming.footnote || {}

  return (
    <SiteSection id="conferences" eyebrow={coy.eyebrow} title={coy.title} lead={coy.lead}>
      <div className="siteSub">
        <div className="siteSectionHeadingRow">
          <h3>{coy.familyTitle}</h3>
          <a
            className="btn btn-secondary btn-sm"
            href={official.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {official.label}
            <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
          </a>
        </div>
        <div className="cardGrid cardGridFit">
          {(coy.formats || []).map(({ icon, title, body }: AnyValue) => {
            const Icon = (FORMAT_ICONS as AnyValue)[icon] || Globe
            return (
              <article key={title} className="card siteFormatCard">
                <span className="iconTile" aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <h3>{title}</h3>
                <p className="meta">{body}</p>
              </article>
            )
          })}
        </div>
      </div>

      <div className="siteSub">
        <article className="card siteCurrentCoy">
          <BorderBeam colorFrom="var(--accent)" colorTo="var(--ld-glow-lime)" />
          <div>
            <p className="pageEyebrow">{coy.currentEyebrow}</p>
            <h3>{COY_CURRENT.title}</h3>
            <p className="meta">{COY_CURRENT.note}</p>
          </div>
          <div className="siteCtaActions">
            {COY_SITE_LINKS.map((link: AnyValue) => (
              <a
                key={link.href}
                className="btn btn-secondary btn-sm"
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
              >
                {link.label}
                <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden />
              </a>
            ))}
          </div>
        </article>
      </div>

      <div className="siteSub">
        <h3>{upcoming.title}</h3>
        <p className="siteSectionLead">{upcoming.lead}</p>
        <Async
          query={query}
          empty={(data: Doc) =>
            data.items.length === 0 ? (
              <Empty
                icon={CalendarDays}
                title={upcoming.empty?.title}
                body={upcoming.empty?.body}
              />
            ) : null
          }
        >
          {(data: Doc) => (
            <div className="stack">
              <FeaturedConference items={data.items} />
              <CoyDirectory items={data.items} />
              <p className="metaMuted">
                {footnote.before}{' '}
                <A href="/coys" className="inlineLink">
                  {footnote.linkLabel}
                </A>
                .
              </p>
            </div>
          )}
        </Async>
      </div>
    </SiteSection>
  )
}
