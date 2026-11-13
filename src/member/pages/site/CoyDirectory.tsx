import { useMemo } from 'react'
import { TbArrowUpRight as ArrowUpRight } from 'react-icons/tb'
import type { AnyValue } from '../../lib/types'
import { regionLabel } from '../../lib/regions'
import { coyDisplayStatus } from '../../../shared/coyStatus'
import { BorderBeam } from '../../components/fx/BorderBeam'
import { Empty, FilterPill } from '../../components/ui'
import { useCatalogue } from '../../lib/useCatalogue'
import { PublicSearch } from './PublicSearch'

const FORMATS = [
  { id: 'all', label: 'All' },
  { id: 'coy', label: 'Global' },
  { id: 'rcoy', label: 'Regional' },
  { id: 'lcoy', label: 'Local' },
]

const STATUS: Record<string, [chip: string, label: string, rank: number]> = {
  registration_open: ['chip-accent', 'Registration open', 0],
  applications_open: ['chip-warn', 'Applications open', 0],
  underway: ['chip-accent', 'Under way', 0],
  announced: ['chip-neutral', 'Announced', 1],
  endorsed: ['chip-neutral', 'Endorsed', 1],
  applications_closed: ['chip-neutral', 'Applications closed', 2],
  registration_closed: ['chip-neutral', 'Registration closed', 2],
  concluded: ['chip-neutral', 'Concluded', 3],
  cancelled: ['chip-danger', 'Cancelled', 4],
}

export const statusOf = (coy: AnyValue) => STATUS[coyDisplayStatus(coy)] ?? ['chip-neutral', '', 1]
export const isWeb = (url: unknown): url is string =>
  typeof url === 'string' && /^https?:\/\//.test(url)

// what is open comes first, then what is coming, then what is over
export const byRelevance = (a: AnyValue, b: AnyValue) =>
  statusOf(a)[2] - statusOf(b)[2] ||
  String(a.startsOn ?? '9999').localeCompare(String(b.startsOn ?? '9999')) ||
  String(a.title).localeCompare(String(b.title))

function CoyCard({ coy }: { coy: AnyValue }) {
  const [chip, label] = statusOf(coy)
  const place = [coy.city, coy.country].filter(Boolean).join(', ') || regionLabel(coy.region)
  const href = [coy.registerUrl, coy.websiteUrl].find(isWeb)
  const body = (
    <>
      <div>
        <h3>{coy.title}</h3>
        <p className="metaMuted">{place}</p>
      </div>
      {label && <span className={`chip ${chip}`}>{label}</span>}
      {href && <ArrowUpRight className="siteCoyArrow" size={16} strokeWidth={1.75} aria-hidden />}
    </>
  )
  return href ? (
    <a className="card siteCoyCard" href={href} target="_blank" rel="noreferrer noopener">
      {body}
    </a>
  ) : (
    <div className="card siteCoyCard">{body}</div>
  )
}

const FILTERS = {
  format: (coy: AnyValue, value: string) => coy.type === value,
  region: (coy: AnyValue, value: string) => coy.region === value,
}
const text = (coy: AnyValue) => [coy.title, coy.city, coy.country]

// a searchable, filterable catalogue: long lists are browsed, not dumped
export function CoyDirectory({ items }: { items: AnyValue[] }) {
  const list = useCatalogue(items, { text, filters: FILTERS, sort: byRelevance })
  const { values, setFilter, matches, visible, remaining, pageSize } = list
  const regions = useMemo(
    () => [...new Set(items.map((coy) => coy.region).filter(Boolean))].sort(),
    [items],
  )
  const countOf = (id: string) =>
    id === 'all' ? items.length : items.filter((coy) => coy.type === id).length

  return (
    <div className="siteCoyBrowser">
      <aside className="siteCoyTools" aria-label="Filter conferences">
        <PublicSearch label="Search conferences" value={list.search} onChange={list.setSearch} />
        <div className="siteCoyFormats" role="group" aria-label="Format">
          {FORMATS.filter(({ id }) => countOf(id) > 0).map(({ id, label }) => (
            <FilterPill
              key={id}
              active={(values.format || 'all') === id}
              onClick={() => setFilter('format', id === 'all' ? '' : id)}
            >
              {label} <span className="metaMuted">{countOf(id)}</span>
            </FilterPill>
          ))}
        </div>
        <label className="siteCoyRegion">
          <span className="srOnly">Region</span>
          <select value={values.region || ''} onChange={(e) => setFilter('region', e.target.value)}>
            <option value="">All regions</option>
            {regions.map((key) => (
              <option key={key} value={key}>
                {regionLabel(key)}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <div className="siteCoyResults">
        <p className="metaMuted" role="status">
          {matches.length === items.length
            ? `${items.length} conferences`
            : `${matches.length} of ${items.length} conferences`}
        </p>

        {matches.length === 0 ? (
          <Empty
            title="No conferences match"
            body="Try a different search or clear the filters."
            cta={
              <button type="button" className="btn btn-secondary btn-sm" onClick={list.reset}>
                Clear filters
              </button>
            }
          />
        ) : (
          <>
            <ul className="siteCoyGrid">
              {visible.map((coy) => (
                <li key={coy.slug}>
                  <CoyCard coy={coy} />
                </li>
              ))}
            </ul>
            {remaining > 0 && (
              <button
                type="button"
                className="btn btn-secondary siteCoyMore"
                onClick={list.showMore}
              >
                Show {Math.min(pageSize, remaining)} more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// the one conference that is open right now gets the spotlight; the directory below lists the rest
export function FeaturedConference({ items }: { items: AnyValue[] }) {
  const featured = [...items].sort(byRelevance)[0]
  if (!featured || statusOf(featured)[2] !== 0) return null
  const [chip, label] = statusOf(featured)
  const place = [featured.city, featured.country].filter(Boolean).join(', ')
  const href = [featured.registerUrl, featured.websiteUrl].find(isWeb)
  return (
    <article className="siteFeatured">
      <BorderBeam colorFrom="var(--accent)" colorTo="var(--ld-glow-lime)" />
      <p className="pageEyebrow">Open now</p>
      <h3>{featured.title}</h3>
      <div className="siteFeaturedMeta">
        <span className={`chip ${chip}`}>{label}</span>
        {place && <span className="metaMuted">{place}</span>}
      </div>
      {href && (
        <a
          className="btn btn-primary"
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          style={{ justifySelf: 'start' }}
        >
          Register or find out more
          <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
        </a>
      )}
    </article>
  )
}
