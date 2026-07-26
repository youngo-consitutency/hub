import { useApi } from '../lib/api.js'
import {
  A,
  Async,
  Empty,
  PageHeader,
  Section,
  StatusChip,
} from '../components/ui.jsx'
import { ContactCard } from '../components/cards.jsx'
import {
  CalendarDays,
  FileText,
  Gavel,
  Network,
  Radio,
  Users,
} from 'lucide-react'

export function FocalPoint() {
  const query = useApi('/member/focal/overview')
  return (
    <div>
      <PageHeader
        eyebrow="Constituency representation"
        title="Focal Point"
        description="Track constituency signals, coordinate with mandate holders, and keep UNFCCC-facing work connected to what members are doing."
      />

      <Async query={query} skeletons={5}>
        {(data) => (
          <>
            <div className="metricGrid">
              <div className="metricCard">
                <Radio size={18} aria-hidden />
                <strong>{data.events.length}</strong>
                <span>upcoming calls</span>
              </div>
              <div className="metricCard">
                <FileText size={18} aria-hidden />
                <strong>{data.submissions.length}</strong>
                <span>open submissions</span>
              </div>
              <div className="metricCard">
                <Gavel size={18} aria-hidden />
                <strong>{data.decisions.length}</strong>
                <span>active decisions</span>
              </div>
            </div>

            <div className="focalGrid">
              <Section
                label="Mandate-holder directory"
                action={
                  <A href="/directory" className="metaMuted">
                    Full directory →
                  </A>
                }
              >
                {!data.mandateContacts.length ? (
                  <Empty icon={Users} title="No mandate contacts yet" />
                ) : (
                  <div className="grid2">
                    {data.mandateContacts.slice(0, 6).map((contact) => (
                      <ContactCard
                        key={`${contact.group}-${contact.roleTitle}`}
                        contact={contact}
                      />
                    ))}
                  </div>
                )}
              </Section>

              <Section
                label="Near-term calls"
                action={
                  <A href="/calendar" className="metaMuted">
                    Calendar →
                  </A>
                }
              >
                <div className="stackSm">
                  {data.events.slice(0, 5).map((event) => (
                    <A
                      key={event.slug}
                      href={`/calendar/${event.slug}`}
                      className="card cardTight queueRow"
                    >
                      <div>
                        <strong>{event.title}</strong>
                        <p className="meta">
                          {new Date(event.startsAt).toLocaleString()} ·{' '}
                          {event.wg?.name || 'Constituency'}
                        </p>
                      </div>
                      <CalendarDays size={18} aria-hidden />
                    </A>
                  ))}
                  {!data.events.length && (
                    <Empty icon={CalendarDays} title="No upcoming calls" />
                  )}
                </div>
              </Section>
            </div>

            <Section label="Constituency progress signals">
              <div className="grid2">
                <div>
                  <h3 className="subsectionHeading">Open submissions</h3>
                  <div className="stackSm">
                    {data.submissions.slice(0, 4).map((item) => (
                      <A
                        key={item.slug}
                        href={`/submissions/${item.slug}`}
                        className="card cardTight queueRow"
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <p className="meta">
                            {item.wg?.name || 'Cross-constituency'}
                          </p>
                        </div>
                        <StatusChip status={item.status} />
                      </A>
                    ))}
                    {!data.submissions.length && (
                      <Empty icon={FileText} title="No open submissions" />
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="subsectionHeading">
                    Active council decisions
                  </h3>
                  <div className="stackSm">
                    {data.decisions.slice(0, 4).map((item) => (
                      <A
                        key={item.slug}
                        href={`/council/${item.slug}`}
                        className="card cardTight queueRow"
                      >
                        <div>
                          <strong>{item.title}</strong>
                          <p className="meta">
                            {item.summary || 'Decision process active'}
                          </p>
                        </div>
                        <StatusChip status={item.status} />
                      </A>
                    ))}
                    {!data.decisions.length && (
                      <Empty icon={Gavel} title="No active decisions" />
                    )}
                  </div>
                </div>
              </div>
            </Section>

            <Section label="Working group coverage">
              <div className="grid2">
                {data.groups.map((group) => (
                  <A
                    key={group.slug}
                    href={`/groups/${group.slug}`}
                    className="card cardTight queueRow"
                  >
                    <div className="rowGap">
                      <span className="monogram">{group.monogram}</span>
                      <div>
                        <strong>{group.name}</strong>
                        <p className="meta">{group.focusLine}</p>
                      </div>
                    </div>
                    <Users size={18} aria-hidden />
                  </A>
                ))}
                {!data.groups.length && (
                  <Empty icon={Network} title="No working groups yet" />
                )}
              </div>
            </Section>
          </>
        )}
      </Async>
    </div>
  )
}
