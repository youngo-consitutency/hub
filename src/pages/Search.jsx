import { useState } from 'react'
import { useApi } from '../lib/api.js'
import { A, Async, Empty, PageHeader } from '../components/ui.jsx'
import { fmtDual, fmtDateRange } from '../lib/time.js'
import { Search as SearchIcon, CalendarDays, FileText, Gavel, MapPin, Users } from 'lucide-react'

const GROUPS = [
  { key: 'events', label: 'Events', icon: CalendarDays, to: (e) => `/calendar/${e.slug}`, line: (e) => fmtDual(e.startsAt) },
  { key: 'submissions', label: 'Submissions', icon: FileText, to: (s) => `/submissions/${s.slug}`, line: (s) => s.wg?.name || s.status },
  { key: 'decisions', label: 'Council', icon: Gavel, to: (d) => `/council/${d.slug}`, line: (d) => d.proposer },
  { key: 'coys', label: 'COYs', icon: MapPin, to: (c) => `/coys/${c.slug}`, line: (c) => fmtDateRange(c.startsOn, c.endsOn, c.datesTbc) },
  { key: 'groups', label: 'Working groups', icon: Users, to: (g) => `/groups/${g.slug}`, line: (g) => g.focusLine },
  { key: 'contacts', label: 'Directory', icon: Users, to: () => '/directory', line: (c) => c.description },
]

export function Search() {
  const [q, setQ] = useState('')
  const query = useApi(`/search?q=${encodeURIComponent(q)}`, [q])
  const total = query.data ? GROUPS.reduce((n, g) => n + (query.data[g.key]?.length || 0), 0) : 0

  return (
    <div>
      <PageHeader
        eyebrow="Across the hub"
        title="Search"
        description="Find meetings, submissions, decisions, COYs, groups, and contacts."
      />
      <div className="searchInputWrap">
        <SearchIcon size={18} strokeWidth={1.75} aria-hidden />
        <input className="input" autoFocus placeholder="Search the hub" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim() === ''
        ? <div className="searchEmpty"><Empty icon={SearchIcon} title="Search the Hub" body="Start typing to search all member resources." /></div>
        : (
          <Async query={query} empty={() => total === 0 ? <Empty icon={SearchIcon} title="No matches" body={`Nothing found for “${q}”.`} /> : null}>
            {(data) => (
              <div className="stack searchResults">
                {GROUPS.filter((g) => data[g.key]?.length).map((g) => (
                  <section key={g.key}>
                    <div className="sectionLabel"><span>{g.label}</span></div>
                    <div className="stackSm">
                      {data[g.key].map((item, i) => (
                        <A key={i} href={g.to(item)} className="card cardTight rowGap">
                          <g.icon size={18} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-2)' }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 14 }}>{item.title || item.name || item.roleTitle}</p>
                            <p className="metaMuted">{g.line(item)}</p>
                          </div>
                        </A>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </Async>
        )}
    </div>
  )
}
