import { TbChevronRight as ChevronRight, TbUsers as Users } from 'react-icons/tb'
import { A, Async, Empty, Skeletons } from '../../components/ui.jsx'
import { useApi } from '../../lib/api.js'
import { useDocument } from '../../lib/documents.js'
import { workingGroupIcon } from '../../lib/workingGroupIcons.js'

export function SiteWorkingGroups() {
  const query = useApi('/groups')
  const { doc: site, loading } = useDocument('site')
  const { doc: directory } = useDocument('directory')
  const wg = site?.workingGroups
  const topics = directory?.topics || []
  if (!wg || !directory) return loading ? <Skeletons n={4} /> : null
  const empty = wg.empty || {}
  const cta = wg.cta || {}
  const footnote = wg.footnote || {}

  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">{wg.eyebrow}</p>
        <h1>{wg.title}</h1>
        <p className="sitePageLead">{wg.lead}</p>
      </header>

      <Async
        query={query}
        empty={(data) =>
          data.items.length === 0 ? (
            <Empty icon={Users} title={empty.title} body={empty.body} />
          ) : null
        }
      >
        {(data) => {
          return (
            <>
              {topics.map((topic) => {
                const groups = data.items.filter((g) => g.topic === topic.key)
                if (!groups.length) return null
                return (
                  <section
                    key={topic.key}
                    className="siteSection"
                    aria-labelledby={`topic-${topic.key}`}
                  >
                    <h2 id={`topic-${topic.key}`}>{topic.label}</h2>
                    <div className="cardGrid">
                      {groups.map((group) => {
                        const GroupIcon = workingGroupIcon(group.slug)
                        return (
                          <article key={group.slug} className="card siteWgCard">
                            <span className="siteWgMonogram" aria-hidden>
                              <GroupIcon size={22} strokeWidth={1.75} />
                            </span>
                            <div>
                              <h3>{group.name}</h3>
                              {group.focusLine && <p className="meta">{group.focusLine}</p>}
                              {group.tags?.length > 0 && (
                                <ul className="siteWgTags" aria-label={`${group.name} topics`}>
                                  {group.tags.slice(0, 3).map((tag) => (
                                    <li key={tag} className="chip chip-neutral">
                                      {tag}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </section>
                )
              })}

              <section className="siteCtaBand card">
                <Users size={24} strokeWidth={1.75} aria-hidden />
                <div>
                  <h2>{cta.title}</h2>
                  <p className="meta">{cta.body}</p>
                </div>
                <A className="btn btn-primary" href="/join">
                  {cta.label}
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </A>
              </section>

              <p className="metaMuted sitePageFootnote">
                {footnote.before}{' '}
                <A href="/groups" className="inlineLink">
                  {footnote.linkLabel}
                </A>
                .
              </p>
            </>
          )
        }}
      </Async>
    </div>
  )
}
