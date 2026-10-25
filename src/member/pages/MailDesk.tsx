'use client'

import type { AnyValue, Doc } from '../lib/types'
import { useEffect, useRef, useState } from 'react'
import {
  TbCircleCheck as CheckCircle2,
  TbEye as Eye,
  TbMailForward as MailForward,
  TbSend as Send,
  TbTrash as Trash,
  TbUsers as Users,
  TbX as X,
} from 'react-icons/tb'
import { apiGet, apiPatch, apiPost, useApi } from '../lib/api'
import { useWorkingGroups } from '../lib/workingGroups'
import { formatDateTime } from '../lib/time'
import { Async, Button, Empty, ErrorCard, PageHeader, Section } from '../components/ui'
import { FieldError, SearchableSelect } from '../components/FormControls'
import { HtmlEmailEditor } from '../components/HtmlEmailEditor'
import { SidePanel } from '../components/SidePanel'

const EMPTY = { title: '', message: '<p></p>', actionUrl: '' }
const MAX_PEOPLE = 20

type Audience = 'working_group' | 'constituency' | 'individual'
type Person = { id: number; name: string }

export function MailDesk() {
  const query = useApi('/member/mail/drafts')
  return (
    <div>
      <PageHeader
        icon={MailForward}
        title="Mail Desk"
        description="Write to the groups your mandate reaches. Nothing sends until you queue it."
      />
      <Async query={query} skeletons={3}>
        {(data: Doc) =>
          data.reach?.canDraft ? (
            <Desk reach={data.reach} drafts={data.drafts} reload={query.retry} />
          ) : (
            <Empty
              icon={MailForward}
              title="Mail Desk is not available for this account"
              body="It opens for working-group contact points, focal points and operational-team liaisons."
            />
          )
        }
      </Async>
    </div>
  )
}

function Desk({ reach, drafts, reload }: { reach: Doc; drafts: Doc[]; reload: () => void }) {
  const { label, groups } = useWorkingGroups()
  const [form, setForm] = useState(EMPTY)
  const [audience, setAudience] = useState<Audience>(
    reach.wgSlugs.length ? 'working_group' : 'constituency',
  )
  const [wgSlug, setWgSlug] = useState<string>(reach.wgSlugs[0] || '')
  const [people, setPeople] = useState<Person[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [fields, setFields] = useState<Doc>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  // every edit bumps the version; preview and count answers for an older
  // version are dropped instead of describing an email that changed since
  const [version, setVersion] = useState(0)
  const [count, setCount] = useState<{ version: number; count: number } | null>(null)
  const [preview, setPreview] = useState<{ version: number; html: string } | null>(null)
  const latest = useRef(version)
  useEffect(() => {
    latest.current = version
  }, [version])

  const touch = () => {
    setVersion((v) => v + 1)
    setSaved(null)
  }
  const setField = (key: keyof typeof EMPTY, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    touch()
  }
  const scope = {
    type: audience,
    wgSlug: audience === 'working_group' ? wgSlug : null,
    accountIds: audience === 'individual' ? people.map((p) => p.id) : [],
  }
  const groupOptions = (reach.everyone ? groups.map((g: Doc) => g.slug) : reach.wgSlugs).map(
    (slug: string) => ({ value: slug, label: label(slug) }),
  )

  const run = async (name: string, task: () => Promise<void>) => {
    setBusy(name)
    setError(null)
    setFields({})
    try {
      await task()
    } catch (e) {
      setFields((e as AnyValue).fields || {})
      setError((e as AnyValue).fields ? null : (e as AnyValue).message)
    } finally {
      setBusy(null)
    }
  }

  const countRecipients = () =>
    run('count', async () => {
      const asked = version
      const res = await apiPost('/member/mail/preview', { scope })
      if (asked === latest.current) setCount({ version: asked, count: res.count })
    })
  const showPreview = () =>
    run('preview', async () => {
      const asked = version
      const res = await apiPost('/member/mail/render', form)
      if (asked === latest.current) setPreview({ version: asked, html: res.html })
    })
  const save = () =>
    run('save', async () => {
      const body = { ...form, scope }
      if (editing) await apiPatch(`/member/mail/drafts/${editing}`, body)
      else {
        const res = await apiPost('/member/mail/drafts', body)
        setEditing(res.draft.id)
      }
      setSaved('Draft saved.')
      reload()
    })
  const reset = () => {
    setForm(EMPTY)
    setPeople([])
    setEditing(null)
    touch()
  }
  const edit = (draft: Doc) => {
    setForm({ title: draft.title, message: draft.message, actionUrl: draft.actionUrl || '' })
    setAudience(draft.scope.type)
    setWgSlug(draft.scope.wgSlug || reach.wgSlugs[0] || '')
    setPeople(draft.scope.recipients || [])
    setEditing(draft.id)
    touch()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const currentCount = count?.version === version ? count.count : null

  return (
    <div className="mailDesk">
      <section className="card mailComposer" aria-label="Compose">
        <div className="mailReach">
          <span className="meta">This account can write to</span>
          <div className="rowGap">
            {reach.everyone && <span className="chip chip-accent">Whole constituency</span>}
            {reach.wgSlugs.map((slug: string) => (
              <span key={slug} className="chip chip-neutral">
                {label(slug)}
              </span>
            ))}
          </div>
        </div>

        <fieldset className="mailAudience">
          <legend className="meta">Send to</legend>
          <div className="rowGap" role="radiogroup">
            {(
              [
                ['working_group', 'A working group'],
                ...(reach.everyone ? [['constituency', 'Whole constituency']] : []),
                ['individual', 'Chosen people'],
              ] as [Audience, string][]
            ).map(([value, text]) => (
              <Button
                key={value}
                sm
                role="radio"
                aria-checked={audience === value}
                variant={audience === value ? 'secondary' : 'ghost'}
                onClick={() => {
                  setAudience(value)
                  touch()
                }}
              >
                {text}
              </Button>
            ))}
          </div>
          {audience === 'working_group' && (
            <SearchableSelect
              label="Working group"
              options={groupOptions}
              value={wgSlug}
              onChange={(value: string) => {
                setWgSlug(value)
                touch()
              }}
              error={fields.wgSlug}
            />
          )}
          {audience === 'constituency' && (
            <p className="metaMuted">
              Goes to members who turned on Hub announcements in their email settings.
            </p>
          )}
          {audience === 'individual' && (
            <PeoplePicker
              people={people}
              onChange={(next) => {
                setPeople(next)
                touch()
              }}
            />
          )}
          <FieldError msg={fields.recipients || fields.scope} />
        </fieldset>

        <label className="field">
          <span>Subject</span>
          <input
            className="input"
            maxLength={160}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
          />
          <FieldError msg={fields.title} />
        </label>
        <div className="field">
          <span>Message</span>
          <HtmlEmailEditor value={form.message} onChange={(html) => setField('message', html)} />
          <FieldError msg={fields.message} />
        </div>
        <label className="field">
          <span>Button link (optional)</span>
          <input
            className="input"
            placeholder="https://"
            maxLength={500}
            value={form.actionUrl}
            onChange={(e) => setField('actionUrl', e.target.value)}
          />
          <FieldError msg={fields.actionUrl} />
        </label>

        {error && <ErrorCard message={error} />}
        {saved && (
          <p className="notificationNotice notificationNoticeOk" role="status">
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden /> {saved}
          </p>
        )}
        <div className="mailActions">
          <div className="rowGap">
            <Button sm variant="ghost" disabled={!!busy} onClick={showPreview}>
              <Eye size={16} strokeWidth={1.75} aria-hidden />
              Preview
            </Button>
            <Button sm variant="ghost" disabled={!!busy} onClick={countRecipients}>
              <Users size={16} strokeWidth={1.75} aria-hidden />
              {currentCount === null ? 'Count recipients' : `${currentCount} will receive this`}
            </Button>
          </div>
          <div className="rowGap">
            {editing && (
              <Button sm variant="ghost" onClick={reset}>
                New draft
              </Button>
            )}
            <Button sm variant="primary" disabled={!!busy} onClick={save}>
              {busy === 'save' ? 'Saving…' : editing ? 'Update draft' : 'Save draft'}
            </Button>
          </div>
        </div>
      </section>

      <Section label="Drafts">
        {drafts.length === 0 ? (
          <Empty
            icon={MailForward}
            title="No drafts yet"
            body="Saved drafts appear here. Queue one when it is ready to send."
          />
        ) : (
          <ul className="mailDrafts">
            {drafts.map((draft) => (
              <DraftRow key={draft.id} draft={draft} label={label} onEdit={edit} reload={reload} />
            ))}
          </ul>
        )}
      </Section>

      {preview && preview.version === version && (
        <SidePanel title="Email preview" onClose={() => setPreview(null)}>
          <iframe className="mailPreview" title="Email preview" sandbox="" srcDoc={preview.html} />
        </SidePanel>
      )}
    </div>
  )
}

function PeoplePicker({ people, onChange }: { people: Person[]; onChange: (p: Person[]) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ q: string; people: Person[] }>({ q: '', people: [] })

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    const timer = setTimeout(() => {
      apiGet(`/member/mail/people?q=${encodeURIComponent(term)}`)
        .then((res: Doc) => setResults({ q: term, people: res.people }))
        .catch(() => setResults({ q: term, people: [] }))
    }, 250)
    return () => clearTimeout(timer)
  }, [q])

  const shown =
    results.q === q.trim() ? results.people.filter((p) => !people.some((x) => x.id === p.id)) : []

  return (
    <div className="mailPeople">
      {people.length > 0 && (
        <ul className="mailChips">
          {people.map((person) => (
            <li key={person.id} className="chip chip-neutral">
              {person.name}
              <button
                type="button"
                aria-label={`Remove ${person.name}`}
                onClick={() => onChange(people.filter((p) => p.id !== person.id))}
              >
                <X size={14} strokeWidth={2} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="field">
        <span>Find people by name</span>
        <input
          className="input"
          value={q}
          disabled={people.length >= MAX_PEOPLE}
          placeholder={people.length >= MAX_PEOPLE ? `Up to ${MAX_PEOPLE} people` : 'Type a name'}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      {shown.length > 0 && (
        <ul className="mailResults">
          {shown.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => {
                  onChange([...people, person].slice(0, MAX_PEOPLE))
                  setQ('')
                }}
              >
                {person.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DraftRow({
  draft,
  label,
  onEdit,
  reload,
}: {
  draft: Doc
  label: (slug: string) => string
  onEdit: (draft: Doc) => void
  reload: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audience =
    draft.scope.type === 'constituency'
      ? 'Whole constituency'
      : draft.scope.type === 'working_group'
        ? label(draft.scope.wgSlug)
        : `${draft.scope.recipients.length} chosen ${draft.scope.recipients.length === 1 ? 'person' : 'people'}`

  const act = async (path: string) => {
    setBusy(true)
    setError(null)
    try {
      await apiPost(`/member/mail/drafts/${draft.id}/${path}`, {})
      reload()
    } catch (e) {
      setError((e as AnyValue).message)
      setBusy(false)
    }
  }

  return (
    <li className="card mailDraft">
      <div className="mailDraftHead">
        <strong>{draft.title}</strong>
        <span className={`chip ${draft.status === 'queued' ? 'chip-accent' : 'chip-neutral'}`}>
          {draft.status === 'queued' ? `Queued for ${draft.recipientCount}` : 'Draft'}
        </span>
      </div>
      <p className="metaMuted">
        {audience} · {formatDateTime(draft.queuedAt || draft.updatedAt)}
      </p>
      {error && <ErrorCard message={error} />}
      {draft.status === 'draft' && (
        <div className="rowGap">
          {confirming ? (
            <>
              <Button sm variant="primary" disabled={busy} onClick={() => act('queue')}>
                <Send size={16} strokeWidth={1.75} aria-hidden />
                {busy ? 'Queuing…' : 'Queue and send'}
              </Button>
              <Button sm variant="ghost" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </>
          ) : (
            <>
              <Button sm variant="secondary" onClick={() => onEdit(draft)}>
                Edit
              </Button>
              <Button sm variant="ghost" onClick={() => setConfirming(true)}>
                <Send size={16} strokeWidth={1.75} aria-hidden />
                Queue
              </Button>
              <Button
                sm
                variant="ghost"
                aria-label="Discard draft"
                disabled={busy}
                onClick={() => act('discard')}
              >
                <Trash size={16} strokeWidth={1.75} aria-hidden />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  )
}
