import { useState } from 'react'
import { useApi } from '../lib/api.js'
import {
  Async,
  Empty,
  A,
  FilterMenu,
  FilterPill,
  PageHeader,
  SortButton,
} from '../components/ui.jsx'
import { DecisionCard } from '../components/cards.jsx'
import {
  activeFilterCount,
  matchesFilters,
  toggleFilter,
} from '../lib/filterState.js'
import {
  TbArchive as Archive,
  TbCalendarTime as CalendarClock,
  TbCircleCheck as CheckCircle2,
  TbClock as Clock,
  TbFilePlus as FilePlus2,
  TbGavel as Gavel,
  TbFilter as ListFilter,
  TbMessage as MessageSquareText,
  TbSearch as Search,
  TbShieldExclamation as ShieldAlert,
  TbArrowBackUp as Undo2,
  TbCircleX as XCircle,
  TbSortAscendingLetters as ArrowDownAZ,
} from 'react-icons/tb'

const ACTIVE_STATUSES = [
  { key: 'all', label: 'All stages', icon: ListFilter },
  { key: 'proposed', label: 'Proposed', icon: FilePlus2 },
  { key: 'open_for_input', label: 'Open for input', icon: MessageSquareText },
  { key: 'objection_window', label: 'Objection window', icon: ShieldAlert },
]

const DECIDED_STATUSES = [
  { key: 'all', label: 'All outcomes', icon: ListFilter },
  { key: 'adopted', label: 'Adopted', icon: CheckCircle2 },
  { key: 'not_adopted', label: 'Not adopted', icon: XCircle },
  { key: 'withdrawn', label: 'Withdrawn', icon: Undo2 },
]

function decisionDate(decision) {
  return (
    decision.objectionDeadline ||
    decision.inputDeadline ||
    decision.decidedAt ||
    '9999'
  )
}

export function Council() {
  const [state, setState] = useState('active')
  const [statusFilters, setStatusFilters] = useState({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const query = useApi(`/council?state=${state}`, [state])

  const changeState = (nextState) => {
    setState(nextState)
    setStatusFilters({})
    setSort('date')
  }

  return (
    <div>
      <PageHeader
        title="Council"
        description="Decisions moving through YOUNGO’s decision-making process."
      >
        <div className="viewSwitch" role="group" aria-label="Council view">
          <FilterPill
            active={state === 'active'}
            icon={Clock}
            onClick={() => changeState('active')}
          >
            In progress
          </FilterPill>
          <FilterPill
            active={state === 'decided'}
            icon={Archive}
            onClick={() => changeState('decided')}
          >
            Decided
          </FilterPill>
        </div>
      </PageHeader>
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? (
            state === 'active' ? (
              <Empty
                icon={Gavel}
                title="No open decisions"
                body="The archive shows how past decisions went."
                cta={
                  <A
                    href="#"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
                      e.preventDefault()
                      setState('decided')
                    }}
                  >
                    View decided
                  </A>
                }
              />
            ) : (
              <Empty icon={Gavel} title="No decisions recorded yet" />
            )
          ) : null
        }
      >
        {(data) => {
          const statuses =
            state === 'active' ? ACTIVE_STATUSES : DECIDED_STATUSES
          const needle = search.trim().toLocaleLowerCase()
          const decisions = data.items
            .filter(
              (decision) =>
                matchesFilters(decision.status, statusFilters) &&
                (!needle ||
                  [decision.title, decision.summary, decision.proposer]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a, b) =>
              sort === 'title'
                ? a.title.localeCompare(b.title)
                : state === 'decided'
                  ? String(decisionDate(b)).localeCompare(
                      String(decisionDate(a)),
                    )
                  : String(decisionDate(a)).localeCompare(
                      String(decisionDate(b)),
                    ),
            )

          return (
            <>
              <div className="catalogTools">
                <div className="catalogSearchRow">
                  <label className="searchInputWrap">
                    <span className="srOnly">Search Council decisions</span>
                    <Search size={18} strokeWidth={1.75} aria-hidden />
                    <input
                      className="input"
                      type="search"
                      placeholder="Search decisions or proposers"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <div
                    className="sortControl"
                    aria-label="Sort Council decisions"
                  >
                    <SortButton
                      active={sort === 'date'}
                      icon={CalendarClock}
                      onClick={() => setSort('date')}
                    >
                      {state === 'active' ? 'Deadline' : 'Latest'}
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
                  <FilterMenu activeCount={activeFilterCount(statusFilters)}>
                    <fieldset className="filterLevel">
                      <legend>
                        {state === 'active' ? 'Stage' : 'Outcome'}
                      </legend>
                      <div className="pillRow">
                        {statuses.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={
                              item.key === 'all' &&
                              activeFilterCount(statusFilters) === 0
                            }
                            state={
                              item.key === 'all'
                                ? undefined
                                : statusFilters[item.key] || 'neutral'
                            }
                            icon={item.icon}
                            onClick={() => {
                              if (item.key === 'all') setStatusFilters({})
                              else {
                                setStatusFilters((current) =>
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
              {decisions.length ? (
                <div className="cardGrid">
                  {decisions.map((decision) => (
                    <DecisionCard
                      key={decision.slug}
                      decision={decision}
                      statusFilterState={
                        statusFilters[decision.status] || 'neutral'
                      }
                      onStatusFilter={() =>
                        setStatusFilters((current) =>
                          toggleFilter(current, decision.status),
                        )
                      }
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Search}
                  title="No decisions match"
                  body="Try a different stage or search term."
                />
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
