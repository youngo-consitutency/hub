interface CatalogueResultsProps {
  count?: number
  children?: import('react').ReactNode
}

import { useState } from 'react'
import { TbLayoutGrid, TbList, TbTable } from 'react-icons/tb'

/** Keeps the same records and actions across gallery cards, list, and compact layouts. */
export function CatalogueResults({ count, children }: CatalogueResultsProps) {
  const [view, setView] = useState<'grid' | 'list' | 'compact'>('grid')
  return (
    <div className="catalogueResults" data-view={view}>
      <div className="catalogueResultBar">
        <p className="meta" role="status">
          {count} {count === 1 ? 'result' : 'results'}
        </p>
        <div className="viewSwitch" role="group" aria-label="Results layout">
          <button
            type="button"
            className={`btn btn-sm ${view === 'grid' ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            title="Card gallery layout"
          >
            <TbLayoutGrid size={15} aria-hidden /> Cards
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'list' ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            title="Expanded list layout"
          >
            <TbList size={15} aria-hidden /> List
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'compact' ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={view === 'compact'}
            onClick={() => setView('compact')}
            title="Compact table row layout"
          >
            <TbTable size={15} aria-hidden /> Compact
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
