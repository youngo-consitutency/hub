interface CatalogueResultsProps {
  count?: number
  children?: import('react').ReactNode
}

import { useState } from 'react'
import { TbLayoutGrid, TbList } from 'react-icons/tb'

/** Keeps the same records and actions in both catalogue layouts. */
export function CatalogueResults({ count, children }: CatalogueResultsProps) {
  const [view, setView] = useState('grid')
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
          >
            <TbLayoutGrid size={16} aria-hidden /> Cards
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'list' ? 'btn-secondary' : 'btn-ghost'}`}
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
          >
            <TbList size={16} aria-hidden /> List
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
