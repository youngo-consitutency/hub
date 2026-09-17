import { useApi } from '../lib/api.js'
import {
  A,
  Async,
  BackLink,
  Section,
  Empty,
  PageHeader,
} from '../components/ui.jsx'
import { EventCard, PersonCard, SubmissionCard } from '../components/cards.jsx'
import { CopyFeedButton } from '../components/Subscribe.jsx'
import { ExternalResourceRow } from '../components/DestinationLink.jsx'
import {
  groupResourcesByCategory,
  isPublicGroupResource,
} from '../../shared/resourceCategories.js'
import {
  TbArrowRight as ArrowRight,
  TbBook2 as Book,
  TbCalendarOff as CalendarOff,
  TbFiles as Files,
  TbLock as Lock,
  TbLockOpen as Unlock,
  TbMessages as Messages,
  TbUserQuestion as UserQuestion,
  TbUsersPlus as UsersPlus,
} from 'react-icons/tb'

const RESOURCE_CATEGORY_ICONS = {
  join: UsersPlus,
  channels: Messages,
  workspace: Files,
  reference: Book,
}

const PUBLIC_RESOURCE_LABELS = {
  channels: 'Social media',
  reference: 'Open resources',
}

function GroupCommunity({ slug }) {
  const contactQuery = useApi(
    `/member/people?workingGroup=${encodeURIComponent(slug)}&workingGroupRole=manager&pageSize=12`,
    [slug],
  )
  const memberQuery = useApi(
    `/member/people?workingGroup=${encodeURIComponent(slug)}&workingGroupRole=participant&pageSize=6`,
    [slug],
  )
  return (
    <>
      <Section label="Contact point">
        <Async query={contactQuery} skeletons={1}>
          {(data) =>
            data.items.length ? (
              <div className="peopleGrid groupContactAccountGrid">
                {data.items.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            ) : (
              <Empty
                icon={UserQuestion}
                title="No linked Contact Point account"
                body="An assigned Contact Point will appear here after publishing their member profile."
              />
            )
          }
        </Async>
      </Section>
      <Async query={memberQuery} skeletons={1}>
        {(data) =>
          data.items.length ? (
            <Section label="People in this group">
              <p className="meta groupPeopleNote">
                Members shown here have chosen to publish their profile. Group
                membership and roles update from the workspace automatically.
              </p>
              <div className="peopleGrid groupPeopleGrid">
                {data.items.map((person) => (
                  <PersonCard key={person.id} person={person} />
                ))}
              </div>
            </Section>
          ) : null
        }
      </Async>
    </>
  )
}

function GroupResourceGroups({ slug, resources, locked }) {
  const categories = groupResourcesByCategory(resources)
  const publicCategories = groupResourcesByCategory(
    resources.filter(isPublicGroupResource),
  )
  const midpoint = Math.ceil(categories.length / 2)
  const columns = locked
    ? [publicCategories].filter((column) => column.length > 0)
    : [categories.slice(0, midpoint), categories.slice(midpoint)].filter(
        (column) => column.length > 0,
      )
  const itemCount = columns.length + (locked ? 1 : 0)
  const className = `groupResourceGroups${itemCount === 1 ? ' isSingle' : ''}`

  return (
    <div className={className}>
      {columns.map((column, columnIndex) => (
        <div className="groupResourceColumn" key={columnIndex}>
          {column.map((category) => {
            const headingId = `resource-group-${slug}-${category.key}`
            const CategoryIcon = RESOURCE_CATEGORY_ICONS[category.key]
            return (
              <section
                className="groupResourceGroup"
                aria-labelledby={headingId}
                key={category.key}
              >
                <h3 className="groupResourceGroupTitle" id={headingId}>
                  <CategoryIcon size={16} strokeWidth={1.75} aria-hidden />
                  {locked
                    ? PUBLIC_RESOURCE_LABELS[category.key] || category.label
                    : category.label}
                </h3>
                <div className="resourceList groupResourceList">
                  {category.resources.map((resource) => (
                    <ExternalResourceRow
                      key={resource.url}
                      href={resource.url}
                      label={resource.label}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ))}
      {locked && (
        <Empty
          icon={Lock}
          title="Member resources"
          body="Unlock the workspace to see join links, member channels, and working files."
          cta={
            <A href={`/workspace/${slug}`} className="btn btn-secondary btn-sm">
              Unlock to see
              <ArrowRight size={17} strokeWidth={1.75} aria-hidden />
            </A>
          }
        />
      )}
    </div>
  )
}

export function GroupDetail({ slug }) {
  const query = useApi(`/groups/${slug}`)
  return (
    <div className="detailPage">
      <BackLink href="/groups">Working groups</BackLink>
      <Async query={query}>
        {(g) => (
          <>
            <PageHeader title={g.name} description={g.focusLine}>
              {g.cadenceNote && (
                <p className="metaMuted mono">{g.cadenceNote}</p>
              )}
            </PageHeader>

            <section className="card groupOverview" aria-label="Group access">
              <div className="groupOverviewCopy">
                <h2>Member workspace</h2>
                <p className="metaMuted detailHelp">
                  Complete the short group introduction once to open member
                  channels, activities, and full Contact Point details.
                </p>
              </div>
              <div className="detailActions groupOverviewActions">
                <A href={`/workspace/${g.slug}`} className="btn btn-primary">
                  <Unlock size={18} strokeWidth={1.75} aria-hidden />
                  Open workspace
                </A>
              </div>
            </section>

            {g.taskForces?.length > 0 && (
              <Section label="Task forces">
                <div className="cardGrid groupActivityGrid">
                  {g.taskForces.map((force) => (
                    <A
                      key={force.slug}
                      href={`/groups/${g.slug}/${force.slug}`}
                      className="card cardTight entityCard"
                      peek
                    >
                      <h3>{force.name}</h3>
                      {force.purpose && <p className="meta">{force.purpose}</p>}
                    </A>
                  ))}
                </div>
              </Section>
            )}

            <GroupCommunity slug={g.slug} />

            <Section
              label="Upcoming meetings"
              action={
                g.events?.length ? (
                  <CopyFeedButton
                    path={`/ics/wg/${g.slug}.ics`}
                    label="Subscribe"
                    className="btn btn-ghost btn-sm"
                  />
                ) : null
              }
            >
              {g.events?.length ? (
                <div className="cardGrid groupActivityGrid">
                  {g.events.map((e) => (
                    <EventCard key={e.slug} event={e} />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={CalendarOff}
                  title="Nothing scheduled"
                  body="No upcoming calls for this group right now."
                />
              )}
            </Section>

            {g.submissions?.length > 0 && (
              <Section label="Open submissions">
                <div className="cardGrid groupActivityGrid">
                  {g.submissions.map((s) => (
                    <SubmissionCard key={s.slug} sub={s} />
                  ))}
                </div>
              </Section>
            )}

            {(g.resources?.length > 0 || g.workspaceResourcesLocked) && (
              <section
                className="section groupResourcesSection"
                aria-labelledby={`group-resources-${g.slug}`}
              >
                <h2 className="srOnly" id={`group-resources-${g.slug}`}>
                  Links and resources
                </h2>
                <GroupResourceGroups
                  slug={g.slug}
                  resources={g.resources || []}
                  locked={Boolean(g.workspaceResourcesLocked)}
                />
              </section>
            )}
          </>
        )}
      </Async>
    </div>
  )
}
