import { useState, type ReactNode } from 'react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import { TbLayoutGrid, TbList } from 'react-icons/tb'

type View = 'grid' | 'list'

/** Keeps the same records and actions across gallery cards and list layouts. */
export function CatalogueResults({ count, children }: { count?: number; children?: ReactNode }) {
  const [view, setView] = useState<View>('grid')
  return (
    <div className="catalogueResults" data-view={view}>
      <div className="catalogueResultBar">
        <p className="meta" role="status">
          {count} {count === 1 ? 'result' : 'results'}
        </p>
        <ToggleButtonGroup
          className="catalogueViewSwitch"
          aria-label="Results layout"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[view]}
          onSelectionChange={(keys) => setView([...keys][0] as View)}
        >
          <ToggleButton id="grid" className="btn btn-sm">
            <TbLayoutGrid size={15} aria-hidden /> Cards
          </ToggleButton>
          <ToggleButton id="list" className="btn btn-sm">
            <TbList size={15} aria-hidden /> List
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      {children}
    </div>
  )
}
