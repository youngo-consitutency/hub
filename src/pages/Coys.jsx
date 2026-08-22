import { useState } from 'react'
import { useApi } from '../lib/api.js'
import {
  Async,
  Empty,
  FilterMenu,
  FilterPill,
  PageHeader,
  SortButton,
} from '../components/ui.jsx'
import { CoyCard } from '../components/cards.jsx'
import { ArrowDownAZ, Globe2, Layers3, Map, MapPin, Search } from 'lucide-react'
import {
  activeFilterCount,
  matchesFilters,
  toggleFilter,
} from '../lib/filterState.js'

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
  const [typeFilters, setTypeFilters] = useState({})
  const [regionFilters, setRegionFilters] = useState({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('title')
  const query = useApi('/coys?type=all&region=all')

  return (
    <div>
      <PageHeader
        eyebrow="Conferences of Youth"
        title="COY tracker"
        description="Find local, regional, and global Conferences of Youth, with dates and participation status."
      />
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
        {(data) => {
          const needle = search.trim().toLocaleLowerCase()
          const items = data.items
            .filter(
              (coy) =>
                matchesFilters(coy.type, typeFilters) &&
                matchesFilters(coy.region, regionFilters) &&
                (!needle ||
                  [coy.title, coy.city, coy.country, coy.organizerName]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a, b) => {
              if (sort === 'region') {
                const regionOrder = REGIONS.findIndex(
                  (region) => region.key === a.region,
                )
                const otherRegionOrder = REGIONS.findIndex(
                  (region) => region.key === b.region,
                )
                return (
                  regionOrder - otherRegionOrder ||
                  a.title.localeCompare(b.title)
                )
              }
              return a.title.localeCompare(b.title)
            })
          return (
            <>
              <div className="catalogTools">
                <div className="catalogSearchRow">
                  <label className="searchInputWrap">
                    <span className="srOnly">Search conferences</span>
                    <Search size={18} strokeWidth={1.75} aria-hidden />
                    <input
                      className="input"
                      type="search"
                      placeholder="Search conferences or locations"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <div className="sortControl" aria-label="Sort conferences">
                    <SortButton
                      active={sort === 'title'}
                      icon={ArrowDownAZ}
                      onClick={() => setSort('title')}
                    >
                      Title A–Z
                    </SortButton>
                    <SortButton
                      active={sort === 'region'}
                      icon={Map}
                      onClick={() => setSort('region')}
                    >
                      Region
                    </SortButton>
                  </div>
                </div>
                <div className="catalogControlRow catalogFilterRow">
                  <FilterMenu
                    label="Filter conferences"
                    activeCount={
                      activeFilterCount(typeFilters) +
                      activeFilterCount(regionFilters)
                    }
                  >
                    <fieldset className="filterLevel">
                      <legend>Conference type</legend>
                      <div className="pillRow">
                        {TYPES.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={
                              item.key === 'all' &&
                              activeFilterCount(typeFilters) === 0
                            }
                            state={
                              item.key === 'all'
                                ? undefined
                                : typeFilters[item.key] || 'neutral'
                            }
                            icon={item.icon}
                            onClick={() => {
                              if (item.key === 'all') setTypeFilters({})
                              else {
                                setTypeFilters((current) =>
                                  toggleFilter(current, item.key),
                                )
                              }
                            }}
                          >
                            {item.label}
                          </FilterPill>
                        ))}
                      </div>
                    </fieldset>
                    <fieldset className="filterLevel">
                      <legend>Region</legend>
                      <div className="pillRow">
                        {REGIONS.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={
                              item.key === 'all' &&
                              activeFilterCount(regionFilters) === 0
                            }
                            state={
                              item.key === 'all'
                                ? undefined
                                : regionFilters[item.key] || 'neutral'
                            }
                            icon={item.key === 'all' ? Map : MapPin}
                            onClick={() => {
                              if (item.key === 'all') setRegionFilters({})
                              else {
                                setRegionFilters((current) =>
                                  toggleFilter(current, item.key),
                                )
                              }
                            }}
                          >
                            {item.label}
                          </FilterPill>
                        ))}
                      </div>
                    </fieldset>
                  </FilterMenu>
                </div>
              </div>
              <p className="resultsSummary" role="status">
                {items.length} of {data.items.length} conferences
              </p>
              {items.length ? (
                <div className="cardGrid">
                  {items.map((c) => (
                    <CoyCard key={c.slug} coy={c} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Search}
                  title="No conferences match"
                  body="Try a different type, region, or search term."
                />
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
