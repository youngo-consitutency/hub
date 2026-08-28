import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, PageHeader, Section } from '../components/ui.jsx'
import {
  ContactCard,
  PersonCard,
  WorkingGroupContactCard,
} from '../components/cards.jsx'
import { DIRECTORY_LAYERS } from '../content/directory.js'
import { WORKING_GROUPS } from '../../shared/workingGroups.js'
import {
  TbAt as AtSign,
  TbSearch as Search,
  TbUsers as Users,
} from 'react-icons/tb'

function PeopleDirectory() {
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [workingGroup, setWorkingGroup] = useState('')
  const [tag, setTag] = useState('')
  const params = new URLSearchParams({ pageSize: '24' })
  if (search) params.set('search', search)
  if (workingGroup) params.set('workingGroup', workingGroup)
  if (tag) params.set('tag', tag)
  const query = useApi(`/member/people?${params.toString()}`, [
    search,
    workingGroup,
    tag,
  ])

  return (
    <Section label="People">
      <div className="peopleDirectoryIntro">
        <p className="meta">
          Real member profiles appear here only after the member chooses to be
          visible. Working groups, teams and organisations come from the Hub’s
          governed records and stay in sync automatically.
        </p>
      </div>
      <form
        className="peopleDirectoryTools"
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(draftSearch.trim())
        }}
      >
        <label className="searchInputWrap">
          <span className="srOnly">Search people, skills, or topics</span>
          <Search size={18} aria-hidden />
          <input
            className="input"
            type="search"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Search people, skills, or topics"
          />
        </label>
        <label className="field peopleGroupFilter">
          <span className="srOnly">Filter by working group</span>
          <select
            className="input"
            value={workingGroup}
            onChange={(event) => setWorkingGroup(event.target.value)}
          >
            <option value="">All working groups</option>
            {WORKING_GROUPS.map((group) => (
              <option key={group.slug} value={group.slug}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
        {(search || workingGroup || tag) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setDraftSearch('')
              setSearch('')
              setWorkingGroup('')
              setTag('')
            }}
          >
            Clear
          </button>
        )}
      </form>
      {tag && (
        <p className="filterContext" role="status">
          Filtering by tag: <strong>{tag}</strong>
        </p>
      )}
      <Async
        query={query}
        skeletons={3}
        empty={(data) =>
          data.items.length === 0 ? (
            <Empty
              icon={Users}
              title="No visible profiles match"
              body="Members can publish their profile from the Profile page."
            />
          ) : null
        }
      >
        {(data) => (
          <div className="peopleGrid">
            {data.items.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                onTagClick={(value) => setTag(value)}
              />
            ))}
          </div>
        )}
      </Async>
    </Section>
  )
}

export function Directory() {
  const query = useApi('/directory')
  return (
    <div>
      <PageHeader
        title="Directory"
        description="Find the right contact by starting at the top for constituency-wide questions, or lower down for a specific team."
      />
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? (
            <Empty icon={AtSign} title="Directory is empty" />
          ) : null
        }
      >
        {(data) => {
          const groups = new Map()
          for (const contact of data.items) {
            if (!groups.has(contact.group)) groups.set(contact.group, [])
            groups.get(contact.group).push(contact)
          }
          const layers = DIRECTORY_LAYERS.map((layer) => ({
            ...layer,
            contacts: layer.groups.flatMap((group) => groups.get(group) || []),
          })).filter((layer) => layer.contacts.length > 0)

          return (
            <>
              <p className="meta directoryNote">
                This shape shows how broad each contact’s scope is. It is not a
                ranking of people or importance.
              </p>
              <ol
                className="directoryPyramid"
                aria-label="YOUNGO contact structure"
              >
                {layers.map((layer) => (
                  <li
                    key={layer.id}
                    className={`directoryLayer directoryLayer-${layer.level}`}
                  >
                    <section aria-labelledby={`directory-${layer.id}`}>
                      <p className="pageEyebrow">{layer.eyebrow}</p>
                      <h2 id={`directory-${layer.id}`}>{layer.title}</h2>
                      <p className="meta directoryLayerDescription">
                        {layer.description}
                      </p>
                      <div className="directoryContacts">
                        {layer.contacts.map((contact) =>
                          layer.id === 'working-groups' && contact.wg ? (
                            <WorkingGroupContactCard
                              key={`${contact.group}-${contact.roleTitle}`}
                              contact={contact}
                            />
                          ) : (
                            <ContactCard
                              key={`${contact.group}-${contact.publicEmail || contact.roleTitle}`}
                              contact={contact}
                            />
                          ),
                        )}
                      </div>
                    </section>
                  </li>
                ))}
              </ol>
              <PeopleDirectory />
            </>
          )
        }}
      </Async>
    </div>
  )
}
