import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, FilterPill, PageHeader } from '../components/ui.jsx'
import { GroupCard } from '../components/cards.jsx'
import { ArrowDownAZ, Search, Tags, Users } from 'lucide-react'

export function Groups() {
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('all')
  const [descending, setDescending] = useState(false)
  const query = useApi('/groups')

  return (
    <div>
      <PageHeader
        eyebrow="Community"
        title="Working groups"
        description="Search by topic, compare meeting schedules, and open a group workspace."
      />
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? (
            <Empty icon={Users} title="No working groups yet" />
          ) : null
        }
      >
        {(data) => {
          const tags = [
            ...new Set(data.items.flatMap((group) => group.tags || [])),
          ].sort((a, b) => a.localeCompare(b))
          const needle = search.trim().toLocaleLowerCase()
          const groups = data.items
            .filter((group) => {
              const matchesSearch =
                !needle ||
                [group.name, group.focusLine, ...(group.tags || [])]
                  .join(' ')
                  .toLocaleLowerCase()
                  .includes(needle)
              const matchesTag = tag === 'all' || group.tags?.includes(tag)
              return matchesSearch && matchesTag
            })
            .sort((a, b) =>
              descending
                ? b.name.localeCompare(a.name)
                : a.name.localeCompare(b.name),
            )

          return (
            <>
              <div className="catalogTools">
                <label className="searchInputWrap">
                  <span className="srOnly">Search working groups</span>
                  <Search size={18} strokeWidth={1.75} aria-hidden />
                  <input
                    className="input"
                    type="search"
                    placeholder="Search groups or topics"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <fieldset className="filterLevel">
                  <legend>Topics</legend>
                  <div className="pillRow">
                    <FilterPill
                      active={tag === 'all'}
                      icon={Tags}
                      onClick={() => setTag('all')}
                    >
                      All topics
                    </FilterPill>
                    {tags.map((item) => (
                      <FilterPill
                        key={item}
                        active={tag === item}
                        onClick={() => setTag(item)}
                      >
                        {item}
                      </FilterPill>
                    ))}
                  </div>
                </fieldset>
                <div className="catalogSummary">
                  <p className="resultsSummary" role="status">
                    {groups.length} of {data.items.length} groups
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDescending((current) => !current)}
                  >
                    <ArrowDownAZ size={16} strokeWidth={1.75} aria-hidden />
                    Name {descending ? 'Z–A' : 'A–Z'}
                  </button>
                </div>
              </div>
              {groups.length ? (
                <div className="cardGrid">
                  {groups.map((group) => (
                    <GroupCard key={group.slug} group={group} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={Search}
                  title="No groups match"
                  body="Try a different topic or search term."
                />
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
