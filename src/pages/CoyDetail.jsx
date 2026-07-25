import { useApi } from '../lib/api.js'
import { Async, BackLink, StatusChip } from '../components/ui.jsx'
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
    <div>
      <BackLink href="/coys">COY tracker</BackLink>
      <Async query={query}>
        {(coy) => {
          const place = [coy.city, coy.country].filter(Boolean).join(', ')
          const mapQuery = encodeURIComponent(place || coy.country || coy.title)
          const cta = CTA[coy.status]
          return (
            <>
              <div className="rowGap" style={{ marginTop: 8 }}>
                <span className="chip chip-neutral">{COY_LABEL[coy.type]}</span>
                <StatusChip status={coy.status} />
              </div>
              <h1 style={{ marginTop: 10 }}>{coy.title}</h1>
              <p className="mono detailHero">
                {fmtDateRange(coy.startsOn, coy.endsOn, coy.datesTbc)}
              </p>
              <p className="meta" style={{ marginTop: 4 }}>
                {place}
                {place && coy.region ? ' · ' : ''}
                {REGION_LABEL[coy.region] || coy.region}
              </p>

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
                <div className="card" style={{ marginTop: 16 }}>
                  <h3>Organizer</h3>
                  {coy.organizerName && (
                    <p className="meta" style={{ marginTop: 6 }}>
                      {coy.organizerName}
                    </p>
                  )}
                  {coy.organizerOrg && (
                    <p className="metaMuted" style={{ marginTop: 2 }}>
                      {coy.organizerOrg}
                    </p>
                  )}
                  {coy.registerUrl && (
                    <a
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: 8, paddingLeft: 0 }}
                      href={coy.registerUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Website
                      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                    </a>
                  )}
                </div>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
