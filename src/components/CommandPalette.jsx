import { useState, useEffect, useMemo, useRef } from 'react'
import { useApi } from '../lib/api.js'
import { navigate } from '../lib/router.js'
import { fmtDual, fmtDateRange } from '../lib/time.js'
import { Search, CalendarDays, FileText, Gavel, MapPin, Users, CornerDownLeft } from 'lucide-react'

// Same content groups as the /search page, in palette result order.
const GROUPS = [
  { key: 'events', label: 'Events', icon: CalendarDays, to: (e) => `/calendar/${e.slug}`, title: (e) => e.title, line: (e) => fmtDual(e.startsAt) },
  { key: 'submissions', label: 'Submissions', icon: FileText, to: (s) => `/submissions/${s.slug}`, title: (s) => s.title, line: (s) => s.wg?.name || s.status },
  { key: 'decisions', label: 'Council', icon: Gavel, to: (d) => `/council/${d.slug}`, title: (d) => d.title, line: (d) => d.proposer },
  { key: 'coys', label: 'COYs', icon: MapPin, to: (c) => `/coys/${c.slug}`, title: (c) => c.title, line: (c) => fmtDateRange(c.startsOn, c.endsOn, c.datesTbc) },
  { key: 'groups', label: 'Working groups', icon: Users, to: (g) => `/groups/${g.slug}`, title: (g) => g.name, line: (g) => g.focusLine },
  { key: 'contacts', label: 'Directory', icon: Users, to: () => '/directory', title: (c) => c.roleTitle, line: (c) => c.description },
]

function PaletteBody({ onClose }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const query = useApi(`/search?q=${encodeURIComponent(q)}`, [q])
  const listRef = useRef(null)

  // Flatten grouped results into a single navigable list.
  const flat = useMemo(() => {
    const data = query.data
    if (!data || q.trim() === '') return []
    return GROUPS.flatMap((g) => (data[g.key] || []).map((item) => ({
      to: g.to(item), title: g.title(item), line: g.line(item), Icon: g.icon, group: g.label,
    })))
  }, [query.data, q])

  useEffect(() => { setActive(0) }, [flat.length])

  const go = (to) => { onClose(); navigate(to) }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); go(flat[active].to) }
  }

  useEffect(() => {
    listRef.current?.querySelector('.paletteItem.active')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <>
      <div className="paletteInputRow">
        <Search size={18} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-3)' }} />
        <input
          className="paletteInput"
          autoFocus
          placeholder="Search meetings, submissions, decisions, COYs, groups…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <div className="paletteResults" ref={listRef}>
        {q.trim() === '' && <p className="metaMuted" style={{ padding: '16px 14px' }}>Type to search across the Hub.</p>}
        {q.trim() !== '' && flat.length === 0 && !query.loading && (
          <p className="metaMuted" style={{ padding: '16px 14px' }}>No matches for “{q}”.</p>
        )}
        {flat.map((r, i) => (
          <button
            key={r.to + i}
            className={`paletteItem ${i === active ? 'active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(r.to)}
          >
            <r.Icon size={18} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <span className="paletteText">
              <span className="paletteTitle">{r.title}</span>
              <span className="metaMuted">{r.group} · {r.line}</span>
            </span>
            {i === active && <CornerDownLeft size={14} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-3)' }} />}
          </button>
        ))}
      </div>
    </>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null
  return (
    <div className="paletteBackdrop" onClick={() => setOpen(false)}>
      <div className="palette" role="dialog" aria-label="Command palette" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <PaletteBody onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}
