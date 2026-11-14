import type { ElementType, ReactNode } from 'react'
import { Tab, TabList, TabPanel, Tabs as AriaTabs, type TabsProps } from 'react-aria-components'

export interface TabItem {
  id: string
  label: ReactNode
  icon?: ElementType
  content: ReactNode
}

interface Props extends Omit<TabsProps, 'children'> {
  items: TabItem[]
  /** names the tab list for screen readers */
  label: string
}

/** Segmented tabs. react-aria supplies the roving focus, arrow keys and tab/panel wiring. */
export function Tabs({ items, label, ...props }: Props) {
  return (
    <AriaTabs {...props}>
      <TabList
        aria-label={label}
        className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-control bg-raised p-1"
      >
        {items.map(({ id, label: text, icon: Icon }) => (
          <Tab
            key={id}
            id={id}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-3 text-sm font-semibold text-ink-2 outline-none transition-colors data-[hovered]:text-ink data-[selected]:bg-card data-[selected]:text-ink data-[selected]:shadow-sm data-[focus-visible]:ring-2 data-[focus-visible]:ring-accent"
          >
            {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
            {text}
          </Tab>
        ))}
      </TabList>
      {items.map(({ id, content }) => (
        <TabPanel key={id} id={id} className="mt-4 outline-none">
          {content}
        </TabPanel>
      ))}
    </AriaTabs>
  )
}
