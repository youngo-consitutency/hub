import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { Async, Empty, PageHeader } from '../components/ui.jsx'
import { CoyCard } from '../components/cards.jsx'
import { MapPin } from 'lucide-react'

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'lcoy', label: 'LCOY' },
  { key: 'rcoy', label: 'RCOY' },
  { key: 'coy', label: 'COY' },
]
const REGIONS = [
  { key: 'all', label: 'All regions' },
  { key: 'africa', label: 'Africa' },
  { key: 'apac', label: 'Asia-Pacific' },
  { key: 'eca', label: 'ECA' },
  { key: 'lac', label: 'LAC' },
  { key: 'mena', label: 'MENA' },
  { key: 'noram', label: 'North America' },
  { key: 'weog', label: 'WEOG' },
]

export function Coys() {
  const [type, setType] = useState('all')
  const [region, setRegion] = useState('all')
  const query = useApi(`/coys?type=${type}&region=${region}`, [type, region])

  return (
    <div>
      <PageHeader
        eyebrow="Conferences of Youth"
        title="COY tracker"
        description="LCOYs, RCOYs, and the global Conference of Youth."
      >
        <div className="pillRow">
          {TYPES.map((t) => <button key={t.key} className={`pill ${type === t.key ? 'active' : ''}`} onClick={() => setType(t.key)}>{t.label}</button>)}
        </div>
        <div className="pillRow">
          {REGIONS.map((r) => <button key={r.key} className={`pill ${region === r.key ? 'active' : ''}`} onClick={() => setRegion(r.key)}>{r.label}</button>)}
        </div>
      </PageHeader>
      <Async query={query} empty={(d) => d.items.length === 0 ? <Empty icon={MapPin} title="No COYs for this filter" body="Try another region or type." /> : null}>
        {(data) => <div className="grid2">{data.items.map((c) => <CoyCard key={c.slug} coy={c} />)}</div>}
      </Async>
    </div>
  )
}
