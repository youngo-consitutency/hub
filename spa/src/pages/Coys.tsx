import { CatalogueResults } from '../components/CatalogueResults'
import { TbMapPin as CoysIcon } from 'react-icons/tb'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, Empty, FilterMenu, FilterPill, PageHeader, SortButton } from '../components/ui'
import { CoyCard } from '../components/cards'
import { regionFilterPrefix, regionLabel } from '../lib/regions'
import {
  TbSortAscendingLetters as ArrowDownAZ,
  TbGlobe as Globe2,
  TbStack3 as Layers3,
  TbMap as Map,
  TbMapPin as MapPin,
  TbSearch as Search,
} from 'react-icons/tb'
import { activeFilterCount, matchesFilters, toggleFilter } from '../lib/filterState'

const TYPES = [
  { key: 'all', label: 'All', icon: Layers3 },
  { key: 'lcoy', label: 'LCOY', icon: MapPin },
  { key: 'rcoy', label: 'RCOY', icon: Map },
  { key: 'coy', label: 'COY', icon: Globe2 },
]
const REGIONS = [
  { key: 'all', label: 'All regions' },
  { key: 'africa', label: regionLabel('africa') },
  { key: 'apac', label: regionLabel('apac') },
  { key: 'eca', label: regionLabel('eca') },
  { key: 'lac', label: regionLabel('lac') },
  { key: 'mena', label: regionLabel('mena') },
  { key: 'noram', label: regionLabel('noram') },
  { key: 'weog', label: regionLabel('weog') },
]

/** Browse Conferences of Youth with search, type and region filters, sorting and catalogue layouts. */
export function Coys() {
  const [typeFilters, setTypeFilters] = useState<Record<string, any>>({})
  const [regionFilters, setRegionFilters] = useState<Record<string, any>>({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('title')
  const query = useApi('/coys?type=all&region=all')

  return (
    <div>
      <PageHeader
        icon={CoysIcon}
        title="COY tracker"
        description="Find local, regional, and global Conferences of Youth, with dates and participation status."
      />
      <Async
        query={query}
        empty={(d: any) =>
          d.items.length === 0 ? (
            <Empty
              icon={MapPin}
              title="No COYs for this filter"
              body="Try another region or type."
            />
          ) : null
        }
      >
        {(data: any) => {
          const needle = search.trim().toLocaleLowerCase()
          const items = data.items
            .filter(
              (coy: any) =>
                matchesFilters(coy.type, typeFilters) &&
                matchesFilters(coy.region, regionFilters) &&
                (!needle ||
                  [coy.title, coy.city, coy.country, coy.organizerName]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a: any, b: any) => {
              if (sort === 'region') {
                const regionOrder = REGIONS.findIndex((region) => region.key === a.region)
                const otherRegionOrder = REGIONS.findIndex((region) => region.key === b.region)
                return regionOrder - otherRegionOrder || a.title.localeCompare(b.title)
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
                    onClear={() => {
                      setTypeFilters({})
                      setRegionFilters({})
                    }}
                    label="Filter conferences"
                    activeCount={activeFilterCount(typeFilters) + activeFilterCount(regionFilters)}
                  >
                    <fieldset className="filterLevel">
                      <legend>Conference type</legend>
                      <div className="pillRow">
                        {TYPES.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={item.key === 'all' && activeFilterCount(typeFilters) === 0}
                            state={
                              item.key === 'all' ? undefined : typeFilters[item.key] || 'neutral'
                            }
                            icon={item.icon}
                            onClick={() => {
                              if (item.key === 'all') setTypeFilters({})
                              else {
                                setTypeFilters((current) => toggleFilter(current, item.key))
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
                            active={item.key === 'all' && activeFilterCount(regionFilters) === 0}
                            state={
                              item.key === 'all' ? undefined : regionFilters[item.key] || 'neutral'
                            }
                            icon={item.key === 'all' ? Map : undefined}
                            prefix={
                              item.key === 'all'
                                ? undefined
                                : regionFilterPrefix(item.key, item.label)
                            }
                            onClick={() => {
                              if (item.key === 'all') setRegionFilters({})
                              else {
                                setRegionFilters((current) => toggleFilter(current, item.key))
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
              <CatalogueResults count={items.length}>
                {items.length ? (
                  <div className="cardGrid">
                    {items.map((c: any) => (
                      <CoyCard
                        key={c.slug}
                        coy={c}
                        typeFilterState={typeFilters[c.type] || 'neutral'}
                        regionFilterState={regionFilters[c.region] || 'neutral'}
                        onTypeFilter={() =>
                          setTypeFilters((current) => toggleFilter(current, c.type))
                        }
                        onRegionFilter={() =>
                          setRegionFilters((current) => toggleFilter(current, c.region))
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Search}
                    title="No conferences match"
                    body="Try a different type, region, or search term."
                  />
                )}
              </CatalogueResults>
            </>
          )
        }}
      </Async>
    </div>
  )
}
