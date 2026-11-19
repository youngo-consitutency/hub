import type { SubmissionSummary } from '../../shared/contracts'
import type { SubmissionDetail } from '../../shared/contracts'
import { usePeek } from '../lib/peek'
import { CatalogueResults } from '../components/CatalogueResults'
import { TbFileText as PolicyIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav'
import { useState } from 'react'
import { useApi } from '../lib/api'
import {
  Async,
  Empty,
  FilterMenu,
  FilterPill,
  PageHeader,
  SortButton,
  CatalogToolbar,
} from '../components/ui'
import { SubmissionCard } from '../components/cards'
import { SubmissionPeek } from '../components/EntityPeeks'
import { workingGroupIcon } from '../lib/workingGroupIcons'
import { activeFilterCount, matchesFilters, toggleFilter } from '../lib/filterState'
import type { FilterMap } from '../lib/filterState'
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
export function Submissions({ slug }: { slug?: string }) {
  const [state, setState] = useState('open')
  const [statusFilters, setStatusFilters] = useState<FilterMap>({})
  const [groupFilters, setGroupFilters] = useState<FilterMap>({})
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const panel = usePeek<SubmissionDetail>('/submissions', '/submissions', slug)
  const query = useApi<{ items: SubmissionSummary[] }>(`/submissions?state=${state}`, {
    keepPrevious: true,
  })

  const changeState = (nextState: string) => {
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
        empty={(d) =>
          d.items.length === 0 ? (
            state === 'open' ? (
              <Empty
                icon={FileText}
                title="Nothing open right now"
                body="The archive shows what YOUNGO has said before."
                cta={
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setState('archive')}
                  >
                    View archive
                  </button>
                }
              />
            ) : (
              <Empty icon={FileText} title="No archived submissions yet" />
            )
          ) : null
        }
      >
        {(data) => {
          const statuses = state === 'open' ? OPEN_STATUSES : ARCHIVE_STATUSES
          const groups = [
            ...new Map(
              data.items.flatMap((item) => (item.wg ? [[item.wg.slug, item.wg] as const] : [])),
            ).values(),
          ].sort((a, b) => a.name.localeCompare(b.name))
          const needle = search.trim().toLocaleLowerCase()
          const submissions = data.items
            .filter(
              (submission) =>
                matchesFilters(submission.status, statusFilters) &&
                matchesFilters(submission.wg?.slug, groupFilters) &&
                (!needle ||
                  [submission.title, submission.contributeNote, submission.wg?.name]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a, b) =>
              sort === 'title'
                ? a.title.localeCompare(b.title)
                : state === 'archive'
                  ? String(b.deadlineAt || '').localeCompare(String(a.deadlineAt || ''))
                  : String(a.deadlineAt || '9999').localeCompare(String(b.deadlineAt || '9999')),
            )

          return (
            <>
              <CatalogToolbar
                search={{
                  label: 'Search submissions',
                  placeholder: 'Search submissions or working groups',
                  value: search,
                  onChange: setSearch,
                }}
                sortLabel="Sort submissions"
                sort={
                  <>
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
                  </>
                }
                filters={
                  <>
                    <FilterMenu
                      onClear={() => {
                        setStatusFilters({})
                        setGroupFilters({})
                      }}
                      activeCount={
                        activeFilterCount(statusFilters) + activeFilterCount(groupFilters)
                      }
                    >
                      <fieldset className="filterLevel">
                        <legend>{state === 'open' ? 'Stage' : 'Outcome'}</legend>
                        <div className="pillRow">
                          {statuses.map((item) => (
                            <FilterPill
                              key={item.key}
                              active={item.key === 'all' && activeFilterCount(statusFilters) === 0}
                              state={
                                item.key === 'all'
                                  ? undefined
                                  : statusFilters[item.key] || 'neutral'
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
                                key={item.slug}
                                state={groupFilters[item.slug] || 'neutral'}
                                icon={workingGroupIcon(item.slug)}
                                onClick={() =>
                                  setGroupFilters((current) => toggleFilter(current, item.slug))
                                }
                              >
                                {item.name}
                              </FilterPill>
                            ))}
                          </div>
                        </fieldset>
                      )}
                    </FilterMenu>
                  </>
                }
              />
              <CatalogueResults count={submissions.length}>
                {submissions.length ? (
                  <div className="cardGrid">
                    {submissions.map((submission) => {
                      const { wg } = submission
                      return (
                        <SubmissionCard
                          key={submission.slug}
                          sub={submission}
                          statusFilterState={statusFilters[submission.status] || 'neutral'}
                          groupFilterState={(wg && groupFilters[wg.slug]) || 'neutral'}
                          onStatusFilter={() =>
                            setStatusFilters((current) => toggleFilter(current, submission.status))
                          }
                          onGroupFilter={
                            wg
                              ? () => setGroupFilters((current) => toggleFilter(current, wg.slug))
                              : undefined
                          }
                        />
                      )
                    })}
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
      <SubmissionPeek item={panel.item} onClose={panel.close} />
    </div>
  )
}
