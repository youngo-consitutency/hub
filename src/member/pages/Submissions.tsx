import type { AnyValue, Doc } from '../lib/types'
import { CatalogueResults } from '../components/CatalogueResults'
import { TbFileText as PolicyIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, Empty, A, FilterMenu, FilterPill, PageHeader, SortButton } from '../components/ui'
import { SubmissionCard } from '../components/cards'
import { SubmissionPeek } from '../components/EntityPeeks'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { activeFilterCount, matchesFilters, toggleFilter } from '../lib/filterState'
import {
  TbArchive as Archive,
  TbSortAscendingLetters as ArrowDownAZ,
  TbCalendarTime as CalendarClock,
  TbCircleCheck as CheckCircle2,
  TbFileTime as FileClock,
  TbFilePencil as FilePenLine,
  TbFileText as FileText,
  TbFilter as ListFilter,
  TbSearch as Search,
  TbTags as Tags,
} from 'react-icons/tb'

const OPEN_STATUSES = [
  { key: 'all', label: 'All stages', icon: ListFilter },
  { key: 'open', label: 'Open', icon: FileClock },
  { key: 'drafting', label: 'Drafting', icon: FilePenLine },
  { key: 'internal_review', label: 'Internal review', icon: CheckCircle2 },
]

const ARCHIVE_STATUSES = [
  { key: 'all', label: 'All outcomes', icon: ListFilter },
  { key: 'submitted', label: 'Submitted', icon: CheckCircle2 },
  { key: 'archived', label: 'Archived', icon: Archive },
]

/** Browse open or archived submissions with search, stage and group filters, sorting and layouts. */
export function Submissions() {
  const [state, setState] = useState('open')
  const [statusFilters, setStatusFilters] = useState<Doc>({})
  const [groupFilters, setGroupFilters] = useState<Doc>({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [selectedSubmission, setSelectedSubmission] = useState<AnyValue | null>(null)
  const query = useApi(`/submissions?state=${state}`, [state])

  const changeState = (nextState: AnyValue) => {
    setState(nextState)
    setStatusFilters({})
    setGroupFilters({})
    setSort('date')
  }

  return (
    <div>
      <PageHeader
        icon={PolicyIcon}
        title="Submissions"
        description="Open drafting processes and YOUNGO’s submitted positions."
      >
        <PageSectionNav section="policy" />
        <div className="viewSwitch" role="group" aria-label="Submission view">
          <FilterPill active={state === 'open'} icon={FileText} onClick={() => changeState('open')}>
            Open
          </FilterPill>
          <FilterPill
            active={state === 'archive'}
            icon={Archive}
            onClick={() => changeState('archive')}
          >
            Archive
          </FilterPill>
        </div>
      </PageHeader>
      <Async
        query={query}
        empty={(d: AnyValue) =>
          d.items.length === 0 ? (
            state === 'open' ? (
              <Empty
                icon={FileText}
                title="Nothing open right now"
                body="The archive shows what YOUNGO has said before."
                cta={
                  <A
                    href="#"
                    className="btn btn-secondary btn-sm"
                    onClick={(e: AnyValue) => {
                      e.preventDefault()
                      setState('archive')
                    }}
                  >
                    View archive
                  </A>
                }
              />
            ) : (
              <Empty icon={FileText} title="No archived submissions yet" />
            )
          ) : null
        }
      >
        {(data: Doc) => {
          const statuses = state === 'open' ? OPEN_STATUSES : ARCHIVE_STATUSES
          const groups = [
            ...new Map(
              data.items.filter((item: Doc) => item.wg).map((item: Doc) => [item.wg.slug, item.wg]),
            ).values(),
          ].sort((a, b) => (a as AnyValue).name.localeCompare((b as AnyValue).name))
          const needle = search.trim().toLocaleLowerCase()
          const submissions = data.items
            .filter(
              (submission: Doc) =>
                matchesFilters(submission.status, statusFilters) &&
                matchesFilters(submission.wg?.slug, groupFilters) &&
                (!needle ||
                  [submission.title, submission.description, submission.wg?.name]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a: AnyValue, b: AnyValue) =>
              sort === 'title'
                ? a.title.localeCompare(b.title)
                : state === 'archive'
                  ? String(b.deadlineAt || '').localeCompare(String(a.deadlineAt || ''))
                  : String(a.deadlineAt || '9999').localeCompare(String(b.deadlineAt || '9999')),
            )

          return (
            <>
              <div className="catalogTools">
                <div className="catalogSearchRow">
                  <label className="searchInputWrap">
                    <span className="srOnly">Search submissions</span>
                    <Search size={18} strokeWidth={1.75} aria-hidden />
                    <input
                      className="input"
                      type="search"
                      placeholder="Search submissions or working groups"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <div className="sortControl" aria-label="Sort submissions">
                    <SortButton
                      active={sort === 'date'}
                      icon={CalendarClock}
                      onClick={() => setSort('date')}
                    >
                      {state === 'open' ? 'Deadline' : 'Latest'}
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
                      setStatusFilters({})
                      setGroupFilters({})
                    }}
                    activeCount={activeFilterCount(statusFilters) + activeFilterCount(groupFilters)}
                  >
                    <fieldset className="filterLevel">
                      <legend>{state === 'open' ? 'Stage' : 'Outcome'}</legend>
                      <div className="pillRow">
                        {statuses.map((item) => (
                          <FilterPill
                            key={item.key}
                            active={item.key === 'all' && activeFilterCount(statusFilters) === 0}
                            state={
                              item.key === 'all' ? undefined : statusFilters[item.key] || 'neutral'
                            }
                            icon={item.icon}
                            onClick={() => {
                              if (item.key === 'all') setStatusFilters({})
                              else {
                                setStatusFilters((current) => toggleFilter(current, item.key))
                              }
                            }}
                          >
                            {item.label}
                          </FilterPill>
                        ))}
                      </div>
                    </fieldset>
                    {groups.length > 1 && (
                      <fieldset className="filterLevel">
                        <legend>Working group</legend>
                        <div className="pillRow">
                          <FilterPill
                            active={activeFilterCount(groupFilters) === 0}
                            icon={Tags}
                            onClick={() => setGroupFilters({})}
                          >
                            All groups
                          </FilterPill>
                          {groups.map((item) => (
                            <FilterPill
                              key={(item as AnyValue).slug}
                              state={groupFilters[(item as AnyValue).slug] || 'neutral'}
                              icon={workingGroupIcon((item as AnyValue).slug)}
                              onClick={() =>
                                setGroupFilters((current) =>
                                  toggleFilter(current, (item as AnyValue).slug),
                                )
                              }
                            >
                              {(item as AnyValue).name}
                            </FilterPill>
                          ))}
                        </div>
                      </fieldset>
                    )}
                  </FilterMenu>
                </div>
              </div>
              <CatalogueResults count={submissions.length}>
                {submissions.length ? (
                  <div className="cardGrid">
                    {submissions.map((submission: Doc) => (
                      <SubmissionCard
                        key={submission.slug}
                        sub={submission}
                        statusFilterState={statusFilters[submission.status] || 'neutral'}
                        groupFilterState={groupFilters[submission.wg?.slug] || 'neutral'}
                        onStatusFilter={() =>
                          setStatusFilters((current) => toggleFilter(current, submission.status))
                        }
                        onGroupFilter={
                          submission.wg
                            ? () =>
                                setGroupFilters((current) =>
                                  toggleFilter(current, submission.wg.slug),
                                )
                            : undefined
                        }
                        onPeek={(selected) => setSelectedSubmission(selected)}
                      />
                    ))}
                  </div>
                ) : (
                  <Empty
                    icon={Search}
                    title="No submissions match"
                    body="Try a different stage, working group, or search term."
                  />
                )}
              </CatalogueResults>
            </>
          )
        }}
      </Async>
      <SubmissionPeek item={selectedSubmission} onClose={() => setSelectedSubmission(null)} />
    </div>
  )
}
