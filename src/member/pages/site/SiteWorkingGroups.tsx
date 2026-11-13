import { createElement, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components'
import type { AnyValue, Doc } from '../../lib/types'
import { TbUsers as Users } from 'react-icons/tb'
import { A, Async, Empty, Skeletons } from '../../components/ui'
import { useApi } from '../../lib/api'
import { useDocument } from '../../lib/documents'
import { useCatalogue } from '../../lib/useCatalogue'
import { workingGroupIcon } from '../../lib/workingGroupIcons'
import { PublicSearch } from './PublicSearch'
import { SiteSection } from './SitePage'

const FILTERS = { topic: (group: Doc, value: string) => group.topic === value }
const text = (group: Doc) => [group.name, group.focusLine, ...(group.tags ?? [])]

function GroupCard({ group }: { group: Doc }) {
  return (
    <article className="card siteWgCard">
      <span className="siteWgMonogram" aria-hidden>
        {createElement(workingGroupIcon(group.slug), { size: 22, strokeWidth: 1.75 })}
      </span>
      <div>
        <h3>{group.name}</h3>
        {group.focusLine && <p className="meta">{group.focusLine}</p>}
        {group.tags?.length > 0 && (
          <ul className="siteWgTags" aria-label={`${group.name} topics`}>
            {group.tags.slice(0, 3).map((tag: AnyValue) => (
              <li key={tag} className="chip chip-neutral">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}

// every working group, browsed by topic or search instead of one long page
function GroupBrowser({ groups, topics }: { groups: Doc[]; topics: Doc[] }) {
  const list = useCatalogue(groups, { text, filters: FILTERS, pageSize: 9 })
  const present = topics.filter((topic) => groups.some((group) => group.topic === topic.key))
  const topic = list.values.topic || ''
  return (
    <>
      {present.length > 0 && (
        <ToggleButtonGroup
          className="siteTopicTiles"
          aria-label="Topic"
          selectionMode="single"
          selectedKeys={topic ? [topic] : []}
          onSelectionChange={(keys) => list.setFilter('topic', String([...keys][0] ?? ''))}
        >
          {present.map(({ key, label }) => {
            const inTopic = groups.filter((group) => group.topic === key)
            return (
              <ToggleButton key={key} id={key} className="siteTopicTile">
                {createElement(workingGroupIcon(inTopic[0].slug), { size: 22, strokeWidth: 1.5 })}
                <span className="siteTopicName">{label}</span>
                <span className="siteTopicCount">{inTopic.length}</span>
              </ToggleButton>
            )
          })}
        </ToggleButtonGroup>
      )}
      <div className="siteBrowseBar">
        <PublicSearch label="Search working groups" value={list.search} onChange={list.setSearch} />
      </div>
      <p className="metaMuted" role="status">
        {list.matches.length === groups.length
          ? `${groups.length} working groups`
          : `${list.matches.length} of ${groups.length} working groups`}
      </p>
      {list.matches.length === 0 ? (
        <Empty
          icon={Users}
          title="No working groups match"
          body="Try a different search or topic."
          cta={
            <button type="button" className="btn btn-secondary btn-sm" onClick={list.reset}>
              Clear filters
            </button>
          }
        />
      ) : (
        <>
          <ul className="siteWgGrid">
            <AnimatePresence mode="popLayout">
              {list.visible.map((group) => (
                <motion.li
                  key={group.slug}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.2 }}
                >
                  <GroupCard group={group} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {list.remaining > 0 && (
            <button type="button" className="btn btn-secondary siteCoyMore" onClick={list.showMore}>
              Show {Math.min(list.pageSize, list.remaining)} more
            </button>
          )}
        </>
      )}
    </>
  )
}

export function WorkingGroupsSection() {
  const query = useApi('/groups')
  const { doc: site, loading } = useDocument('site')
  const { doc: directory } = useDocument('directory')
  const wg = site?.workingGroups
  const ready = Boolean(wg && directory)
  // the section only exists once its documents load, so a deep link scrolls here afterwards
  useEffect(() => {
    if (ready && window.location.hash === '#working-groups') {
      document.getElementById('working-groups')?.scrollIntoView({ block: 'start' })
    }
  }, [ready])
  if (!wg || !directory) return loading ? <Skeletons n={4} /> : null
  const empty = wg.empty || {}
  const footnote = wg.footnote || {}
  return (
    <SiteSection id="working-groups" eyebrow={wg.eyebrow} title={wg.title} lead={wg.lead}>
      <Async
        query={query}
        empty={(data: Doc) =>
          data.items.length === 0 ? (
            <Empty icon={Users} title={empty.title} body={empty.body} />
          ) : null
        }
      >
        {(data: Doc) => (
          <>
            <GroupBrowser groups={data.items} topics={directory.topics || []} />
            <p className="metaMuted sitePageFootnote">
              {footnote.before}{' '}
              <A href="/groups" className="inlineLink">
                {footnote.linkLabel}
              </A>
              .
            </p>
          </>
        )}
      </Async>
    </SiteSection>
  )
}
