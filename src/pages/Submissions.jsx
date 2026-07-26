import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, A, FilterPill, PageHeader } from '../components/ui.jsx'
import { SubmissionCard } from '../components/cards.jsx'
import {
  Archive,
  ArrowDownAZ,
  CalendarClock,
  CheckCircle2,
  FileClock,
  FilePenLine,
  FileText,
  ListFilter,
  Search,
  Tags,
} from 'lucide-react'

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

export function Submissions() {
  const [state, setState] = useState('open')
  const [status, setStatus] = useState('all')
  const [group, setGroup] = useState('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const query = useApi(`/submissions?state=${state}`, [state])

  const changeState = (nextState) => {
    setState(nextState)
    setStatus('all')
    setGroup('all')
    setSort('date')
  }

  return (
    <div>
      <PageHeader
        eyebrow="Policy work"
        title="Submissions"
        description="Open drafting processes and YOUNGO’s submitted positions."
      >
        <div className="pillRow" aria-label="Filter submissions">
          <FilterPill
            active={state === 'open'}
            icon={FileText}
            onClick={() => changeState('open')}
          >
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
                  <A
                    href="#"
                    className="btn btn-secondary btn-sm"
                    onClick={(e) => {
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
        {(data) => {
          const statuses = state === 'open' ? OPEN_STATUSES : ARCHIVE_STATUSES
          const groups = [
            ...new Map(
              data.items
                .filter((item) => item.wg)
                .map((item) => [item.wg.slug, item.wg]),
            ).values(),
          ].sort((a, b) => a.name.localeCompare(b.name))
          const needle = search.trim().toLocaleLowerCase()
          const submissions = data.items
            .filter(
              (submission) =>
                (status === 'all' || submission.status === status) &&
                (group === 'all' || submission.wg?.slug === group) &&
                (!needle ||
                  [
                    submission.title,
                    submission.description,
                    submission.wg?.name,
                  ]
                    .join(' ')
                    .toLocaleLowerCase()
                    .includes(needle)),
            )
            .sort((a, b) =>
              sort === 'title'
                ? a.title.localeCompare(b.title)
                : state === 'archive'
                  ? String(b.deadlineAt || '').localeCompare(
                      String(a.deadlineAt || ''),
                    )
                  : String(a.deadlineAt || '9999').localeCompare(
                      String(b.deadlineAt || '9999'),
                    ),
            )

          return (
            <>
              <div className="catalogTools">
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
                <fieldset className="filterLevel">
                  <legend>{state === 'open' ? 'Stage' : 'Outcome'}</legend>
                  <div className="pillRow">
                    {statuses.map((item) => (
                      <FilterPill
                        key={item.key}
                        active={status === item.key}
                        icon={item.icon}
                        onClick={() => setStatus(item.key)}
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
                        active={group === 'all'}
                        icon={Tags}
                        onClick={() => setGroup('all')}
                      >
                        All groups
                      </FilterPill>
                      {groups.map((item) => (
                        <FilterPill
                          key={item.slug}
                          active={group === item.slug}
                          onClick={() => setGroup(item.slug)}
                        >
                          {item.name}
                        </FilterPill>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="catalogSummary">
                  <p className="resultsSummary" role="status">
                    {submissions.length} of {data.items.length} submissions
                  </p>
                  <div className="pillRow" aria-label="Sort submissions">
                    <FilterPill
                      active={sort === 'date'}
                      icon={CalendarClock}
                      onClick={() => setSort('date')}
                    >
                      {state === 'open' ? 'Deadline' : 'Latest'}
                    </FilterPill>
                    <FilterPill
                      active={sort === 'title'}
                      icon={ArrowDownAZ}
                      onClick={() => setSort('title')}
                    >
                      Title A–Z
                    </FilterPill>
                  </div>
                </div>
              </div>
              {submissions.length ? (
                <div className="cardGrid">
                  {submissions.map((submission) => (
                    <SubmissionCard key={submission.slug} sub={submission} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Search}
                  title="No submissions match"
                  body="Try a different stage, working group, or search term."
                />
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
