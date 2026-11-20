import type { DirectoryContact } from '../../shared/contracts'
import type { DirectoryLayer } from '../../shared/contracts'
import type { PeopleResponse, PersonSummary } from '../../shared/contracts'
import { SidePanel } from '../components/SidePanel.tsx'
import { TbUsers as UsersIcon } from 'react-icons/tb'
import { PageSectionNav } from '../components/PageSectionNav'
import { useState } from 'react'
import { useApi } from '../lib/api'
import { Async, CatalogToolbar, Empty, FilterMenu, FilterPill, PageHeader } from '../components/ui'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { ContactCard, WorkingGroupContactCard } from '../components/cards'
import { PersonCard } from '../components/PersonCard'
import { useDocument } from '../lib/documents'
import { useWorkingGroups } from '../lib/workingGroups'
import { TbAt as AtSign, TbUsers as Users } from 'react-icons/tb'

function PeopleDirectory() {
  const wg = useWorkingGroups()
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null)
  const [search, setSearch] = useState('')
  const [workingGroup, setWorkingGroup] = useState('')
  const [tag, setTag] = useState('')
  // typing searches after a short pause, so there is no Search button
  const term = useDebouncedValue(search.trim())
  const params = new URLSearchParams({ pageSize: '24' })
  if (term) params.set('search', term)
  if (workingGroup) params.set('workingGroup', workingGroup)
  if (tag) params.set('tag', tag)
  const query = useApi<PeopleResponse>(`/member/people?${params.toString()}`, {
    keepPrevious: true,
  })

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
                {wg.groups.map((group) => (
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
        empty={(data) =>
          data.items.length === 0 ? (
            <Empty
              icon={Users}
              title="No visible profiles match"
              body="Be the first: share your interests from your Profile page so others can find you."
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
                onTagClick={setTag}
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
  const { doc: directory } = useDocument<{ DIRECTORY_LAYERS?: DirectoryLayer[] }>('directory')
  const DIRECTORY_LAYERS = directory?.DIRECTORY_LAYERS || []

  const query = useApi<{ items: DirectoryContact[] }>('/directory')
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
        empty={(d) =>
          d.items.length === 0 ? (
            <Empty
              icon={AtSign}
              title="No contacts listed yet"
              body="Contacts appear here as teams publish them."
            />
          ) : null
        }
      >
        {(data) => {
          const groups = new Map<string, DirectoryContact[]>()
          for (const contact of data.items) {
            if (!contact.group) continue
            groups.set(contact.group, [...(groups.get(contact.group) ?? []), contact])
          }
          const layers = DIRECTORY_LAYERS.map((layer) => ({
            ...layer,
            contacts: layer.groups.flatMap((group) => groups.get(group) || []),
          })).filter((layer) => layer.contacts.length > 0)

          return (
            <>
              <p className="meta directoryNote">
                This shape shows how broad each contact’s scope is. It is not a ranking of people or
                importance.
              </p>
              <ol className="directoryPyramid" aria-label="YOUNGO contact structure">
                {layers.map((layer) => (
                  <li key={layer.id} className={`directoryLayer directoryLayer-${layer.level}`}>
                    <section aria-labelledby={`directory-${layer.id}`}>
                      <p className="pageEyebrow">{layer.eyebrow}</p>
                      <h2 id={`directory-${layer.id}`}>{layer.title}</h2>
                      <p className="meta directoryLayerDescription">{layer.description}</p>
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
        description="Meet the community: find people by working group, skills and interests."
      >
        <PageSectionNav section="people" />
      </PageHeader>
      <PeopleDirectory />
    </div>
  )
}
