import { useApi } from '../lib/api.js'
import { Async, Empty } from '../components/ui.jsx'
import { ContactCard, CONTACT_GROUP } from '../components/cards.jsx'
import { AtSign } from 'lucide-react'

export function Directory() {
  const query = useApi('/directory')
  return (
    <div>
      <h1>Directory</h1>
      <p className="meta" style={{ marginTop: 4 }}>Who to contact. Sign in to see personal details.</p>
      <Async query={query} empty={(d) => d.items.length === 0 ? <Empty icon={AtSign} title="Directory is empty" /> : null}>
        {(data) => {
          const groups = {}
          for (const c of data.items) (groups[c.group] ||= []).push(c)
          return (
            <div className="stack" style={{ marginTop: 12 }}>
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
