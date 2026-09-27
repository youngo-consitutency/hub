import {
  TbChevronRight as ChevronRight,
  TbUsers as Users,
} from 'react-icons/tb'
import { A, Async, Empty } from '../../components/ui.jsx'
import { useApi } from '../../lib/api.js'
import { workingGroupIcon } from '../../lib/workingGroupIcons.js'
import { WORKING_GROUP_TOPICS } from '../../../shared/workingGroups.js'

export function SiteWorkingGroups() {
  const query = useApi('/groups')

  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">The policy work of the constituency</p>
        <h1>Working groups</h1>
        <p className="sitePageLead">
          YOUNGO’s working groups focus on different aspects of the UNFCCC
          negotiations and beyond. Active Constituency Work members can join
          through an expression of interest. Proposals for new working groups
          follow YOUNGO’s governance and decision-making process.
        </p>
      </header>

      <Async
        query={query}
        empty={(data) =>
          data.items.length === 0 ? (
            <Empty
              icon={Users}
              title="Working groups are listed on request"
              body="The public list is maintained by the constituency. Members see the full directory in the Hub."
            />
          ) : null
        }
      >
        {(data) => {
          const bySlug = new Map(data.items.map((g) => [g.slug, g]))
          const groupsFor = (slugs) =>
            slugs.map((slug) => bySlug.get(slug)).filter(Boolean)

          return (
            <>
              {WORKING_GROUP_TOPICS.map((topic) => {
                const groups = groupsFor(topic.groups)
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
                              {group.focusLine && (
                                <p className="meta">{group.focusLine}</p>
                              )}
                              {group.tags?.length > 0 && (
                                <ul
                                  className="siteWgTags"
                                  aria-label={`${group.name} topics`}
                                >
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
                  <h2>Join a working group</h2>
                  <p className="meta">
                    Working-group channels, calls, and contact points open once
                    you are a member. Register in the Hub, pick your groups, and
                    finish each group’s short introduction to get started.
                  </p>
                </div>
                <A className="btn btn-primary" href="/join">
                  Join YOUNGO Hub
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </A>
              </section>

              <p className="metaMuted sitePageFootnote">
                Working groups may be added or reorganised by the constituency;
                this list follows the live Hub directory. Members find contact
                points, calls, and member channels{' '}
                <A href="/groups" className="inlineLink">
                  inside the Hub
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
