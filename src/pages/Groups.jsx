import { useApi } from '../lib/api.js'
import { Async, Empty, PageHeader } from '../components/ui.jsx'
import { GroupCard } from '../components/cards.jsx'
import { Users } from 'lucide-react'

export function Groups() {
  const query = useApi('/groups')
  return (
    <div>
      <PageHeader
        eyebrow="Community"
        title="Working groups"
        description="Browse the groups, understand their focus, and open a workspace to join."
      />
      <Async
        query={query}
        empty={(d) =>
          d.items.length === 0 ? (
            <Empty icon={Users} title="No working groups yet" />
          ) : null
        }
      >
        {(data) => (
          <div className="grid2">
            {data.items.map((g) => (
              <GroupCard key={g.slug} group={g} />
            ))}
          </div>
        )}
      </Async>
    </div>
  )
}
