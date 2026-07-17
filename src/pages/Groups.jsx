import { useApi } from '../lib/api.js'
import { Async, Empty } from '../components/ui.jsx'
import { GroupCard } from '../components/cards.jsx'
import { Users } from 'lucide-react'

export function Groups() {
  const query = useApi('/groups')
  return (
    <div>
      <h1>Working groups</h1>
      <p className="meta" style={{ marginTop: 4 }}>Where the work happens. Join a channel to get involved.</p>
      <Async query={query} empty={(d) => d.items.length === 0 ? <Empty icon={Users} title="No working groups yet" /> : null}>
        {(data) => <div className="grid2" style={{ marginTop: 12 }}>{data.items.map((g) => <GroupCard key={g.slug} group={g} />)}</div>}
      </Async>
    </div>
  )
}
