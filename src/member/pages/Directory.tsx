import type { AnyValue, Doc } from '../lib/types'
import { SidePanel } from '../components/SidePanel.tsx'
import { TbUsers as UsersIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, CatalogToolbar, Empty, FilterMenu, FilterPill, PageHeader } from '../components/ui'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { ContactCard, PersonCard, WorkingGroupContactCard } from '../components/cards'
import { useDocument } from '../lib/documents'
import { useWorkingGroups } from '../lib/workingGroups'
import { TbAt as AtSign, TbUsers as Users } from 'react-icons/tb'

function PeopleDirectory() {
  const wg = useWorkingGroups()
  const [selectedPerson, setSelectedPerson] = useState<AnyValue>(null)
  const [search, setSearch] = useState('')
  const [workingGroup, setWorkingGroup] = useState('')
  const [tag, setTag] = useState('')
  // typing searches after a short pause, so there is no Search button
  const term = useDebouncedValue(search.trim())
  const params = new URLSearchParams({ pageSize: '24' })
  if (term) params.set('search', term)
  if (workingGroup) params.set('workingGroup', workingGroup)
  if (tag) params.set('tag', tag)
  const query = useApi(`/member/people?${params.toString()}`, [term, workingGroup, tag])

  return (
    <section aria-label="Member profiles">
      <div className="peopleDirectoryIntro">
        <p className="meta">Only members who choose to share their profile appear here.</p>
      </div>
      <CatalogToolbar
        search={{
          label: 'Search people, skills, or topics',
          value: search,
          onChange: setSearch,
        }}
        filters={
          <FilterMenu
            label="Filter by working group"
            activeCount={workingGroup || tag ? 1 : 0}
            onClear={() => {
              setWorkingGroup('')
              setTag('')
            }}
          >
            <fieldset className="filterLevel">
              <legend>Working group</legend>
              <div className="pillRow">
                <FilterPill active={!workingGroup} onClick={() => setWorkingGroup('')}>
                  All groups
                </FilterPill>
                {wg.groups.map((group: Doc) => (
                  <FilterPill
                    key={group.slug}
                    active={workingGroup === group.slug}
                    onClick={() => setWorkingGroup(group.slug)}
                  >
                    {group.name}
                  </FilterPill>
                ))}
              </div>
            </fieldset>
          </FilterMenu>
        }
      />
      {tag && (
        <p className="filterContext" role="status">
          Filtering by tag: <strong>{tag}</strong>
        </p>
      )}
      <Async
        query={query}
        skeletons={3}
        empty={(data: Doc) =>
          data.items.length === 0 ? (
            <Empty
              icon={Users}
              title="No visible profiles match"
              body="Members can publish their profile from the Profile page."
            />
          ) : null
        }
      >
        {(data: Doc) => (
          <div className="peopleGrid">
            {data.items.map((person: AnyValue) => (
              <PersonCard
                key={person.id}
                person={person}
                onTagClick={(value: AnyValue) => setTag(value)}
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
        empty={(d: AnyValue) =>
          d.items.length === 0 ? <Empty icon={AtSign} title="Directory is empty" /> : null
        }
      >
        {(data: Doc) => {
          const groups = new Map()
          for (const contact of data.items) {
            if (!groups.has(contact.group)) groups.set(contact.group, [])
            groups.get(contact.group).push(contact)
          }
          const layers = DIRECTORY_LAYERS.map((layer: AnyValue) => ({
            ...layer,
            contacts: layer.groups.flatMap((group: Doc) => groups.get(group) || []),
          })).filter((layer: AnyValue) => layer.contacts.length > 0)

          return (
            <>
              <p className="meta directoryNote">
                This shape shows how broad each contact’s scope is. It is not a ranking of people or
                importance.
              </p>
              <ol className="directoryPyramid" aria-label="YOUNGO contact structure">
                {layers.map((layer: AnyValue) => (
                  <li key={layer.id} className={`directoryLayer directoryLayer-${layer.level}`}>
                    <section aria-labelledby={`directory-${layer.id}`}>
                      <p className="pageEyebrow">{layer.eyebrow}</p>
                      <h2 id={`directory-${layer.id}`}>{layer.title}</h2>
                      <p className="meta directoryLayerDescription">{layer.description}</p>
                      <div className="directoryContacts">
                        {layer.contacts.map((contact: Doc) =>
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
