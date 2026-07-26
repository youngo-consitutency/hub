import { useMemo, useState } from 'react'
import { apiPatch, apiPost, useApi } from '../lib/api.js'
import { useAccount } from '../lib/accountContext.jsx'
import {
  Async,
  Button,
  Empty,
  ErrorCard,
  FilterPill,
  PageHeader,
  Section,
  StatusChip,
} from '../components/ui.jsx'
import { FieldError, SearchableSelect } from '../components/FormControls.jsx'
import { EVENT_TYPES } from '../../shared/contentValidation.js'
import {
  CalendarDays,
  CheckCircle2,
  FilePenLine,
  Megaphone,
  Send,
  Upload,
} from 'lucide-react'

const EMPTY_EVENT = {
  slug: '',
  title: '',
  type: 'wg_call',
  startsAt: '',
  endsAt: '',
  description: '',
  wg: '',
  meetingUrl: '',
  recordingUrl: '',
}
const EMPTY_ANNOUNCEMENT = {
  slug: '',
  title: '',
  body: '',
  pinned: false,
  ctaUrl: '',
  ctaLabel: '',
  ctaDeadlineAt: '',
}

const TYPE_LABELS = {
  constituency_call: 'Constituency call',
  wg_call: 'Working-group call',
  wgf: 'Working-group forum',
  unfccc_session: 'UNFCCC session',
  webinar: 'Webinar',
  coordination: 'Coordination',
}

function localDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function eventForm(payload = {}) {
  return {
    ...EMPTY_EVENT,
    ...payload,
    wg: payload.wg?.slug || payload.wg || '',
    startsAt: localDateTime(payload.startsAt),
    endsAt: localDateTime(payload.endsAt),
  }
}

function announcementForm(payload = {}) {
  return {
    ...EMPTY_ANNOUNCEMENT,
    ...payload,
    ctaUrl: payload.ctaUrl || '',
    ctaLabel: payload.ctaLabel || '',
    ctaDeadlineAt: localDateTime(payload.ctaDeadlineAt),
  }
}

export function ContentWorkspace() {
  const query = useApi('/member/content')
  const { account } = useAccount()
  const [contentType, setContentType] = useState('event')
  const [payload, setPayload] = useState(EMPTY_EVENT)
  const [editingId, setEditingId] = useState(null)
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [fields, setFields] = useState({})

  const resetForm = (type = contentType) => {
    setContentType(type)
    setPayload(type === 'event' ? EMPTY_EVENT : EMPTY_ANNOUNCEMENT)
    setEditingId(null)
    setFields({})
  }

  const chooseType = (type) => {
    resetForm(type)
    setActionError(null)
  }

  const editPayload = (type, value, id = null) => {
    setContentType(type)
    setPayload(type === 'event' ? eventForm(value) : announcementForm(value))
    setEditingId(id)
    setFields({})
    setActionError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const set = (key, value) =>
    setPayload((current) => ({ ...current, [key]: value }))

  const save = async (event) => {
    event.preventDefault()
    setBusy('save')
    setActionError(null)
    setFields({})
    const body = {
      contentType,
      payload:
        contentType === 'event'
          ? {
              ...payload,
              startsAt: payload.startsAt
                ? new Date(payload.startsAt).toISOString()
                : '',
              endsAt: payload.endsAt
                ? new Date(payload.endsAt).toISOString()
                : '',
            }
          : {
              ...payload,
              ctaDeadlineAt: payload.ctaDeadlineAt
                ? new Date(payload.ctaDeadlineAt).toISOString()
                : '',
            },
    }
    try {
      if (editingId)
        await apiPatch(`/member/content/drafts/${editingId}`, {
          payload: body.payload,
        })
      else await apiPost('/member/content/drafts', body)
      resetForm(contentType)
      query.retry()
    } catch (error) {
      setActionError(error.message)
      setFields(error.fields || {})
    } finally {
      setBusy(null)
    }
  }

  const act = async (key, call) => {
    setBusy(key)
    setActionError(null)
    try {
      await call()
      query.retry()
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusy(null)
    }
  }

  const requestReview = (item) =>
    act(item.id, () => apiPost(`/member/content/drafts/${item.id}/submit`, {}))
  const review = (item, decision) => {
    const note =
      decision === 'approve'
        ? ''
        : window
            .prompt(
              decision === 'request_changes'
                ? 'What should the editor change?'
                : 'Why is this being rejected?',
            )
            ?.trim()
    if (decision !== 'approve' && !note) return
    act(item.id, () =>
      apiPost(`/member/content/drafts/${item.id}/review`, { decision, note }),
    )
  }
  const publish = (item) =>
    act(item.id, () => apiPost(`/member/content/drafts/${item.id}/publish`, {}))

  const title = editingId
    ? 'Edit draft'
    : payload.slug
      ? `Update ${contentType}`
      : `New ${contentType}`
  const orderedItems = useMemo(
    () =>
      [...(query.data?.items || [])].sort((a, b) =>
        String(b.updatedAt).localeCompare(String(a.updatedAt)),
      ),
    [query.data?.items],
  )

  return (
    <div>
      <PageHeader
        eyebrow="Content operations"
        title="Content studio"
        description="Prepare public Hub updates, send them for independent review, and publish an approved version."
      />

      <Async query={query} skeletons={5}>
        {(data) => (
          <>
            {actionError && <ErrorCard message={actionError} />}

            {data.permissions.canDraft && (
              <Section label={title}>
                <div className="pillRow" aria-label="Content type">
                  <FilterPill
                    active={contentType === 'event'}
                    icon={CalendarDays}
                    onClick={() => chooseType('event')}
                  >
                    Event
                  </FilterPill>
                  <FilterPill
                    active={contentType === 'announcement'}
                    icon={Megaphone}
                    onClick={() => chooseType('announcement')}
                  >
                    Announcement
                  </FilterPill>
                </div>

                <form className="card contentForm stackSm" onSubmit={save}>
                  <div className="formGrid">
                    <label>
                      Slug
                      <input
                        required
                        value={payload.slug}
                        onChange={(event) => set('slug', event.target.value)}
                        placeholder="finance-call-august"
                      />
                      <FieldError msg={fields.slug} />
                    </label>
                    <label>
                      Title
                      <input
                        required
                        value={payload.title}
                        onChange={(event) => set('title', event.target.value)}
                      />
                      <FieldError msg={fields.title} />
                    </label>
                  </div>

                  {contentType === 'event' ? (
                    <>
                      <div className="formGrid">
                        <SearchableSelect
                          label="Event type"
                          options={EVENT_TYPES.map((type) => ({
                            value: type,
                            label: TYPE_LABELS[type],
                          }))}
                          value={payload.type}
                          onChange={(type) => set('type', type)}
                          error={fields.type}
                          searchPlaceholder="Search event types…"
                        />
                        <SearchableSelect
                          label="Working group"
                          options={[
                            { value: '', label: 'Whole constituency' },
                            ...data.groups.map((group) => ({
                              value: group.slug,
                              label: group.name,
                            })),
                          ]}
                          value={payload.wg}
                          onChange={(wg) => set('wg', wg)}
                          error={fields.wg}
                          searchPlaceholder="Search working groups…"
                        />
                      </div>
                      <div className="formGrid">
                        <label>
                          Starts
                          <input
                            required
                            type="datetime-local"
                            value={payload.startsAt}
                            onChange={(event) =>
                              set('startsAt', event.target.value)
                            }
                          />
                          <FieldError msg={fields.startsAt} />
                        </label>
                        <label>
                          Ends
                          <input
                            required
                            type="datetime-local"
                            value={payload.endsAt}
                            onChange={(event) =>
                              set('endsAt', event.target.value)
                            }
                          />
                          <FieldError msg={fields.endsAt} />
                        </label>
                      </div>
                      <label>
                        Description
                        <textarea
                          rows="4"
                          value={payload.description}
                          onChange={(event) =>
                            set('description', event.target.value)
                          }
                        />
                        <FieldError msg={fields.description} />
                      </label>
                      <div className="formGrid">
                        <label>
                          Meeting link
                          <input
                            type="url"
                            value={payload.meetingUrl}
                            onChange={(event) =>
                              set('meetingUrl', event.target.value)
                            }
                            placeholder="https://…"
                          />
                          <FieldError msg={fields.meetingUrl} />
                        </label>
                        <label>
                          Recording link
                          <input
                            type="url"
                            value={payload.recordingUrl}
                            onChange={(event) =>
                              set('recordingUrl', event.target.value)
                            }
                            placeholder="https://…"
                          />
                          <FieldError msg={fields.recordingUrl} />
                        </label>
                      </div>
                    </>
                  ) : (
                    <>
                      <label>
                        Announcement
                        <textarea
                          required
                          rows="5"
                          value={payload.body}
                          onChange={(event) => set('body', event.target.value)}
                        />
                        <FieldError msg={fields.body} />
                      </label>
                      <label className="contentCheck">
                        <input
                          type="checkbox"
                          checked={payload.pinned}
                          onChange={(event) =>
                            set('pinned', event.target.checked)
                          }
                        />
                        Pin this announcement on the home feed
                      </label>
                      <div className="formGrid">
                        <label>
                          CTA link
                          <input
                            type="url"
                            value={payload.ctaUrl}
                            onChange={(event) =>
                              set('ctaUrl', event.target.value)
                            }
                            placeholder="https://forms.gle/…"
                          />
                          <FieldError msg={fields.ctaUrl} />
                        </label>
                        <label>
                          CTA label
                          <input
                            value={payload.ctaLabel}
                            onChange={(event) =>
                              set('ctaLabel', event.target.value)
                            }
                            placeholder="Submit inputs"
                          />
                          <FieldError msg={fields.ctaLabel} />
                        </label>
                      </div>
                      <label>
                        CTA deadline
                        <input
                          type="datetime-local"
                          value={payload.ctaDeadlineAt}
                          onChange={(event) =>
                            set('ctaDeadlineAt', event.target.value)
                          }
                        />
                        <FieldError msg={fields.ctaDeadlineAt} />
                      </label>
                    </>
                  )}

                  <div className="rowGap">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={busy === 'save'}
                    >
                      {busy === 'save' ? 'Saving…' : 'Save draft'}
                    </Button>
                    {(editingId || payload.slug) && (
                      <Button
                        variant="ghost"
                        onClick={() => resetForm(contentType)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </form>
              </Section>
            )}

            <Section label="Draft and review queue">
              {!orderedItems.length ? (
                <Empty
                  icon={FilePenLine}
                  title="No content drafts yet"
                  body="Start with an event or announcement above."
                />
              ) : (
                <div className="stackSm">
                  {orderedItems.map((item) => {
                    const own = item.createdBy === account?.id
                    const editable =
                      own &&
                      ['draft', 'changes_requested'].includes(item.status)
                    const reviewable =
                      data.permissions.canReview &&
                      !own &&
                      item.status === 'in_review'
                    const publishable =
                      data.permissions.canPublish &&
                      !own &&
                      item.status === 'approved'
                    return (
                      <article
                        key={item.id}
                        className="card cardTight contentQueueItem"
                      >
                        <div className="contentQueueCopy">
                          <div className="rowGap">
                            {item.contentType === 'event' ? (
                              <CalendarDays size={18} aria-hidden />
                            ) : (
                              <Megaphone size={18} aria-hidden />
                            )}
                            <strong>{item.payload.title}</strong>
                            <StatusChip status={item.status} />
                          </div>
                          <p className="meta">
                            {item.contentType} · {item.contentKey} · by{' '}
                            {own
                              ? 'you'
                              : item.creatorName ||
                                item.creatorEmail ||
                                'another editor'}
                          </p>
                          {item.reviewNote && (
                            <p className="contentReviewNote">
                              Review note: {item.reviewNote}
                            </p>
                          )}
                        </div>
                        <div className="rowGap contentQueueActions">
                          {editable && (
                            <Button
                              sm
                              variant="ghost"
                              onClick={() =>
                                editPayload(
                                  item.contentType,
                                  item.payload,
                                  item.id,
                                )
                              }
                            >
                              Edit
                            </Button>
                          )}
                          {editable && (
                            <Button
                              sm
                              variant="secondary"
                              disabled={busy === item.id}
                              onClick={() => requestReview(item)}
                            >
                              <Send size={15} aria-hidden />
                              Send for review
                            </Button>
                          )}
                          {reviewable && (
                            <Button
                              sm
                              variant="primary"
                              disabled={busy === item.id}
                              onClick={() => review(item, 'approve')}
                            >
                              <CheckCircle2 size={15} aria-hidden />
                              Approve
                            </Button>
                          )}
                          {reviewable && (
                            <Button
                              sm
                              variant="secondary"
                              disabled={busy === item.id}
                              onClick={() => review(item, 'request_changes')}
                            >
                              Request changes
                            </Button>
                          )}
                          {reviewable && (
                            <Button
                              sm
                              variant="ghost"
                              disabled={busy === item.id}
                              onClick={() => review(item, 'reject')}
                            >
                              Reject
                            </Button>
                          )}
                          {publishable && (
                            <Button
                              sm
                              variant="primary"
                              disabled={busy === item.id}
                              onClick={() => publish(item)}
                            >
                              <Upload size={15} aria-hidden />
                              Publish
                            </Button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </Section>

            {data.permissions.canDraft && (
              <Section label="Live content">
                <div className="grid2">
                  <div className="card cardTight">
                    <h3>Events</h3>
                    <div className="contentLiveList">
                      {data.live.events.map((event) => (
                        <button
                          key={event.slug}
                          type="button"
                          className="contentLiveItem"
                          onClick={() => editPayload('event', event)}
                        >
                          <span>{event.title}</span>
                          <small>{event.slug}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="card cardTight">
                    <h3>Announcements</h3>
                    <div className="contentLiveList">
                      {data.live.announcements.map((announcement) => (
                        <button
                          key={announcement.slug}
                          type="button"
                          className="contentLiveItem"
                          onClick={() =>
                            editPayload('announcement', announcement)
                          }
                        >
                          <span>{announcement.title}</span>
                          <small>{announcement.slug}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>
            )}
          </>
        )}
      </Async>
    </div>
  )
}
