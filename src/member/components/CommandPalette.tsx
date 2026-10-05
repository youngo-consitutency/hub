interface PaletteBodyProps {
  onClose?: AnyValue
}

import type { AnyValue, Doc } from '../lib/types'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useApi } from '../lib/api'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { navigate } from '../lib/router'
import { fmtDual, fmtDateRange } from '../lib/time'
import {
  TbSearch as Search,
  TbCalendar as CalendarDays,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbMapPin as MapPin,
  TbUsers as Users,
  TbCornerDownLeft as CornerDownLeft,
  TbSpeakerphone as Megaphone,
} from 'react-icons/tb'

// Hub pages that are useful as palette shortcuts even when search returns nothing.
const PAGE_SHORTCUTS = [
  {
    to: '/work',
    title: 'Work & follow-up',
    line: 'Tasks, owners, deadlines and follow-up',
    keywords: 'tasks work follow-up owners deadlines',
    Icon: Gavel,
  },
  {
    to: '/directory/people',
    title: 'Members',
    line: 'Find people by working group, skills and interests',
    keywords: 'members community people directory skills',
    Icon: Users,
  },

  {
    to: '/opportunities',
    title: 'Opportunities',
    line: 'Events, workshops and open calls from organisations',
    keywords: 'ngo opportunity workshop hackathon open call training',
    Icon: Megaphone,
  },
  {
    to: '/calendar',
    title: 'Calendar',
    line: 'Meetings and constituency events',
    keywords: 'calendar meetings events schedule',
    Icon: CalendarDays,
  },
  {
    to: '/groups',
    title: 'Working groups',
    line: 'Find a group and its onboarding',
    keywords: 'working groups wg',
    Icon: Users,
  },
]

// Same content groups as the /search page, in palette result order.
const GROUPS = [
  {
    key: 'events',
    label: 'Events',
    icon: CalendarDays,
    to: (e: AnyValue) => `/calendar/${e.slug}`,
    title: (e: AnyValue) => e.title,
    line: (e: AnyValue) => fmtDual(e.startsAt),
  },
  {
    key: 'submissions',
    label: 'Submissions',
    icon: FileText,
    to: (s: AnyValue) => `/submissions/${s.slug}`,
    title: (s: AnyValue) => s.title,
    line: (s: AnyValue) => s.wg?.name || s.status,
  },
  {
    key: 'decisions',
    label: 'Council',
    icon: Gavel,
    to: (d: AnyValue) => `/council/${d.slug}`,
    title: (d: AnyValue) => d.title,
    line: (d: AnyValue) => d.proposer,
  },
  {
    key: 'coys',
    label: 'COYs',
    icon: MapPin,
    to: (c: AnyValue) => `/coys/${c.slug}`,
    title: (c: AnyValue) => c.title,
    line: (c: AnyValue) => fmtDateRange(c.startsOn, c.endsOn, c.datesTbc),
  },
  {
    key: 'groups',
    label: 'Working groups',
    icon: Users,
    to: (g: AnyValue) => `/groups/${g.slug}`,
    title: (g: AnyValue) => g.name,
    line: (g: AnyValue) => g.focusLine,
  },
  {
    key: 'contacts',
    label: 'Directory',
    icon: Users,
    to: () => '/directory',
    title: (c: AnyValue) => c.roleTitle,
    line: (c: AnyValue) => c.description,
  },
]

function PaletteBody({ onClose }: PaletteBodyProps) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  // Debounced so typing does not fire a /search request per keystroke —
  // each call scans six collections server-side.
  const debounced = useDebouncedValue(q.trim())
  const query = useApi(debounced ? `/search?q=${encodeURIComponent(debounced)}` : null, [debounced])
  const listRef = useRef<AnyValue>(null)

  // Flatten grouped results into a single navigable list, plus page shortcuts.
  const flat = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const pages = PAGE_SHORTCUTS.filter(
      (page) =>
        page.title.toLowerCase().includes(needle) ||
        page.keywords.includes(needle) ||
        page.keywords.split(' ').some((word) => word.startsWith(needle)),
    ).map((page) => ({
      to: page.to,
      title: page.title,
      line: page.line,
      Icon: page.Icon,
      group: 'Pages',
    }))
    const data = query.data
    if (!data) return pages
    const content = GROUPS.flatMap((g) =>
      (data[g.key] || []).map((item: Doc) => ({
        to: g.to(item),
        title: g.title(item),
        line: g.line(item),
        Icon: g.icon,
        group: g.label,
      })),
    )
    return [...pages, ...content]
  }, [query.data, q])

  useEffect(() => {
    setActive(0)
  }, [flat.length])

  const go = (to: AnyValue) => {
    onClose()
    navigate(to)
  }

  const onKeyDown = (e: AnyValue) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      go(flat[active].to)
    }
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
          role="combobox"
          aria-label="Search the Hub"
          aria-controls="command-palette-results"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={flat[active] ? `command-palette-result-${active}` : undefined}
          placeholder="Search meetings, opportunities, decisions, groups…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <kbd className="kbd">Esc</kbd>
      </div>
      <div
        className="paletteResults"
        id="command-palette-results"
        role="listbox"
        aria-label="Search results"
        aria-busy={query.loading}
        ref={listRef}
      >
        {q.trim() === '' && (
          <p className="metaMuted" style={{ padding: '16px 14px' }}>
            Type to search across the Hub.
          </p>
        )}
        {q.trim() !== '' && flat.length === 0 && !query.loading && (
          <p className="metaMuted" style={{ padding: '16px 14px' }}>
            No matches for “{q}”.
          </p>
        )}
        {flat.map((r, i) => (
          <button
            type="button"
            key={r.to + i}
            id={`command-palette-result-${i}`}
            role="option"
            aria-selected={i === active}
            className={`paletteItem ${i === active ? 'active' : ''}`}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(r.to)}
          >
            <r.Icon
              size={18}
              strokeWidth={1.75}
              aria-hidden
              style={{ color: 'var(--text-3)', flexShrink: 0 }}
            />
            <span className="paletteText">
              <span className="paletteTitle">{r.title}</span>
              <span className="metaMuted">
                {r.group} · {r.line}
              </span>
            </span>
            {i === active && (
              <CornerDownLeft
                size={14}
                strokeWidth={1.75}
                aria-hidden
                style={{ color: 'var(--text-3)' }}
              />
            )}
          </button>
        ))}
      </div>
    </>
  )
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<AnyValue>(null)
  const returnFocusRef = useRef<AnyValue>(null)

  useEffect(() => {
    const onKey = (e: AnyValue) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((current) => {
          if (!current) {
            returnFocusRef.current = document.activeElement
          }
          return !current
        })
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) return
    returnFocusRef.current?.focus?.()
    returnFocusRef.current = null
  }, [open])

  const keepFocusInside = (event: AnyValue) => {
    if (event.key !== 'Tab') return
    const focusable = [
      ...(dialogRef.current?.querySelectorAll(
        'input, button, a[href], [tabindex]:not([tabindex="-1"])',
      ) || []),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open) return null
  return (
    <div className="paletteBackdrop" onClick={() => setOpen(false)}>
      <div
        className="palette"
        role="dialog"
        aria-label="Search the Hub"
        aria-modal="true"
        ref={dialogRef}
        onKeyDown={keepFocusInside}
        onClick={(e) => e.stopPropagation()}
      >
        <PaletteBody onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}
