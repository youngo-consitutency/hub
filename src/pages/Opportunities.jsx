import { TbSpeakerphone as OpportunitiesIcon } from 'react-icons/tb'
import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { CardSchedule } from '../components/cards.jsx'
import {
  activeFilterCount,
  matchesFilters,
  toggleFilter,
} from '../lib/filterState.js'
import {
  Async,
  Empty,
  FilterChip,
  FilterMenu,
  FilterPill,
  PageHeader,
  Section,
  SortButton,
  LifecycleTiming,
} from '../components/ui.jsx'
import {
  TbSortAscendingLetters as ArrowDownAZ,
  TbCalendarTime as CalendarClock,
  TbCalendar as CalendarDays,
  TbCode as Code2,
  TbSchool as GraduationCap,
  TbStack3 as Layers3,
  TbBlendMode as Blend,
  TbSpeakerphone as Megaphone,
  TbMap as Map,
  TbMapPin as MapPin,
  TbDevices as MonitorSmartphone,
  TbPresentation as Presentation,
  TbSearch as Search,
  TbSparkles as Sparkles,
  TbVideo as Video,
} from 'react-icons/tb'
import { groupOpportunitiesByStatus } from '../lib/opportunityStatus.js'
import { regionKey, regionLabel, regionFilterPrefix } from '../lib/regions.js'

const KINDS = [
  { key: 'all', label: 'All types', icon: Layers3 },
  { key: 'event', label: 'Event', icon: CalendarDays },
  { key: 'workshop', label: 'Workshop', icon: Presentation },
  { key: 'hackathon', label: 'Hackathon', icon: Code2 },
  { key: 'opportunity', label: 'Opportunity', icon: Sparkles },
  { key: 'call', label: 'Open call', icon: Megaphone },
  { key: 'training', label: 'Training', icon: GraduationCap },
]

const FORMATS = [
  { key: 'all', label: 'Any format', icon: MonitorSmartphone },
  { key: 'online', label: 'Online', icon: Video },
  { key: 'in_person', label: 'In person', icon: MapPin },
  { key: 'hybrid', label: 'Hybrid', icon: Blend },
]

const KIND_LABEL = Object.fromEntries(
  KINDS.filter((k) => k.key !== 'all').map((k) => [k.key, k.label]),
)

const FORMAT_LABEL = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Hybrid',
}

function OpportunityCard({
  item,
  kindFilterState,
  formatFilterState,
  regionFilterState,
  onKindFilter,
  onFormatFilter,
  onRegionFilter,
}) {
  const where = item.format === 'online' ? null : item.location
  return (
    <article className="card entityCard opportunityCard">
      {item.linkUrl && (
        <a
          className="entityCardLinkOverlay"
          href={item.linkUrl}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`${item.title} — open details`}
        />
      )}
      <div className="entityCardHeading opportunityCardCopy">
        <h3>{item.title}</h3>
        {item.organizationName && (
          <p className="metaMuted">{item.organizationName}</p>
        )}
      </div>
      <div className="entityCardTags">
        <FilterChip
          tone="accent"
          state={kindFilterState}
          onClick={onKindFilter}
        >
          {KIND_LABEL[item.kind] || item.kind}
        </FilterChip>
        <FilterChip state={formatFilterState} onClick={onFormatFilter}>
          {FORMAT_LABEL[item.format] || item.format}
        </FilterChip>
        {item.region && (
          <FilterChip state={regionFilterState} onClick={onRegionFilter}>
            {regionLabel(item.region)}
          </FilterChip>
        )}
      </div>
      {item.summary && <p className="entityCardSummary">{item.summary}</p>}
      {where && (
        <p className="entityCardMetaRow">
          <MapPin size={14} aria-hidden />
          <span>{where}</span>
        </p>
      )}
      {(item.startsAt || item.deadlineAt) && (
        <div className="entityCardFooter">
          {item.startsAt && <CardSchedule iso={item.startsAt} label="Starts" />}
          {item.deadlineAt && (
            <LifecycleTiming iso={item.deadlineAt} label="Apply by" />
          )}
        </div>
      )}
    </article>
  )
}

export function Opportunities() {
  const [kindFilters, setKindFilters] = useState({})
  const [formatFilters, setFormatFilters] = useState({})
  const [regionFilters, setRegionFilters] = useState({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('deadline')
  const query = useApi('/member/opportunities?kind=all&format=all')

  return (
    <div>
      <PageHeader
        icon={OpportunitiesIcon}
        title="Opportunities"
        description="Shared open calls, fellowships, speaker slots, and events from constituency channels — plus postings from organisations in the Hub."
      />
      <Async
        query={query}
        empty={(data) =>
          data.items.length === 0 ? (
            <Empty
              icon={Megaphone}
              title="Nothing posted for this filter"
              body="Channel digests and organisation postings appear here. Try another type or format."
            />
          ) : null
        }
      >
        {(data) => {
          const normalizedItems = data.items.map((item) => ({
            ...item,
            region: regionKey(item.region),
          }))
          const regions = [
            ...new Set(normalizedItems.map((item) => item.region)),
          ]
            .filter(Boolean)
            .sort((a, b) => regionLabel(a).localeCompare(regionLabel(b)))
          const needle = search.trim().toLocaleLowerCase()
          const items = normalizedItems
            .filter(
              (item) =>
                matchesFilters(item.kind, kindFilters) &&
                matchesFilters(item.format, formatFilters) &&
                matchesFilters(item.region, regionFilters) &&
                (!needle ||
                  [
                    item.title,
                    item.organizationName,
                    item.summary,
                    item.location,
                    regionLabel(item.region),
                  ]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a, b) => {
              if (sort === 'title') return a.title.localeCompare(b.title)
              const now = Date.now()
              const aTime = new Date(a.deadlineAt || 0).getTime()
              const bTime = new Date(b.deadlineAt || 0).getTime()
              const aUpcoming = aTime >= now
              const bUpcoming = bTime >= now
              if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
              return aUpcoming ? aTime - bTime : bTime - aTime
            })
          const groupedItems = groupOpportunitiesByStatus(items)
          const renderCards = (group) =>
            group.map((item) => (
              <OpportunityCard
                key={item.id}
                item={item}
                kindFilterState={kindFilters[item.kind] || 'neutral'}
                formatFilterState={formatFilters[item.format] || 'neutral'}
                regionFilterState={regionFilters[item.region] || 'neutral'}
                onKindFilter={() =>
                  setKindFilters((current) => toggleFilter(current, item.kind))
                }
                onFormatFilter={() =>
                  setFormatFilters((current) =>
                    toggleFilter(current, item.format),
                  )
                }
                onRegionFilter={
                  item.region
                    ? () =>
                        setRegionFilters((current) =>
                          toggleFilter(current, item.region),
                        )
                    : undefined
                }
              />
            ))

          return (
            <>
              <div className="catalogTools">
                <div className="catalogSearchRow">
                  <label className="searchInputWrap">
                    <span className="srOnly">Search opportunities</span>
                    <Search size={18} strokeWidth={1.75} aria-hidden />
                    <input
                      className="input"
                      type="search"
                      placeholder="Search opportunities"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <div className="sortControl" aria-label="Sort opportunities">
                    <SortButton
                      active={sort === 'deadline'}
                      icon={CalendarClock}
                      onClick={() => setSort('deadline')}
                    >
                      Deadline
                    </SortButton>
                    <SortButton
                      active={sort === 'title'}
                      icon={ArrowDownAZ}
                      onClick={() => setSort('title')}
                    >
                      Title A–Z
                    </SortButton>
                  </div>
                </div>
                <div className="catalogControlRow catalogFilterRow">
                  <FilterMenu
                    onClear={() => {
                      setKindFilters({})
                      setFormatFilters({})
                      setRegionFilters({})
                    }}
                    label="Filter opportunities"
                    activeCount={
                      activeFilterCount(kindFilters) +
                      activeFilterCount(formatFilters) +
                      activeFilterCount(regionFilters)
                    }
                  >
                    <fieldset className="filterLevel">
                      <legend>Type</legend>
                      <div className="pillRow">
                        {KINDS.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={
                              item.key === 'all' &&
                              activeFilterCount(kindFilters) === 0
                            }
                            state={
                              item.key === 'all'
                                ? undefined
                                : kindFilters[item.key] || 'neutral'
                            }
                            icon={item.icon}
                            onClick={() => {
                              if (item.key === 'all') setKindFilters({})
                              else {
                                setKindFilters((current) =>
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
                      <legend>Format</legend>
                      <div className="pillRow">
                        {FORMATS.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={
                              item.key === 'all' &&
                              activeFilterCount(formatFilters) === 0
                            }
                            state={
                              item.key === 'all'
                                ? undefined
                                : formatFilters[item.key] || 'neutral'
                            }
                            icon={item.icon}
                            onClick={() => {
                              if (item.key === 'all') setFormatFilters({})
                              else {
                                setFormatFilters((current) =>
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
                    {regions.length > 0 && (
                      <fieldset className="filterLevel">
                        <legend>Region</legend>
                        <div className="pillRow">
                          <FilterPill
                            active={activeFilterCount(regionFilters) === 0}
                            icon={Map}
                            onClick={() => setRegionFilters({})}
                          >
                            All regions
                          </FilterPill>
                          {regions.map((region) => (
                            <FilterPill
                              key={region}
                              state={regionFilters[region] || 'neutral'}
                              prefix={regionFilterPrefix(
                                region,
                                regionLabel(region),
                              )}
                              onClick={() =>
                                setRegionFilters((current) =>
                                  toggleFilter(current, region),
                                )
                              }
                            >
                              {regionLabel(region)}
                            </FilterPill>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </FilterMenu>
                </div>
              </div>
              {items.length ? (
                <div className="opportunityGroups">
                  {groupedItems.open.length > 0 && (
                    <Section
                      label="Open"
                      meta={`${groupedItems.open.length} ${
                        groupedItems.open.length === 1 ? 'posting' : 'postings'
                      }`}
                    >
                      <div className="cardGrid">
                        {renderCards(groupedItems.open)}
                      </div>
                    </Section>
                  )}
                  {groupedItems.closed.length > 0 && (
                    <Section
                      label="Closed"
                      meta={`${groupedItems.closed.length} ${
                        groupedItems.closed.length === 1
                          ? 'posting'
                          : 'postings'
                      }`}
                    >
                      <div className="cardGrid">
                        {renderCards(groupedItems.closed)}
                      </div>
                    </Section>
                  )}
                </div>
              ) : (
                <Empty
                  icon={Search}
                  title="No opportunities match"
                  body="Try clearing a filter or changing the search."
                />
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
