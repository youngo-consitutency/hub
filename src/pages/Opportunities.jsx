import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { fmtDual } from '../lib/time.js'
import {
  Async,
  CountdownChip,
  Empty,
  FilterPill,
  PageHeader,
} from '../components/ui.jsx'
import {
  CalendarDays,
  Code2,
  ExternalLink,
  GraduationCap,
  Layers3,
  Megaphone,
  MapPin,
  Presentation,
  Sparkles,
  Video,
} from 'lucide-react'

const KINDS = [
  { key: 'all', label: 'All', icon: Layers3 },
  { key: 'event', label: 'Events', icon: CalendarDays },
  { key: 'workshop', label: 'Workshops', icon: Presentation },
  { key: 'hackathon', label: 'Hackathons', icon: Code2 },
  { key: 'opportunity', label: 'Opportunities', icon: Sparkles },
  { key: 'call', label: 'Open calls', icon: Megaphone },
  { key: 'training', label: 'Training', icon: GraduationCap },
]

const FORMATS = [
  { key: 'all', label: 'Any format' },
  { key: 'online', label: 'Online', icon: Video },
  { key: 'in_person', label: 'In person', icon: MapPin },
  { key: 'hybrid', label: 'Hybrid' },
]

const KIND_LABEL = Object.fromEntries(
  KINDS.filter((k) => k.key !== 'all').map((k) => [
    k.key,
    k.label.replace(/s$/, ''),
  ]),
)

const FORMAT_LABEL = {
  online: 'Online',
  in_person: 'In person',
  hybrid: 'Hybrid',
}

function OpportunityCard({ item }) {
  const where =
    item.format === 'online'
      ? 'Online'
      : item.location || FORMAT_LABEL[item.format]
  return (
    <article className="card entityCard">
      <div className="rowGap" style={{ flexWrap: 'wrap' }}>
        <span className="chip chip-accent">
          {KIND_LABEL[item.kind] || item.kind}
        </span>
        <span className="chip chip-neutral">
          {FORMAT_LABEL[item.format] || item.format}
        </span>
        {item.region && (
          <span className="chip chip-neutral">{item.region}</span>
        )}
        {item.deadlineAt && (
          <CountdownChip iso={item.deadlineAt} label="Applications close" />
        )}
      </div>
      <h3 style={{ marginTop: 8 }}>{item.title}</h3>
      <p className="meta">{item.organizationName}</p>
      {item.summary && (
        <p className="meta" style={{ marginTop: 6 }}>
          {item.summary}
        </p>
      )}
      <div className="entityCardBody" style={{ marginTop: 8 }}>
        {item.startsAt && (
          <p className="entityCardMetaRow">
            <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
            <span>{fmtDual(item.startsAt)}</span>
          </p>
        )}
        <p className="entityCardMetaRow">
          <MapPin size={16} strokeWidth={1.75} aria-hidden />
          <span>{where}</span>
        </p>
      </div>
      {item.body && <p className="metaMuted">{item.body}</p>}
      {item.linkUrl && (
        <a
          className="btn btn-secondary btn-sm"
          href={item.linkUrl}
          target="_blank"
          rel="noreferrer noopener"
          style={{ marginTop: 10, alignSelf: 'flex-start' }}
        >
          <ExternalLink size={16} strokeWidth={1.75} aria-hidden />
          Details and sign-up
        </a>
      )}
    </article>
  )
}

export function Opportunities() {
  const [kind, setKind] = useState('all')
  const [format, setFormat] = useState('all')
  const query = useApi(`/member/opportunities?kind=${kind}&format=${format}`, [
    kind,
    format,
  ])

  return (
    <div>
      <PageHeader
        eyebrow="Open calls & postings"
        title="Opportunities"
        description="Shared open calls, fellowships, speaker slots, and events from constituency channels — plus postings from organisations in the Hub."
      >
        <div className="filterHierarchy" aria-label="Opportunity filters">
          <fieldset className="filterLevel">
            <legend>Type</legend>
            <div className="pillRow">
              {KINDS.map((item) => (
                <FilterPill
                  key={item.key}
                  active={kind === item.key}
                  icon={item.icon}
                  onClick={() => setKind(item.key)}
                >
                  {item.label}
                </FilterPill>
              ))}
            </div>
          </fieldset>
          <fieldset className="filterLevel">
            <legend>Format</legend>
            <div className="pillRow">
              {FORMATS.map((item) => (
                <FilterPill
                  key={item.key}
                  active={format === item.key}
                  icon={item.icon}
                  onClick={() => setFormat(item.key)}
                >
                  {item.label}
                </FilterPill>
              ))}
            </div>
          </fieldset>
        </div>
      </PageHeader>
      <Async
        query={query}
        empty={(data) =>
          data.items.length === 0 ? (
            <Empty
              icon={Megaphone}
              title="Nothing posted for this filter"
              body="Channel digests and organisation postings appear here. Try another type or format."
            />
          ) : null
        }
      >
        {(data) => (
          <>
            <p className="resultsSummary" role="status">
              {data.items.length} posting{data.items.length === 1 ? '' : 's'}
            </p>
            <div className="cardGrid">
              {data.items.map((item) => (
                <OpportunityCard key={item.id} item={item} />
              ))}
            </div>
          </>
        )}
      </Async>
    </div>
  )
}
