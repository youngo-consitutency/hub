import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, FilterPill, PageHeader } from '../components/ui.jsx'
import { CoyCard } from '../components/cards.jsx'
import { Globe2, Layers3, Map, MapPin } from 'lucide-react'

const TYPES = [
  { key: 'all', label: 'All', icon: Layers3 },
  { key: 'lcoy', label: 'LCOY', icon: MapPin },
  { key: 'rcoy', label: 'RCOY', icon: Map },
  { key: 'coy', label: 'COY', icon: Globe2 },
]
const REGIONS = [
  { key: 'all', label: 'All regions' },
  { key: 'africa', label: 'Africa' },
  { key: 'apac', label: 'Asia-Pacific' },
  { key: 'eca', label: 'ECA' },
  { key: 'lac', label: 'LAC' },
  { key: 'mena', label: 'MENA' },
  { key: 'noram', label: 'North America' },
  { key: 'weog', label: 'WEOG' },
]

export function Coys() {
  const [type, setType] = useState('all')
  const [region, setRegion] = useState('all')
  const query = useApi(`/coys?type=${type}&region=${region}`, [type, region])

  return (
    <div>
      <PageHeader
        eyebrow="Conferences of Youth"
        title="COY tracker"
        description="Find local, regional, and global Conferences of Youth, with dates and participation status."
      >
        <div className="filterHierarchy" aria-label="COY filters">
          <fieldset className="filterLevel">
            <legend>Conference type</legend>
            <div className="pillRow">
              {TYPES.map((t) => (
                <FilterPill
                  key={t.key}
                  active={type === t.key}
                  icon={t.icon}
                  onClick={() => setType(t.key)}
                >
                  {t.label}
                </FilterPill>
              ))}
            </div>
          </fieldset>
          <fieldset className="filterLevel">
            <legend>Region</legend>
            <div className="pillRow">
              {REGIONS.map((r) => (
                <FilterPill
                  key={r.key}
                  active={region === r.key}
                  icon={r.key === 'all' ? Map : undefined}
                  onClick={() => setRegion(r.key)}
                >
                  {r.label}
                </FilterPill>
              ))}
            </div>
          </fieldset>
        </div>
      </PageHeader>
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? (
            <Empty
              icon={MapPin}
              title="No COYs for this filter"
              body="Try another region or type."
            />
          ) : null
        }
      >
        {(data) => (
          <>
            <p className="resultsSummary" role="status">
              {data.items.length} conference
              {data.items.length === 1 ? '' : 's'}
            </p>
            <div className="cardGrid">
              {data.items.map((c) => (
                <CoyCard key={c.slug} coy={c} />
              ))}
            </div>
          </>
        )}
      </Async>
    </div>
  )
}
