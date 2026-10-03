import { SidePanel } from '../components/SidePanel.tsx'
import { TbUsers as UsersIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, Empty, PageHeader } from '../components/ui'
import { ContactCard, PersonCard, WorkingGroupContactCard } from '../components/cards'
import { useDocument } from '../lib/documents'
import { useWorkingGroups } from '../lib/workingGroups'
import { TbAt as AtSign, TbSearch as Search, TbUsers as Users } from 'react-icons/tb'

function PeopleDirectory() {
  const wg = useWorkingGroups()
  const [selectedPerson, setSelectedPerson] = useState<any>(null)
  const [draftSearch, setDraftSearch] = useState('')
  const [search, setSearch] = useState('')
  const [workingGroup, setWorkingGroup] = useState('')
  const [tag, setTag] = useState('')
  const params = new URLSearchParams({ pageSize: '24' })
  if (search) params.set('search', search)
  if (workingGroup) params.set('workingGroup', workingGroup)
  if (tag) params.set('tag', tag)
  const query = useApi(`/member/people?${params.toString()}`, [search, workingGroup, tag])

  return (
    <section aria-label="Member profiles">
      <div className="peopleDirectoryIntro">
        <p className="meta">Only members who choose to share their profile appear here.</p>
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
            {wg.groups.map((group: any) => (
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
        empty={(data: any) =>
          data.items.length === 0 ? (
            <Empty
              icon={Users}
              title="No visible profiles match"
              body="Members can publish their profile from the Profile page."
            />
          ) : null
        }
      >
        {(data: any) => (
          <div className="peopleGrid">
            {data.items.map((person: any) => (
              <PersonCard
                key={person.id}
                person={person}
                onTagClick={(value: any) => setTag(value)}
                onOpen={() => setSelectedPerson(person)}
              />
            ))}
          </div>
        )}
      </Async>
      {selectedPerson && (
        <SidePanel title="Member profile" onClose={() => setSelectedPerson(null)}>
          <PersonCard person={selectedPerson} expanded />
        </SidePanel>
      )}
    </section>
  )
}

export function Directory() {
  const { doc: directory } = useDocument('directory')
  const DIRECTORY_LAYERS = directory?.DIRECTORY_LAYERS || []

  const query = useApi('/directory')
  return (
    <div>
      <PageHeader
        icon={UsersIcon}
        title="Directory"
        description="Find the right contact by starting at the top for constituency-wide questions, or lower down for a specific team."
      >
        <PageSectionNav section="people" />
      </PageHeader>
      <Async
        query={query}
        empty={(d: any) =>
          d.items.length === 0 ? <Empty icon={AtSign} title="Directory is empty" /> : null
        }
      >
        {(data: any) => {
          const groups = new Map()
          for (const contact of data.items) {
            if (!groups.has(contact.group)) groups.set(contact.group, [])
            groups.get(contact.group).push(contact)
          }
          const layers = DIRECTORY_LAYERS.map((layer: any) => ({
            ...layer,
            contacts: layer.groups.flatMap((group: any) => groups.get(group) || []),
          })).filter((layer: any) => layer.contacts.length > 0)

          return (
            <>
              <p className="meta directoryNote">
                This shape shows how broad each contact’s scope is. It is not a ranking of people or
                importance.
              </p>
              <ol className="directoryPyramid" aria-label="YOUNGO contact structure">
                {layers.map((layer: any) => (
                  <li key={layer.id} className={`directoryLayer directoryLayer-${layer.level}`}>
                    <section aria-labelledby={`directory-${layer.id}`}>
                      <p className="pageEyebrow">{layer.eyebrow}</p>
                      <h2 id={`directory-${layer.id}`}>{layer.title}</h2>
                      <p className="meta directoryLayerDescription">{layer.description}</p>
                      <div className="directoryContacts">
                        {layer.contacts.map((contact: any) =>
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
            </>
          )
        }}
      </Async>
    </div>
  )
}

export function Members() {
  return (
    <div>
      <PageHeader
        icon={UsersIcon}
        title="Members"
        description="Find people by their working groups, skills and interests."
      >
        <PageSectionNav section="people" />
      </PageHeader>
      <PeopleDirectory />
    </div>
  )
}
