import { TbUsersGroup as GroupsIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav.jsx'
import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, FilterMenu, FilterPill, PageHeader, SortButton } from '../components/ui.jsx'
import { GroupCard } from '../components/cards.jsx'
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
import { useDocument } from '../lib/documents.js'
import { activeFilterCount, matchesFilters, toggleFilter } from '../lib/filterState.js'

const TOPIC_ICONS = {
  'climate-action': CloudSun,
  'nature-food': Leaf,
  'people-rights': HeartHandshake,
  'economy-technology': Zap,
  'participation-learning': GraduationCap,
  'governance-integrity': ShieldCheck,
}

export function Groups() {
  const [search, setSearch] = useState('')
  const [topics, setTopics] = useState({})
  const [descending, setDescending] = useState(false)
  const query = useApi('/groups')
  const { doc: directory } = useDocument('directory')
  const topicList = directory?.topics || []
  const topicLabel = (key) => topicList.find((t) => t.key === key)?.label || key

  return (
    <div>
      <PageHeader icon={GroupsIcon} title="Working groups">
        <PageSectionNav section="groups" />
      </PageHeader>
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? <Empty icon={Users} title="No working groups yet" /> : null
        }
      >
        {(data) => {
          const needle = search.trim().toLocaleLowerCase()
          const groups = data.items
            .filter((group) => {
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
            .sort((a, b) =>
              descending ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name),
            )

          const renderGroup = (group) => (
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
                        {topicList.map((item) => (
                          <FilterPill
                            key={item.key}
                            state={topics[item.key] || 'neutral'}
                            icon={TOPIC_ICONS[item.key]}
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
              {groups.length ? (
                <div className="cardGrid">{groups.map(renderGroup)}</div>
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
