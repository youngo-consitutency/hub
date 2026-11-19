import type { FocalOverviewResponse } from '../../shared/contracts'
import { useApi } from '../lib/api'
import { A, Async, Empty, PageHeader, Section } from '../components/ui'
import { ContactCard } from '../components/cards'
import { formatDate } from '../features/platform/api.ts'
import {
  TbWorld as FocalIcon,
  TbCalendar as Calendar,
  TbFileText as FileText,
  TbGavel as Gavel,
  TbArrowUpRight as Arrow,
  TbUsers as Users,
} from 'react-icons/tb'

export function FocalPoint() {
  const query = useApi<FocalOverviewResponse>('/member/focal/overview')
  return (
    <div>
      <PageHeader
        icon={FocalIcon}
        title="Global Focal Point"
        description="Follow constituency work, connect with mandate holders and coordinate UNFCCC communications."
      />
      <Async query={query} skeletons={5}>
        {(data) => (
          <>
            <div className="metricGrid">
              {[
                {
                  Icon: Calendar,
                  count: data.events.length,
                  label: 'upcoming calls',
                  href: '/calendar',
                },
                {
                  Icon: FileText,
                  count: data.submissions.length,
                  label: 'open submissions',
                  href: '/submissions',
                },
                {
                  Icon: Gavel,
                  count: data.decisions.length,
                  label: 'active decisions in your bodies',
                  href: '/council',
                },
              ].map(({ Icon, count, label, href }) => (
                <A key={href} href={href} className="metricCard">
                  <Icon size={20} aria-hidden />
                  <strong>{count}</strong>
                  <span>{label}</span>
                </A>
              ))}
            </div>
            <div className="workspaceColumns">
              <Section
                label="Upcoming calls"
                action={
                  <A href="/calendar" className="inlineLink">
                    Calendar <Arrow size={16} aria-hidden />
                  </A>
                }
              >
                <div className="stackSm">
                  {data.events.slice(0, 4).map((event) => (
                    <A key={event.slug} href={`/calendar/${event.slug}`} className="card recordRow">
                      <Calendar size={20} aria-hidden />
                      <div>
                        <strong>{event.title}</strong>
                        <p className="meta">{formatDate(event.startsAt)}</p>
                        <p className="meta">{event.wg?.name || 'Constituency'}</p>
                      </div>
                      <Arrow size={17} aria-hidden />
                    </A>
                  ))}
                  {!data.events.length && <Empty icon={Calendar} title="No upcoming calls" />}
                </div>
              </Section>
              <Section
                label="Active decisions"
                action={
                  <A href="/council" className="inlineLink">
                    All decisions <Arrow size={16} aria-hidden />
                  </A>
                }
              >
                <div className="stackSm">
                  {data.decisions.slice(0, 4).map((item) => (
                    <A key={item.slug} href={`/council/${item.slug}`} className="card recordRow">
                      <Gavel size={20} aria-hidden />
                      <div>
                        <strong>{item.title}</strong>
                        <span className="chip chip-neutral">
                          {item.status.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())}
                        </span>
                      </div>
                      <Arrow size={17} aria-hidden />
                    </A>
                  ))}
                  {!data.decisions.length && (
                    <Empty icon={Gavel} title="No active decisions in your bodies" />
                  )}
                </div>
              </Section>
            </div>
            <Section
              label="Open submissions"
              action={
                <A href="/submissions" className="inlineLink">
                  All submissions <Arrow size={16} aria-hidden />
                </A>
              }
            >
              <div className="cardGrid">
                {data.submissions.slice(0, 3).map((item) => (
                  <A key={item.slug} href={`/submissions/${item.slug}`} className="card entityCard">
                    <FileText size={22} aria-hidden />
                    <h3>{item.title}</h3>
                    <p className="meta">{item.wg?.name || 'Cross-constituency'}</p>
                    <span className="chip chip-neutral">Open</span>
                  </A>
                ))}
              </div>
              {!data.submissions.length && <Empty icon={FileText} title="No open submissions" />}
            </Section>
            <Section
              label="Mandate-holder contacts"
              action={
                <A href="/directory" className="inlineLink">
                  Full directory <Arrow size={16} aria-hidden />
                </A>
              }
            >
              <div className="cardGrid">
                {data.mandateContacts.slice(0, 3).map((contact, i) => (
                  <ContactCard key={i} contact={contact} />
                ))}
              </div>
              {!data.mandateContacts.length && (
                <Empty icon={Users} title="No mandate contacts yet" />
              )}
            </Section>
            <Section
              label="Working groups"
              action={
                <A href="/groups" className="inlineLink">
                  All groups <Arrow size={16} aria-hidden />
                </A>
              }
            >
              <div className="cardGrid">
                {data.groups.map((group) => (
                  <A key={group.slug} href={`/groups/${group.slug}`} className="card entityCard">
                    <Users size={22} aria-hidden />
                    <h3>{group.name}</h3>
                    <p className="meta">{group.focusLine}</p>
                    <span className="inlineLink">
                      View group <Arrow size={16} aria-hidden />
                    </span>
                  </A>
                ))}
              </div>
            </Section>
          </>
        )}
      </Async>
    </div>
  )
}
