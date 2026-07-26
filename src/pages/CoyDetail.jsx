import { useApi } from '../lib/api.js'
import {
  Async,
  BackLink,
  StatusChip,
  PageHeader,
  Section,
} from '../components/ui.jsx'
import { fmtDateRange } from '../lib/time.js'
import { MapPin, ArrowUpRight } from 'lucide-react'

const COY_LABEL = { lcoy: 'LCOY', rcoy: 'RCOY', coy: 'COY' }
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

export function CoyDetail({ slug }) {
  const query = useApi(`/coys/${slug}`)
  return (
    <div className="detailPage">
      <BackLink href="/coys">COY tracker</BackLink>
      <Async query={query}>
        {(coy) => {
          const place = [coy.city, coy.country].filter(Boolean).join(', ')
          const mapQuery = encodeURIComponent(place || coy.country || coy.title)
          const cta = CTA[coy.status]
          return (
            <>
              <PageHeader
                eyebrow={COY_LABEL[coy.type]}
                title={coy.title}
                description={`${place || 'Location to be announced'} · ${REGION_LABEL[coy.region] || coy.region}`}
              >
                <div className="detailHeaderMeta">
                  <StatusChip status={coy.status} />
                  <p className="mono">
                    {fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}
                  </p>
                </div>
              </PageHeader>

              <div className="detailActions">
                {cta && coy.registerUrl && (
                  <a
                    className="btn btn-primary"
                    href={coy.registerUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {cta}
                  </a>
                )}
                <a
                  className="btn btn-secondary"
                  href={`https://www.openstreetmap.org/search?query=${mapQuery}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={18} strokeWidth={1.75} aria-hidden />
                  View on map
                </a>
              </div>

              {(coy.organizerName || coy.organizerOrg) && (
                <Section label="Organiser">
                  <div className="card detailPanel">
                    <div>
                      {coy.organizerName && (
                        <p className="meta">{coy.organizerName}</p>
                      )}
                      {coy.organizerOrg && (
                        <p className="metaMuted">{coy.organizerOrg}</p>
                      )}
                    </div>
                    {coy.registerUrl && (
                      <a
                        className="btn btn-ghost btn-sm detailInlineAction"
                        href={coy.registerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Website
                        <ArrowUpRight
                          size={16}
                          strokeWidth={1.75}
                          aria-hidden
                        />
                      </a>
                    )}
                  </div>
                </Section>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
