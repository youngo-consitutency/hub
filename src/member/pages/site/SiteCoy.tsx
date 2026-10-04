interface CoyRowProps {
  coy?: AnyValue
}

import type { AnyValue, Doc } from '../../lib/types'
import { regionLabel } from '../../lib/regions'
import {
  TbCalendar as CalendarDays,
  TbChevronRight as ChevronRight,
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
import { resolveCoyStatus } from '../../../shared/coyStatus'

const STATUS_LABEL = {
  announced: ['chip-neutral', 'Announced soon'],
  registration_open: ['chip-accent', 'Registration open'],
  applications_open: ['chip-warn', 'Applications open'],
  applications_closed: ['chip-neutral', 'Applications closed'],
  registration_closed: ['chip-neutral', 'Registration closed'],
  concluded: ['chip-neutral', 'Concluded'],
  cancelled: ['chip-danger', 'Cancelled'],
}

function CoyRow({ coy }: CoyRowProps) {
  const status = resolveCoyStatus(coy)
  const [chipClass, chipLabel] = (STATUS_LABEL as AnyValue)[status] || ['chip-neutral', status]
  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  return (
    <li className="siteCoyRow">
      <div className="siteCoyIdentity">
        <h3>{coy.title}</h3>
        <p className="metaMuted">
          {coy.type === 'coy'
            ? 'Global Conference of Youth'
            : coy.type === 'rcoy'
              ? 'Regional Conference of Youth'
              : coy.type === 'lcoy'
                ? 'Local Conference of Youth'
                : 'Conference of Youth'}
          {place ? ` · ${place}` : ''}
          {coy.region && !place
            ? ` · ${regionLabel(coy.region)}`
            : coy.region && place
              ? ` (${regionLabel(coy.region)})`
              : ''}
        </p>
      </div>
      <span className={`chip ${chipClass}`}>{chipLabel}</span>
    </li>
  )
}

export function SiteCoy() {
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
  const cta = coy.cta || {}

  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">{coy.eyebrow}</p>
        <h1>{coy.title}</h1>
        <p className="sitePageLead">{coy.lead}</p>
      </header>

      <section className="siteSection" aria-labelledby="formats-heading">
        <div className="siteSectionHeadingRow">
          <h2 id="formats-heading">{coy.familyTitle}</h2>
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
        <div className="cardGrid">
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
      </section>

      <section className="siteSection" aria-labelledby="current-coy-heading">
        <article className="card siteCurrentCoy">
          <div>
            <p className="pageEyebrow">{coy.currentEyebrow}</p>
            <h2 id="current-coy-heading">{COY_CURRENT.title}</h2>
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
      </section>

      <section className="siteSection" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">{upcoming.title}</h2>
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
          {(data: Doc) => {
            const global = data.items.filter((c: AnyValue) => c.type === 'coy')
            const regional = data.items.filter((c: AnyValue) => c.type !== 'coy')
            return (
              <div className="stack">
                {global.length > 0 && (
                  <ul className="card siteCoyList">
                    {global.map((coy: AnyValue) => (
                      <CoyRow key={coy.slug} coy={coy} />
                    ))}
                  </ul>
                )}
                {regional.length > 0 && (
                  <ul className="card siteCoyList">
                    {regional.map((coy: AnyValue) => (
                      <CoyRow key={coy.slug} coy={coy} />
                    ))}
                  </ul>
                )}
                <p className="metaMuted">
                  {footnote.before}{' '}
                  <A href="/coys" className="inlineLink">
                    {footnote.linkLabel}
                  </A>
                  .
                </p>
              </div>
            )
          }}
        </Async>
      </section>

      <section className="siteCtaBand card">
        <CalendarDays size={24} strokeWidth={1.75} aria-hidden />
        <div>
          <h2>{cta.title}</h2>
          <p className="meta">{cta.body}</p>
        </div>
        <A className="btn btn-primary" href="/join">
          {cta.label}
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </A>
      </section>
    </div>
  )
}
