interface PaletteBodyProps {
  onClose?: () => void
}

interface CommandPaletteProps {
  onClose?: () => void
}

import { useState, useMemo } from 'react'
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Modal,
  ModalOverlay,
  SearchField,
} from 'react-aria-components'
import { useApi } from '../lib/api'
import { useDebouncedValue } from '../lib/useDebouncedValue'
import { navigate } from '../lib/router'
import { useAccount } from '../lib/accountContext'
import { paletteRoutesFor, viewerOf } from '../lib/routes'
import { DIRECT_SECTIONS } from '../lib/searchSections'
import type { SearchResponse } from '../../shared/contracts'
import { TbSearch as Search, TbCornerDownLeft as CornerDownLeft } from 'react-icons/tb'

function PaletteBody({ onClose }: PaletteBodyProps) {
  const [q, setQ] = useState('')
  // Debounced so typing does not fire a /search request per keystroke —
  // each call scans six collections server-side.
  const debounced = useDebouncedValue(q.trim())
  const query = useApi<SearchResponse>(
    debounced ? `/search?q=${encodeURIComponent(debounced)}` : null,
    {
      keepPrevious: true,
    },
  )
  // Remote results are valid only once the debounce and current fetch have settled.
  const settled = !query.loading && debounced === q.trim()
  const { account } = useAccount()
  const viewer = useMemo(() => viewerOf(account), [account])

  // Flatten grouped results into a single navigable list, plus page shortcuts.
  const flat = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    // page shortcuts come from the route registry, limited to what this account can open
    const pages = paletteRoutesFor(viewer)
      .filter(
        (route) =>
          route.label.toLowerCase().includes(needle) ||
          route.palette!.keywords.includes(needle) ||
          route.palette!.keywords.split(' ').some((word) => word.startsWith(needle)),
      )
      .map((route) => ({
        to: route.href,
        title: route.label,
        line: route.palette!.line,
        Icon: route.icon,
        group: 'Pages',
      }))
    const data = settled ? query.data : null
    if (!data) return pages
    const content = DIRECT_SECTIONS.flatMap((section) =>
      section.matches(data).map(({ href, title, line, Icon, group }) => ({
        to: href,
        title: title ?? '',
        line,
        Icon,
        group,
      })),
    )
    return [...pages, ...content]
  }, [query.data, settled, q, viewer])

  const go = (to: string) => {
    onClose?.()
    navigate(to)
  }

  // sections keep the registry order: pages first, then each content group
  const sections = useMemo(() => {
    const out: { name: string; items: (typeof flat)[number][] }[] = []
    for (const item of flat) {
      const last = out.at(-1)
      if (last && last.name === item.group) last.items.push(item)
      else out.push({ name: item.group, items: [item] })
    }
    return out
  }, [flat])
  const trimmed = q.trim()

  return (
    <Autocomplete inputValue={q} onInputChange={setQ} filter={() => true}>
      <SearchField className="paletteInputRow" aria-label="Search the Hub" autoFocus>
        <Search size={18} strokeWidth={1.75} aria-hidden style={{ color: 'var(--text-3)' }} />
        <Input
          className="paletteInput"
          placeholder="Search meetings, opportunities, decisions, groups…"
        />
        <kbd className="kbd" aria-hidden>
          Esc
        </kbd>
      </SearchField>
      {/* one polite announcement when results settle, not one per keystroke */}
      <p className="srOnly" role="status">
        {trimmed && settled ? `${flat.length} ${flat.length === 1 ? 'result' : 'results'}` : ''}
      </p>
      <ListBox
        className="paletteResults"
        aria-label="Search results"
        aria-busy={query.loading}
        selectionMode="none"
        onAction={(key) => go(String(key))}
        renderEmptyState={() => (
          <p className="metaMuted" style={{ padding: '16px 14px' }}>
            {trimmed === ''
              ? 'Type to search across the Hub.'
              : settled
                ? `No matches for “${q}”.`
                : 'Searching…'}
          </p>
        )}
      >
        {sections.map((section) => (
          <ListBoxSection key={section.name}>
            <Header className="paletteGroup">{section.name}</Header>
            {section.items.map((r) => (
              <ListBoxItem
                key={r.to}
                id={r.to}
                textValue={`${r.title}, ${r.group}`}
                className="paletteItem"
              >
                <r.Icon
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: 'var(--text-3)', flexShrink: 0 }}
                />
                <span className="paletteText">
                  <span className="paletteTitle">{r.title}</span>
                  <span className="metaMuted">{r.line}</span>
                </span>
                <CornerDownLeft
                  className="paletteEnter"
                  size={14}
                  strokeWidth={1.75}
                  aria-hidden
                  style={{ color: 'var(--text-3)' }}
                />
              </ListBoxItem>
            ))}
          </ListBoxSection>
        ))}
      </ListBox>
    </Autocomplete>
  )
}

// Shell mounts this only while open and owns the Cmd/Ctrl+K toggle. React Aria supplies focus trap and dismissal.
export function CommandPalette({ onClose }: CommandPaletteProps) {
  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={(open) => !open && onClose?.()}
      className="paletteBackdrop"
    >
      <Modal className="palette">
        <Dialog aria-label="Search the Hub" className="paletteDialog">
          <PaletteBody onClose={onClose} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
