import { useApi } from '../lib/api.js'
import { Async, Empty, PageHeader } from '../components/ui.jsx'
import { ContactCard } from '../components/cards.jsx'
import { AtSign } from 'lucide-react'

const CONTACT_GROUP = {
  focal_points: 'Global focal points',
  wg_contacts: 'Working group contacts',
  liaisons: 'Thematic liaisons',
  operations: 'Operations',
}

export function Directory() {
  const query = useApi('/directory')
  return (
    <div>
      <PageHeader
        eyebrow="Contacts"
        title="Directory"
        description="Public role addresses and member-only contact details."
      />
      <Async query={query} empty={(d) => d.items.length === 0 ? <Empty icon={AtSign} title="Directory is empty" /> : null}>
        {(data) => {
          const groups = {}
          for (const c of data.items) (groups[c.group] ||= []).push(c)
          return (
            <div className="stack">
              {Object.entries(groups).map(([key, items]) => (
                <section key={key}>
                  <div className="sectionLabel"><span>{CONTACT_GROUP[key] || key}</span></div>
                  <div className="grid2">{items.map((c, i) => <ContactCard key={i} contact={c} />)}</div>
                </section>
              ))}
            </div>
          )
        }}
      </Async>
    </div>
  )
}
