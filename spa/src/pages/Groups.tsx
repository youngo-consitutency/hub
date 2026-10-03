import { CatalogueResults } from '../components/CatalogueResults'
import { TbUsersGroup as GroupsIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, Empty, FilterMenu, FilterPill, PageHeader, SortButton } from '../components/ui'
import { GroupCard } from '../components/cards'
import {
  TbSortAscendingLetters as ArrowDownAZ,
  TbSortDescendingLetters as ArrowUpAZ,
  TbCloud as CloudSun,
  TbSchool as GraduationCap,
  TbHeartHandshake as HeartHandshake,
  TbLeaf as Leaf,
  TbSearch as Search,
  TbShieldCheck as ShieldCheck,
  TbTags as Tags,
  TbUsers as Users,
  TbBolt as Zap,
} from 'react-icons/tb'
import { useDocument } from '../lib/documents'
import { activeFilterCount, matchesFilters, toggleFilter } from '../lib/filterState'

const TOPIC_ICONS = {
  'climate-action': CloudSun,
  'nature-food': Leaf,
  'people-rights': HeartHandshake,
  'economy-technology': Zap,
  'participation-learning': GraduationCap,
  'governance-integrity': ShieldCheck,
}

/** Browse working groups with search, topic filters, name sorting and catalogue layouts. */
export function Groups() {
  const [search, setSearch] = useState('')
  const [topics, setTopics] = useState<Record<string, any>>({})
  const [descending, setDescending] = useState(false)
  const query = useApi('/groups')
  const { doc: directory } = useDocument('directory')
  const topicList = directory?.topics || []
  const topicLabel = (key: any) => topicList.find((t: any) => t.key === key)?.label || key

  return (
    <div>
      <PageHeader icon={GroupsIcon} title="Working groups">
        <PageSectionNav section="groups" />
      </PageHeader>
      <Async
        query={query}
        empty={(d: any) =>
          d.items.length === 0 ? <Empty icon={Users} title="No working groups yet" /> : null
        }
      >
        {(data: any) => {
          const needle = search.trim().toLocaleLowerCase()
          const groups = data.items
            .filter((group: any) => {
              const matchesSearch =
                !needle ||
                [group.name, group.focusLine, topicLabel(group.topic)]
                  .join(' ')
                  .toLocaleLowerCase()
                  .includes(needle)
              const topicKey = group.topic
              const matchesTopic = matchesFilters(topicKey, topics)
              return matchesSearch && matchesTopic
            })
            .sort((a: any, b: any) =>
              descending ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
            )

          const renderGroup = (group: any) => (
            <GroupCard
              key={group.slug}
              group={group}
              topicFilterState={topics[group.topic] || 'neutral'}
              onTopicFilter={() => {
                const topicKey = group.topic
                if (!topicKey) return
                setTopics((current) => toggleFilter(current, topicKey))
              }}
            />
          )

          return (
            <>
              <div className="catalogTools">
                <div className="catalogSearchRow">
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
                  <div className="catalogDisplayControls">
                    <div className="sortControl" aria-label="Sort groups">
                      <SortButton
                        active
                        icon={descending ? ArrowUpAZ : ArrowDownAZ}
                        onClick={() => setDescending((current) => !current)}
                      >
                        Name {descending ? 'Z–A' : 'A–Z'}
                      </SortButton>
                    </div>
                  </div>
                </div>
                <div className="catalogControlRow catalogFilterRow">
                  <FilterMenu activeCount={activeFilterCount(topics)} onClear={() => setTopics({})}>
                    <fieldset className="filterLevel">
                      <legend>Topics</legend>
                      <div className="pillRow">
                        <FilterPill
                          active={activeFilterCount(topics) === 0}
                          icon={Tags}
                          onClick={() => setTopics({})}
                        >
                          All topics
                        </FilterPill>
                        {topicList.map((item: any) => (
                          <FilterPill
                            key={item.key}
                            state={topics[item.key] || 'neutral'}
                            icon={(TOPIC_ICONS as any)[item.key]}
                            onClick={() => setTopics((current) => toggleFilter(current, item.key))}
                          >
                            {item.label}
                          </FilterPill>
                        ))}
                      </div>
                    </fieldset>
                  </FilterMenu>
                </div>
              </div>
              <CatalogueResults count={groups.length}>
                {groups.length ? (
                  <div className="cardGrid">{groups.map(renderGroup)}</div>
                ) : (
                  <Empty
                    icon={Search}
                    title="No groups match"
                    body="Try a different topic or search term."
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
