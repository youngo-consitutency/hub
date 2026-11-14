import type { AnyValue } from '../lib/types'
import { DestinationIcon } from './DestinationLink'
import { Section } from './ui'
import {
  TbBuilding as Building2,
  TbBrandInstagram as Instagram,
  TbFileText as FileText,
  TbMail as Mail,
  TbWorld as World,
} from 'react-icons/tb'

/** Who runs a conference and where to read more, for the conference side panel. */
export function CoyOrganiser({ coy }: { coy: AnyValue }) {
  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  const mapUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(place || coy.title)}`
  const links = [
    coy.websiteUrl && { href: coy.websiteUrl, label: 'Website', Icon: World },
    coy.instagramUrl && { href: coy.instagramUrl, label: 'Instagram', Icon: Instagram },
    coy.statementUrl && { href: coy.statementUrl, label: 'Statement', Icon: FileText },
  ].filter(Boolean) as { href: string; label: string; Icon: typeof World }[]
  return (
    <div className="notionTabContent">
      {(coy.organizerName || coy.organizerOrg || coy.organizerEmail) && (
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
      {(links.length > 0 || place) && (
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
            {place && (
              <li>
                <a className="card coyLink" href={mapUrl} target="_blank" rel="noreferrer">
                  <span className="iconTile" aria-hidden>
                    <DestinationIcon url={mapUrl} size={18} />
                  </span>
                  <span>View on map</span>
                </a>
              </li>
            )}
          </ul>
        </Section>
      )}
    </div>
  )
}
