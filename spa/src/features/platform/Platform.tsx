import { bodyRoles } from '../../../shared/protocol.js'
import { useContentOptionLabels } from '../../lib/documents.js'
import { SidePanel } from '../../components/SidePanel.tsx'
import {
  TbSitemap as BodiesIcon,
  TbClipboardCheck as WorkIcon,
  TbGavel as DecisionIcon,
  TbHeartHandshake as PartnershipIcon,
  TbPlus as Plus,
  TbPencil as Pencil,
  TbUser as UserIcon,
  TbCalendarTime as DueIcon,
  TbCircleCheck as DoneIcon,
  TbProgress as ProgressIcon,
  TbList as ListIcon,
} from 'react-icons/tb'
import { PageSectionNav } from '../../components/PageSectionNav.jsx'
import { Feedback } from './Feedback.tsx'
import { useState, type FormEvent } from 'react'
import {
  A,
  PageHeader,
  FilterPill,
  FilterChip,
  Empty,
  ErrorCard,
  Skeletons,
} from '../../components/ui.jsx'
import {
  BODY_KINDS,
  type Overview,
  type Body,
  type Task,
  type Enquiry,
} from '../../../shared/platform.ts'
import { post, patch, usePlatform, values, formatDate } from './api.ts'
import { Field, Text, Select, localDate } from './fields.tsx'

const PAGE_ICONS = {
  bodies: BodiesIcon,
  work: WorkIcon,
  decisions: DecisionIcon,
  partnerships: PartnershipIcon,
}
const TASK_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  done: 'Completed',
}
const TASK_ICONS = { active: ProgressIcon, completed: DoneIcon, all: ListIcon }

type Tab = 'bodies' | 'work' | 'decisions' | 'partnerships'

const SECTIONS: Record<Tab, { href: string; label: string; description: string }> = {
  bodies: {
    href: '/platform',
    label: 'Bodies & mandates',
    description: 'Working groups, operational teams and the people responsible for them.',
  },
  work: {
    href: '/work',
    label: 'Work & follow-up',
    description: 'Keep tasks, owners and deadlines connected to your bodies and decisions.',
  },
  decisions: {
    href: '/council',
    label: 'Decisions',
    description: 'Draft proposals, contribute to consultations and follow agreed outcomes.',
  },
  partnerships: {
    href: '/platform/partnerships',
    label: 'Partnerships',
    description: 'Review enquiries, organise follow-up and maintain approved partnerships.',
  },
}

export function Platform({ initialTab = 'bodies', slug }: { initialTab?: Tab; slug?: string }) {
  const tab: Tab = slug === 'partnerships' ? slug : initialTab
  return <Workspace key={tab} tab={tab} />
}

function Workspace({ tab }: { tab: Tab }) {
  const { teamLabels, assignmentLabels } = useContentOptionLabels()
  const [recordBody, setRecordBody] = useState('')
  const [attentionOpen, setAttentionOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)

  const { data, error, loading, reload } = usePlatform<Overview>('/overview')
  const [message, setMessage] = useState(''),
    [failure, setFailure] = useState(''),
    [busy, setBusy] = useState(false)
  const [body, setBody] = useState<Body | null>(null),
    [task, setTask] = useState<Task | null>(null),
    [enquiry, setEnquiry] = useState<Enquiry | null>(null),
    [scope, setScope] = useState('body'),
    [process, setProcess] = useState('standard'),
    [workFilter, setWorkFilter] = useState('active')
  function openEditor() {
    setFailure('')
    setEditorOpen(true)
  }
  function closeEditor() {
    setBody(null)
    setTask(null)
    setEnquiry(null)
    setEditorOpen(false)
    setRecordOpen(false)
  }
  async function run(action: () => Promise<unknown>, form?: HTMLFormElement) {
    setBusy(true)
    setFailure('')
    setMessage('')
    try {
      await action()
      form?.reset()
      closeEditor()
      setMessage('Saved.')
      reload()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }
  const submit =
    (action: (input: Record<string, unknown>) => Promise<unknown>) =>
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      void run(() => action(values(form)), form)
    }
  const bodyName = (id: string) => data?.bodies.find((b) => b.id === id)?.name || id
  const visibleTasks =
    data?.tasks.filter(
      (task) =>
        workFilter === 'all' ||
        (workFilter === 'completed' ? task.status === 'done' : task.status !== 'done'),
    ) || []
  const bodyOptions = data?.bodies
    .filter((b) => b.canParticipate)
    .map((b) => (
      <option key={b.id} value={b.id}>
        {b.name}
      </option>
    ))
  return (
    <div className="platform stack">
      <PageHeader
        icon={PAGE_ICONS[tab]}
        title={SECTIONS[tab].label}
        description={SECTIONS[tab].description}
        action={
          data &&
          ((tab === 'bodies' && data.canAdminister) ||
            ((tab === 'work' || tab === 'decisions') && Boolean(bodyOptions?.length))) ? (
            <button className="btn btn-primary" onClick={openEditor}>
              <Plus size={17} aria-hidden />
              {tab === 'bodies'
                ? body
                  ? 'Continue editing'
                  : 'Add a body'
                : tab === 'work'
                  ? task
                    ? 'Continue editing'
                    : 'Add a task'
                  : 'Draft a proposal'}
            </button>
          ) : undefined
        }
      >
        {tab === 'bodies' && <PageSectionNav section="groups" />}
      </PageHeader>
      {loading && !data && <Skeletons n={4} />}
      {error && <ErrorCard message={error} onRetry={reload} />}
      <Feedback error={editorOpen || recordOpen ? '' : failure} message={message} />
      {data && (
        <>
          {tab === 'work' && data.notices.length > 0 && (
            <div className="attentionSummary card">
              <div>
                <h2>
                  <DueIcon size={20} aria-hidden /> Upcoming & overdue
                </h2>
                <p className="meta">
                  {data.notices.filter((n) => Date.parse(n.dueAt) < Date.now()).length} overdue ·{' '}
                  {data.notices.length} items to review
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setAttentionOpen(true)}>
                Review deadlines
              </button>
            </div>
          )}
          {attentionOpen && (
            <SidePanel title="Upcoming & overdue" onClose={() => setAttentionOpen(false)}>
              <p className="meta">
                Review deadlines and arrange follow-up. Decisions and mandates still require their
                agreed processes.
              </p>
              {Object.entries({
                task: 'Tasks',
                decision: 'Decision processes',
                handover: 'Mandate handovers',
                renewal: 'Membership renewals',
                review: 'Public information',
                partnership: 'Partnership follow-up',
              }).map(([kind, label]) => {
                const notices = data.notices.filter((n) => n.kind === kind)
                return (
                  notices.length > 0 && (
                    <section className="attentionGroup" key={kind}>
                      <h3>
                        {label} <span className="meta">({notices.length})</span>
                      </h3>
                      <ul className="attentionList">
                        {notices.map((n, i) => (
                          <li key={i}>
                            <span>{n.title}</span>
                            <time
                              dateTime={n.dueAt}
                              className={
                                Date.parse(n.dueAt) < Date.now() ? 'attentionOverdue' : 'meta'
                              }
                            >
                              {formatDate(n.dueAt)}
                              {Date.parse(n.dueAt) < Date.now() ? ' · Overdue' : ''}
                            </time>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                )
              })}
            </SidePanel>
          )}
          {tab === 'bodies' && (
            <>
              <section className="stack">
                <h2>Recorded bodies</h2>
                {!data.bodies.length && (
                  <Empty
                    icon={BodiesIcon}
                    title="No bodies recorded yet"
                    body="A platform administrator can add a verified working group, team or Council and record its current authority records below."
                  />
                )}
                <div className="cardGrid">
                  {data.bodies.map((b) => (
                    <article className="card entityCard" key={b.id}>
                      <h3>{b.name}</h3>
                      <p className="meta">{b.kind.replaceAll('_', ' ')}</p>
                      <p>{b.description}</p>
                      <details>
                        <summary>Public information for review</summary>
                        <p className="platformProse">
                          {b.publicSummary || 'No public summary yet.'}
                        </p>
                      </details>
                      <p className="meta">
                        {b.publishedVersion === b.version
                          ? 'Public information is current'
                          : b.publishedVersion
                            ? 'Public information has unpublished changes'
                            : 'Not yet published'}
                      </p>
                      {data.canPublish && b.publishedVersion && (
                        <details className="platformDisclosure">
                          <summary>Withdraw public information</summary>
                          <form
                            className="platformForm"
                            onSubmit={submit((input) =>
                              post(`/bodies/${b.id}/withdraw-publication`, {
                                ...input,
                                version: b.version,
                              }),
                            )}
                          >
                            <Field
                              label="Reason to withdraw public information"
                              name="reason"
                              required
                            />
                            <button className="btn" disabled={busy}>
                              Withdraw public information
                            </button>
                          </form>
                        </details>
                      )}
                      <div className="rowGap">
                        {(b.canManage || data.canAdminister) && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              openEditor()
                              setBody(b)
                            }}
                          >
                            Edit body
                          </button>
                        )}
                        {b.kind === 'working_group' && !b.canParticipate && (
                          <button
                            disabled={busy}
                            className="btn"
                            onClick={() => void run(() => post(`/bodies/${b.id}/join`))}
                          >
                            Join working group
                          </button>
                        )}
                        {data.canPublish && b.publishedVersion !== b.version && (
                          <button
                            disabled={busy}
                            className="btn"
                            onClick={() =>
                              void run(() =>
                                post(`/bodies/${b.id}/publish`, {
                                  version: b.version,
                                }),
                              )
                            }
                          >
                            Publish reviewed information
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
              {editorOpen && (data.canAdminister || body) && (
                <SidePanel title={body ? `Edit ${body.name}` : 'Add a body'} onClose={closeEditor}>
                  <Feedback error={failure} message="" />
                  <form
                    className="platformForm"
                    key={body?.id || 'new-body'}
                    onSubmit={submit((input) =>
                      body
                        ? patch(`/bodies/${body.id}`, {
                            ...input,
                            version: body.version,
                          })
                        : post('/bodies', input),
                    )}
                  >
                    <Field label="Name" name="name" defaultValue={body?.name} required />
                    {!body && (
                      <Field label="Identifier (for example adaptation-wg)" name="id" required />
                    )}
                    <Select label="Type" name="kind" defaultValue={body?.kind || 'working_group'}>
                      {BODY_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                    <Text
                      label="Member description"
                      name="description"
                      defaultValue={body?.description}
                    />
                    <Text
                      label="Public summary for review"
                      name="publicSummary"
                      defaultValue={body?.publicSummary}
                      maxLength={3000}
                    />
                    <Field
                      label="Next information review"
                      name="reviewDueAt"
                      type="datetime-local"
                      defaultValue={localDate(body?.reviewDueAt || null)}
                    />
                    <button disabled={busy} className="btn btn-primary">
                      Save draft information
                    </button>
                    {body && (
                      <button type="button" className="btn" onClick={closeEditor}>
                        Cancel edit
                      </button>
                    )}
                  </form>
                </SidePanel>
              )}
              <section className="stack">
                <h2>Authority records</h2>
                <p className="meta">
                  Authority records carry a role, scope, term and evidence. A coordination role does
                  not itself authorise a policy decision.
                </p>
                <div className="cardGrid">
                  {data.records.map((a) => (
                    <article className="card entityCard" key={a.id}>
                      <h3>
                        {a.name} · {assignmentLabels[a.role] || a.role}
                      </h3>
                      <p>
                        {a.scopeType.replaceAll('_', ' ')} /{' '}
                        {a.scopeType === 'body'
                          ? bodyName(a.scopeId)
                          : teamLabels[a.scopeId] || a.scopeId.replaceAll('_', ' ')}
                      </p>
                      <p className="meta">
                        {formatDate(a.startsAt)} → {formatDate(a.endsAt)} · {a.status}
                      </p>
                      {a.evidence && <p>{a.evidence}</p>}
                      {data.canAdminister && a.status === 'active' && (
                        <details className="platformDisclosure">
                          <summary>End this assignment</summary>
                          <form
                            className="platformForm"
                            onSubmit={submit((input) => post(`/records/${a.id}/revoke`, input))}
                          >
                            <Field label="Reason for ending assignment" name="reason" required />
                            <button disabled={busy} className="btn btn-secondary">
                              End assignment
                            </button>
                          </form>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              {data.canAdminister && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setFailure('')
                      setRecordOpen(true)
                    }}
                  >
                    <Plus size={17} aria-hidden /> Record an assignment
                  </button>
                  {recordOpen && (
                    <SidePanel title="Record an assignment" onClose={closeEditor}>
                      <Feedback error={failure} message="" />
                      <form
                        className="platformForm"
                        onSubmit={submit((input) => post('/records', input))}
                      >
                        <Select label="Person" name="accountId">
                          {data.people
                            .filter((p) => p.entityType === 'individual')
                            .map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </Select>
                        <label className="platformField">
                          Scope
                          <select
                            className="input"
                            name="scopeType"
                            aria-label="Scope"
                            value={scope}
                            onChange={(e) => setScope(e.target.value)}
                          >
                            <option value="body">Body</option>
                            <option value="team">Responsibility or website access</option>
                            <option value="working_group">Existing working group</option>
                          </select>
                        </label>
                        {scope === 'body' ? (
                          <label className="platformField">
                            Body
                            <select
                              className="input"
                              name="scopeId"
                              value={recordBody || data.bodies[0]?.id || ''}
                              onChange={(e) => setRecordBody(e.target.value)}
                            >
                              {data.bodies.map((b) => (
                                <option value={b.id} key={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : scope === 'team' ? (
                          <Select label="Responsibility" name="scopeId">
                            {[
                              'membership_team',
                              'partnerships',
                              'content_editor',
                              'content_publisher',
                              'gys_policy_team',
                            ].map((r) => (
                              <option key={r} value={r}>
                                {teamLabels[r] || r.replaceAll('_', ' ')}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Field
                            label="Existing working group identifier"
                            name="scopeId"
                            required
                          />
                        )}
                        <Select label="Responsibility" name="role" key={`${scope}-${recordBody}`}>
                          {(scope === 'body'
                            ? bodyRoles(
                                data.bodies.find((b) => b.id === (recordBody || data.bodies[0]?.id))
                                  ?.kind,
                              )
                            : scope === 'team'
                              ? ['member']
                              : ['contact']
                          ).map((r: string) => (
                            <option key={r} value={r}>
                              {assignmentLabels[r] || r}
                            </option>
                          ))}
                        </Select>
                        <p className="meta">
                          Record an existing appointment and its evidence. Website drafting and
                          publishing permissions do not create YOUNGO roles.
                        </p>
                        <Field label="Starts" name="startsAt" type="datetime-local" required />
                        <Field label="Ends" name="endsAt" type="datetime-local" required />
                        <Text
                          label="Appointment or selection evidence"
                          name="evidence"
                          required
                          maxLength={2000}
                        />
                        <button disabled={busy} className="btn btn-primary">
                          Record assignment
                        </button>
                      </form>
                    </SidePanel>
                  )}
                </>
              )}
            </>
          )}
          {tab === 'work' && (
            <>
              <section className="stack">
                <div className="pillRow platformTaskFilters" role="group" aria-label="Task status">
                  {(['active', 'completed', 'all'] as const).map((filter) => (
                    <FilterPill
                      type="button"
                      key={filter}
                      active={workFilter === filter}
                      icon={TASK_ICONS[filter]}
                      onClick={() => setWorkFilter(filter)}
                    >
                      {filter === 'active'
                        ? 'Active'
                        : filter === 'completed'
                          ? 'Completed'
                          : 'All tasks'}
                    </FilterPill>
                  ))}
                </div>
                {!visibleTasks.length && (
                  <Empty
                    icon={WorkIcon}
                    body={
                      workFilter === 'completed'
                        ? 'No completed tasks yet.'
                        : workFilter === 'active'
                          ? 'No active tasks in your assigned bodies.'
                          : 'No tasks in your assigned bodies yet.'
                    }
                  />
                )}
                <div className="cardGrid">
                  {visibleTasks.map((t) => (
                    <article className="card entityCard" key={t.id}>
                      <h3>{t.title}</h3>
                      <p className="platformProse">{t.description}</p>
                      <div className="platformCardMeta meta">
                        <span>
                          <BodiesIcon size={16} aria-hidden />
                          {bodyName(t.bodyId)}
                        </span>
                        <span>
                          <UserIcon size={16} aria-hidden />
                          {t.ownerName || 'Unassigned'}
                        </span>
                        <span>
                          <DueIcon size={16} aria-hidden />
                          {formatDate(t.dueAt)}
                        </span>
                      </div>
                      <FilterChip
                        tone={t.status === 'done' ? 'accent' : 'neutral'}
                        icon={t.status === 'done' ? DoneIcon : ProgressIcon}
                      >
                        {TASK_LABELS[t.status]}
                      </FilterChip>
                      {t.decisionId && <A href={`/council/${t.decisionId}`}>Linked decision</A>}
                      {t.canEdit && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            openEditor()
                            setTask(t)
                          }}
                        >
                          <Pencil size={16} aria-hidden /> Update task
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              {editorOpen && bodyOptions?.length !== 0 && (
                <SidePanel title={task ? 'Update task' : 'Add a task'} onClose={closeEditor}>
                  <Feedback error={failure} message="" />
                  <form
                    className="platformForm"
                    key={task?.id || 'new-task'}
                    onSubmit={submit((input) =>
                      task
                        ? patch(`/tasks/${task.id}`, {
                            ...input,
                            version: task.version,
                          })
                        : post('/tasks', input),
                    )}
                  >
                    <Select label="Body" name="bodyId" defaultValue={task?.bodyId}>
                      {bodyOptions}
                    </Select>
                    <Field label="Title" name="title" defaultValue={task?.title} required />
                    <Text
                      label="Description and document links"
                      name="description"
                      defaultValue={task?.description}
                    />
                    <Select label="Owner" name="ownerId" defaultValue={task?.ownerId || ''}>
                      <option value="">Unassigned</option>
                      {data.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="Due"
                      name="dueAt"
                      type="datetime-local"
                      defaultValue={localDate(task?.dueAt || null)}
                    />
                    <Select label="Status" name="status" defaultValue={task?.status || 'open'}>
                      {['open', 'in_progress', 'done'].map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Adopted decision"
                      name="decisionId"
                      defaultValue={task?.decisionId || ''}
                    >
                      <option value="">No linked decision</option>
                      {data.decisions
                        .filter((d) => d.stage === 'adopted')
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title}
                          </option>
                        ))}
                    </Select>
                    <button disabled={busy} className="btn btn-primary">
                      Save task
                    </button>
                    {task && (
                      <button type="button" className="btn" onClick={closeEditor}>
                        Cancel edit
                      </button>
                    )}
                  </form>
                </SidePanel>
              )}
            </>
          )}
          {tab === 'decisions' && (
            <>
              <section className="stack">
                <p className="meta">
                  Only processes belonging to your current body memberships are shown. Adopted
                  decisions can be reviewed for publication.
                </p>
                {!data.decisions.length && (
                  <Empty
                    icon={DecisionIcon}
                    title="No proposals yet"
                    body="Nothing is in front of your bodies right now. Use “Draft a proposal” to get started."
                  />
                )}
                <div className="cardGrid">
                  {data.decisions.map((d) => (
                    <article className="card entityCard" key={d.id}>
                      <h3>
                        <A href={`/council/${d.id}`}>{d.title}</A>
                      </h3>
                      <span className="chip chip-neutral">
                        {d.stage.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      <div className="meta platformCardMeta">
                        <span>
                          <BodiesIcon size={16} aria-hidden />
                          {d.bodyName}
                        </span>
                        {d.deadlineAt && (
                          <span>
                            <DueIcon size={16} aria-hidden />
                            {formatDate(d.deadlineAt)}
                          </span>
                        )}
                      </div>
                      {data.canPublish && d.isPublic && (
                        <details className="platformDisclosure">
                          <summary>Withdraw public outcome</summary>
                          <form
                            className="platformForm"
                            onSubmit={submit((input) =>
                              post(`/decisions/${d.id}/withdraw-publication`, {
                                ...input,
                                version: d.version,
                              }),
                            )}
                          >
                            <Field
                              label="Reason to withdraw the public outcome"
                              name="reason"
                              required
                            />
                            <button className="btn" disabled={busy}>
                              Withdraw public outcome
                            </button>
                          </form>
                        </details>
                      )}
                      {data.canPublish && d.stage === 'adopted' && !d.isPublic && (
                        <button
                          disabled={busy}
                          className="btn"
                          onClick={() =>
                            void run(() =>
                              post(`/decisions/${d.id}/publish`, {
                                version: d.version,
                              }),
                            )
                          }
                        >
                          Publish reviewed outcome
                        </button>
                      )}
                    </article>
                  ))}
                </div>
              </section>
              {editorOpen && bodyOptions?.length !== 0 && (
                <SidePanel title="Draft a proposal" onClose={closeEditor}>
                  <Feedback error={failure} message="" />
                  <form
                    className="platformForm"
                    onSubmit={submit((input) => post('/decisions', input))}
                  >
                    <Select label="Decision-making body" name="bodyId">
                      {bodyOptions}
                    </Select>
                    <Field label="Title" name="title" required />
                    <Text label="Proposal text" name="proposal" required maxLength={20000} />
                    <Field
                      label="Policy version or document reference"
                      name="policyVersion"
                      defaultValue="YOUNGO Decision-Making Processes 2025"
                      required
                    />
                    <Select
                      label="Process"
                      name="process"
                      value={process}
                      onChange={(event) => setProcess(event.target.value)}
                    >
                      <option value="standard">Standard: 5 days + 24 hours + 24 hours</option>
                      <option value="snap">Snap: half, quarter, quarter of available time</option>
                    </Select>
                    {process === 'snap' && (
                      <>
                        <Field
                          label="Available hours for a snap process"
                          name="snapHours"
                          type="number"
                          defaultValue="24"
                        />
                        <Text
                          label="Urgency and extension request evidence (required for snap processes)"
                          name="urgencyReason"
                          maxLength={2000}
                        />
                      </>
                    )}
                    <button disabled={busy} className="btn btn-primary">
                      Save draft proposal
                    </button>
                  </form>
                </SidePanel>
              )}
            </>
          )}
          {tab === 'partnerships' && !data.canManagePartnerships && (
            <Empty
              icon={PartnershipIcon}
              title="Partnerships team only"
              body="Partner enquiries are available to the partnerships team."
            />
          )}
          {tab === 'partnerships' && data.canManagePartnerships && (
            <>
              <section className="stack">
                <h2>Partner enquiries</h2>
                <p className="meta">
                  Contact details and messages stay in this restricted queue. A public partnership
                  requires a published approving decision and a reviewed summary.
                </p>
                {!data.enquiries.length && (
                  <Empty
                    icon={PartnershipIcon}
                    body="No enquiries yet. The public contact page accepts new enquiries."
                  />
                )}
                <div className="cardGrid">
                  {data.enquiries.map((e) => (
                    <article className="card entityCard" key={e.id}>
                      <h3>{e.organisation}</h3>
                      <p>
                        {e.contactName} · {e.email}
                      </p>
                      <p className="platformProse">{e.message}</p>
                      <p className="meta">
                        {e.status} · Follow up {formatDate(e.followUpAt)}
                      </p>
                      <button
                        className="btn"
                        onClick={() => {
                          openEditor()
                          setEnquiry(e)
                        }}
                      >
                        Manage enquiry
                      </button>
                    </article>
                  ))}
                </div>
              </section>
              {editorOpen && enquiry && (
                <SidePanel title={enquiry.organisation} onClose={closeEditor}>
                  <Feedback error={failure} message="" />
                  <form
                    className="platformForm"
                    key={enquiry.id}
                    onSubmit={submit((input) =>
                      patch(`/enquiries/${enquiry.id}`, {
                        ...input,
                        version: enquiry.version,
                      }),
                    )}
                  >
                    <Select label="Status" name="status" defaultValue={enquiry.status}>
                      {['new', 'in_progress', 'closed', 'approved'].map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </Select>
                    <Select label="Owner" name="ownerId" defaultValue={enquiry.ownerId || ''}>
                      <option value="">Unassigned</option>
                      {data.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                    <Field
                      label="Follow up"
                      name="followUpAt"
                      type="datetime-local"
                      defaultValue={localDate(enquiry.followUpAt)}
                    />
                    <Select
                      label="Published approving decision"
                      name="decisionId"
                      defaultValue={enquiry.decisionId || ''}
                    >
                      <option value="">Not approved yet</option>
                      {data.decisions
                        .filter((d) => d.stage === 'adopted' && d.isPublic)
                        .map((d) => (
                          <option value={d.id} key={d.id}>
                            {d.title}
                          </option>
                        ))}
                    </Select>
                    <Text
                      label="Public partnership summary"
                      name="publicSummary"
                      defaultValue={enquiry.publicSummary}
                      maxLength={3000}
                    />
                    <Field
                      label="Public organisation website"
                      name="website"
                      type="url"
                      defaultValue={enquiry.website}
                      maxLength={1000}
                    />
                    <button className="btn btn-primary" disabled={busy}>
                      Save enquiry
                    </button>
                    <button type="button" className="btn" onClick={closeEditor}>
                      Cancel
                    </button>
                  </form>
                </SidePanel>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
export function Decisions() {
  return <Platform initialTab="decisions" />
}
export function Work() {
  return <Platform initialTab="work" />
}
