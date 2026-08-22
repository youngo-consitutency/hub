import { useApi } from '../lib/api.js'
import { Async, Empty, PageHeader } from '../components/ui.jsx'
import { ContactCard, WorkingGroupContactCard } from '../components/cards.jsx'
import { DIRECTORY_LAYERS } from '../content/directory.js'
import { AtSign } from 'lucide-react'

export function Directory() {
  const query = useApi('/directory')
  return (
    <div>
      <PageHeader
        eyebrow="Contacts"
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
            </>
          )
        }}
      </Async>
    </div>
  )
}
