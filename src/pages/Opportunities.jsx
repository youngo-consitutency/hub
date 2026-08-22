import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { fmtDual } from '../lib/time.js'
import {
  activeFilterCount,
  matchesFilters,
  toggleFilter,
} from '../lib/filterState.js'
import {
  Async,
  CountdownChip,
  Empty,
  FilterMenu,
  FilterPill,
  PageHeader,
  SortButton,
} from '../components/ui.jsx'
import {
  ArrowDownAZ,
  CalendarClock,
  CalendarDays,
  Code2,
  ExternalLink,
  GraduationCap,
  Layers3,
  Blend,
  Megaphone,
  MapPin,
  MonitorSmartphone,
  Presentation,
  Search,
  Sparkles,
  Video,
} from 'lucide-react'

const KINDS = [
  { key: 'all', label: 'All', icon: Layers3 },
  { key: 'event', label: 'Events', icon: CalendarDays },
  { key: 'workshop', label: 'Workshops', icon: Presentation },
  { key: 'hackathon', label: 'Hackathons', icon: Code2 },
  { key: 'opportunity', label: 'Opportunities', icon: Sparkles },
  { key: 'call', label: 'Open calls', icon: Megaphone },
  { key: 'training', label: 'Training', icon: GraduationCap },
]

const FORMATS = [
  { key: 'all', label: 'Any format', icon: MonitorSmartphone },
  { key: 'online', label: 'Online', icon: Video },
  { key: 'in_person', label: 'In person', icon: MapPin },
  { key: 'hybrid', label: 'Hybrid', icon: Blend },
]

const KIND_LABEL = Object.fromEntries(
  KINDS.filter((k) => k.key !== 'all').map((k) => [
    k.key,
    k.label.replace(/s$/, ''),
  ]),
)

const FORMAT_LABEL = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Hybrid',
}

function OpportunityCard({ item }) {
  const where =
    item.format === 'online'
      ? 'Online'
      : item.location || FORMAT_LABEL[item.format]
  const Card = item.linkUrl ? 'a' : 'article'
  return (
    <Card
      className="card entityCard opportunityCard"
      href={item.linkUrl || undefined}
      target={item.linkUrl ? '_blank' : undefined}
      rel={item.linkUrl ? 'noreferrer noopener' : undefined}
      aria-label={item.linkUrl ? `${item.title} — open details` : undefined}
    >
      <div className="opportunityCardHeader">
        <div className="opportunityTags">
          <span className="chip chip-accent">
            {KIND_LABEL[item.kind] || item.kind}
          </span>
          <span className="chip chip-neutral">
            {FORMAT_LABEL[item.format] || item.format}
          </span>
          {item.region && (
            <span className="chip chip-neutral">{item.region}</span>
          )}
        </div>
        {item.linkUrl && (
          <ExternalLink size={17} strokeWidth={1.75} aria-hidden />
        )}
      </div>

      <div className="opportunityCardCopy">
        <h3>{item.title}</h3>
        <div className="opportunityOrganisationRow">
          <p className="metaMuted">{item.organizationName}</p>
          <span className="opportunityPlace metaMuted">
            <MapPin size={14} strokeWidth={1.75} aria-hidden />
            {where}
          </span>
        </div>
        {item.summary && <p className="meta">{item.summary}</p>}
      </div>

      <div className="opportunityMeta">
        {item.startsAt && (
          <p className="entityCardMetaRow">
            <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
            <span>{fmtDual(item.startsAt)}</span>
          </p>
        )}
      </div>

      {item.deadlineAt && (
        <div className="opportunityDeadline">
          <CountdownChip iso={item.deadlineAt} label="Applications close" />
        </div>
      )}
    </Card>
  )
}

export function Opportunities() {
  const [kindFilters, setKindFilters] = useState({})
  const [formatFilters, setFormatFilters] = useState({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('deadline')
  const query = useApi('/member/opportunities?kind=all&format=all')

  return (
    <div>
      <PageHeader
        eyebrow="Open calls & postings"
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
          const needle = search.trim().toLocaleLowerCase()
          const items = data.items
            .filter(
              (item) =>
                matchesFilters(item.kind, kindFilters) &&
                matchesFilters(item.format, formatFilters) &&
                (!needle ||
                  [
                    item.title,
                    item.organizationName,
                    item.summary,
                    item.location,
                    item.region,
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
                    label="Filter opportunities"
                    activeCount={
                      activeFilterCount(kindFilters) +
                      activeFilterCount(formatFilters)
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
                  </FilterMenu>
                </div>
              </div>
              <p className="resultsSummary" role="status">
                {items.length} of {data.items.length} postings
              </p>
              {items.length ? (
                <div className="cardGrid">
                  {items.map((item) => (
                    <OpportunityCard key={item.id} item={item} />
                  ))}
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
