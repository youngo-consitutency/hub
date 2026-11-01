interface CoyDetailProps {
  slug?: string
}

import type { AnyValue } from '../lib/types'
import { useApi } from '../lib/api'
import { Async, BackLink, LifecycleTiming, StatusChip, PageHeader, Section } from '../components/ui'
import { fmtDateRange } from '../lib/time'
import { coyApplicationsAreOpen, coyDisplayStatus, resolveCoyStatus } from '../../shared/coyStatus'
import { DestinationIcon } from '../components/DestinationLink'
import {
  TbBuilding as Building2,
  TbBrandInstagram as Instagram,
  TbCalendar as CalendarDays,
  TbFileText as FileText,
  TbMail as Mail,
  TbWorld as World,
  TbMapPin as MapPin,
} from 'react-icons/tb'

const REGION_LABEL = {
  africa: 'Africa',
  apac: 'Asia-Pacific',
  eca: 'ECA',
  lac: 'LAC',
  mena: 'MENA',
  noram: 'North America',
  weog: 'WEOG',
}
const CTA = { registration_open: 'Register', applications_open: 'Apply' }

export function CoyDetail({ slug }: CoyDetailProps) {
  const query = useApi(`/coys/${slug}`)
  return (
    <div className="detailPage">
      <BackLink href="/coys">COY tracker</BackLink>
      <Async query={query}>
        {(coy: AnyValue) => {
          const place = [coy.city, coy.country].filter(Boolean).join(', ')
          const mapQuery = encodeURIComponent(place || coy.country || coy.title)
          const status = resolveCoyStatus(coy)
          const applicationsOpen = coyApplicationsAreOpen(coy)
          const cta = (CTA as AnyValue)[status]
          const hasActions = Boolean((cta && coy.registerUrl) || place)
          const links = [
            coy.websiteUrl && { href: coy.websiteUrl, label: 'Website', Icon: World },
            coy.instagramUrl && { href: coy.instagramUrl, label: 'Instagram', Icon: Instagram },
            coy.statementUrl && { href: coy.statementUrl, label: 'Statement', Icon: FileText },
          ].filter(Boolean) as { href: string; label: string; Icon: typeof World }[]
          return (
            <>
              <div className="coyDetailHeader">
                <PageHeader
                  title={coy.title}
                  description={
                    (REGION_LABEL as AnyValue)[coy.region] || coy.region || 'Conference of Youth'
                  }
                />

                <section
                  className="card detailSummary coyDetailOverview"
                  aria-label="Conference details"
                >
                  <div className="coyDetailFacts">
                    <div className="coyDetailFact">
                      <span className="coyDetailFactIcon" aria-hidden>
                        <MapPin size={18} strokeWidth={1.75} />
                      </span>
                      <div>
                        <span className="detailMetaLabel">Location</span>
                        <strong>{place || 'To be announced'}</strong>
                      </div>
                    </div>
                    <div className="coyDetailFact">
                      <span className="coyDetailFactIcon" aria-hidden>
                        <CalendarDays size={18} strokeWidth={1.75} />
                      </span>
                      <div>
                        <span className="detailMetaLabel">Dates</span>
                        <strong className="mono">
                          {fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}
                        </strong>
                      </div>
                    </div>
                    <div className="coyDetailFact coyDetailStatus">
                      <span className="detailMetaLabel">Status</span>
                      <StatusChip status={coyDisplayStatus(coy)} />
                    </div>
                  </div>
                  {coy.applicationsCloseAt && (
                    <LifecycleTiming
                      iso={coy.applicationsCloseAt}
                      label="Applications close"
                      showCountdown={applicationsOpen}
                    />
                  )}

                  {hasActions && (
                    <div className="detailActions groupOverviewActions">
                      {cta && coy.registerUrl && (
                        <a
                          className="btn btn-primary"
                          href={coy.registerUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon url={coy.registerUrl} size={18} />
                          {cta}
                        </a>
                      )}
                      {place && (
                        <a
                          className="btn btn-secondary"
                          href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon
                            url={`https://www.openstreetmap.org/search?query=${mapQuery}`}
                            size={18}
                          />
                          View on map
                        </a>
                      )}
                    </div>
                  )}
                </section>
              </div>

              {(coy.organizerName || coy.organizerOrg) && (
                <Section label="Organiser">
                  <div className="card coyOrganiserCard">
                    <span className="iconTile" aria-hidden>
                      <Building2 size={20} strokeWidth={1.75} />
                    </span>
                    <div className="coyOrganiserCopy">
                      {coy.organizerName && <h3>{coy.organizerName}</h3>}
                      {coy.organizerOrg && <p className="meta">{coy.organizerOrg}</p>}
                      {coy.organizerEmail && (
                        <a className="coyOrganiserEmail" href={`mailto:${coy.organizerEmail}`}>
                          <Mail size={16} strokeWidth={1.75} aria-hidden />
                          {coy.organizerEmail}
                        </a>
                      )}
                    </div>
                  </div>
                </Section>
              )}

              {links.length > 0 && (
                <Section label="Links">
                  <ul className="coyLinks">
                    {links.map(({ href, label, Icon }) => (
                      <li key={href}>
                        <a className="card coyLink" href={href} target="_blank" rel="noreferrer">
                          <span className="iconTile" aria-hidden>
                            <Icon size={18} strokeWidth={1.75} />
                          </span>
                          <span>{label}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
