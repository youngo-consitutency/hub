'use client'

import type { AnyValue, Doc } from '../lib/types'
import { useState } from 'react'
import {
  TbBell as Bell,
  TbCircleCheck as CheckCircle2,
  TbDeviceMobile as Device,
  TbMail as Mail,
  TbSpeakerphone as Megaphone,
  TbUserPlus as UserPlus,
  TbUsers as Users,
  TbX as X,
} from 'react-icons/tb'
import { apiDelete, apiPost, useApi } from '../lib/api'
import { formatDateTime } from '../lib/time'
import { Async, Button, Empty, ErrorCard, Section } from './ui'
import { FieldError } from './FormControls'

const CHANNELS = [
  { value: 'hub', label: 'Hub notice', hint: 'Shown on this page', Icon: Bell },
  { value: 'email', label: 'Email', hint: 'Participants with group mail on', Icon: Mail },
  {
    value: 'push',
    label: 'Device alert',
    hint: 'Phones and browsers with alerts on',
    Icon: Device,
  },
]

/**
 * Live operations for a COY with liveOps on: the notice feed for allowlisted
 * participants, and the allowlist and announcement tools for organisers.
 */
export function CoyLive({ slug }: { slug: string }) {
  const notices = useApi(`/member/coy/${slug}/notices`, [slug])
  return (
    <Async query={notices} skeletons={2}>
      {(data: Doc) => (
        <>
          <Section label="Live notices">
            {!data.allowlisted ? (
              <Empty
                icon={Bell}
                title="Notices are for registered participants"
                body="Organisers add participants by the email on their Hub account. Once you are on the list, programme updates appear here."
              />
            ) : data.items.length === 0 ? (
              <Empty
                icon={Bell}
                title="No notices yet"
                body="Programme updates will appear here."
              />
            ) : (
              <ol className="coyNotices">
                {data.items.map((notice: Doc) => (
                  <li key={notice.id} className="card coyNotice">
                    <div className="coyNoticeHead">
                      <h3>{notice.title}</h3>
                      <time className="metaMuted" dateTime={notice.createdAt}>
                        {formatDateTime(notice.createdAt)}
                      </time>
                    </div>
                    {String(notice.body)
                      .split('\n')
                      .filter(Boolean)
                      .map((line: string, i: number) => (
                        <p key={i}>{line}</p>
                      ))}
                  </li>
                ))}
              </ol>
            )}
          </Section>
          {data.organiser && <CoyOrganiserTools slug={slug} onAnnounced={notices.retry} />}
        </>
      )}
    </Async>
  )
}

function CoyOrganiserTools({ slug, onAnnounced }: { slug: string; onAnnounced: () => void }) {
  const [tab, setTab] = useState<'participants' | 'announce'>('participants')
  const participants = useApi(`/member/coy/${slug}/participants`, [slug])
  return (
    <Section label="Organiser tools">
      <div className="card coyTools">
        <div className="rowGap" role="tablist" aria-label="Organiser tools">
          {[
            { value: 'participants', label: 'Participants', Icon: Users },
            { value: 'announce', label: 'Announce', Icon: Megaphone },
          ].map(({ value, label, Icon }) => (
            <Button
              key={value}
              sm
              role="tab"
              aria-selected={tab === value}
              variant={tab === value ? 'secondary' : 'ghost'}
              onClick={() => setTab(value as AnyValue)}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden />
              {label}
            </Button>
          ))}
        </div>
        <Async query={participants} skeletons={2}>
          {(data: Doc) =>
            tab === 'participants' ? (
              <Participants slug={slug} data={data} onChange={participants.retry} />
            ) : (
              <Announce
                slug={slug}
                summary={data.summary}
                onSent={() => {
                  onAnnounced()
                  participants.retry()
                }}
              />
            )
          }
        </Async>
      </div>
    </Section>
  )
}

function Summary({ summary }: { summary: Doc }) {
  return (
    <div className="metricGrid coyMetrics">
      <div className="metricCard">
        <Users size={18} aria-hidden />
        <strong>{summary.participants}</strong>
        <span>participants</span>
      </div>
      <div className="metricCard">
        <Mail size={18} aria-hidden />
        <strong>{summary.emailEligible}</strong>
        <span>reachable by email</span>
      </div>
      <div className="metricCard">
        <Device size={18} aria-hidden />
        <strong>{summary.pushDevices}</strong>
        <span>devices with alerts</span>
      </div>
    </div>
  )
}

function Participants({ slug, data, onChange }: { slug: string; data: Doc; onChange: () => void }) {
  const [emails, setEmails] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Doc | null>(null)

  const add = async () => {
    setBusy(true)
    setError(null)
    try {
      setResult(await apiPost(`/member/coy/${slug}/participants`, { emails, note }))
      setEmails('')
      onChange()
    } catch (e) {
      setError((e as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (accountId: string) => {
    setError(null)
    try {
      await apiDelete(`/member/coy/${slug}/participants/${accountId}`)
      onChange()
    } catch (e) {
      setError((e as AnyValue).message)
    }
  }

  return (
    <div className="stack">
      <Summary summary={data.summary} />
      <label className="field">
        <span>Add participants by Hub email</span>
        <textarea
          className="input textarea"
          rows={4}
          placeholder="One address per line, or separated by commas"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Note (optional)</span>
        <input
          className="input"
          maxLength={240}
          placeholder="e.g. Delegation, volunteers"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <div className="rowGap">
        <Button variant="primary" sm disabled={busy || !emails.trim()} onClick={add}>
          <UserPlus size={16} strokeWidth={1.75} aria-hidden />
          {busy ? 'Adding…' : 'Add to allowlist'}
        </Button>
      </div>
      {error && <ErrorCard message={error} />}
      {result && (
        <div className="coyAddResult" role="status">
          <p>
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden /> Added {result.added}
            {result.already ? ` · ${result.already} already listed` : ''}
          </p>
          {result.missing.length > 0 && (
            <p className="metaMuted">No Hub account: {result.missing.join(', ')}</p>
          )}
          {result.inactive.length > 0 && (
            <p className="metaMuted">Membership not active: {result.inactive.join(', ')}</p>
          )}
        </div>
      )}
      {data.items.length === 0 ? (
        <Empty
          icon={Users}
          title="The allowlist is empty"
          body="Announcements stay blocked until at least one participant is listed."
        />
      ) : (
        <ul className="coyParticipants">
          {data.items.map((p: Doc) => (
            <li key={p.accountId} className="coyParticipant">
              <div>
                <strong>{p.name || p.email}</strong>
                <span className="metaMuted">
                  {p.email}
                  {p.note ? ` · ${p.note}` : ''}
                </span>
              </div>
              <Button
                variant="ghost"
                sm
                aria-label={`Remove ${p.name || p.email}`}
                onClick={() => remove(p.accountId)}
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Announce({ slug, summary, onSent }: { slug: string; summary: Doc; onSent: () => void }) {
  const [form, setForm] = useState({ title: '', message: '', reason: '', confirm: '' })
  const [channels, setChannels] = useState<string[]>(['hub'])
  const [campaign, setCampaign] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Doc>({})
  const [sent, setSent] = useState<Doc | null>(null)
  const set = (key: keyof typeof form) => (e: AnyValue) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggle = (value: string) =>
    setChannels((c) => (c.includes(value) ? c.filter((v) => v !== value) : [...c, value]))
  const ready =
    form.title.trim() &&
    form.message.trim() &&
    form.reason.trim() &&
    channels.length > 0 &&
    summary.participants > 0 &&
    form.confirm.trim().toUpperCase() === 'COY'

  const send = async () => {
    setBusy(true)
    setError(null)
    setFields({})
    try {
      const { confirm: _confirm, ...body } = form
      const res = await apiPost(
        `/member/coy/${slug}/announce`,
        { ...body, channels },
        { 'x-idempotency-key': campaign },
      )
      setSent(res)
      setForm({ title: '', message: '', reason: '', confirm: '' })
      setCampaign(crypto.randomUUID())
      onSent()
    } catch (e) {
      setFields((e as AnyValue).fields || {})
      setError((e as AnyValue).fields ? null : (e as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <Summary summary={summary} />
      <fieldset className="coyChannels">
        <legend className="meta">Send through</legend>
        {CHANNELS.map(({ value, label, hint, Icon }) => (
          <label key={value} className={`authChoice ${channels.includes(value) ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={channels.includes(value)}
              onChange={() => toggle(value)}
            />
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            <strong>{label}</strong>
            <span className="meta">{hint}</span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>Title</span>
        <input className="input" maxLength={160} value={form.title} onChange={set('title')} />
        <FieldError msg={fields.title} />
      </label>
      <label className="field">
        <span>Message</span>
        <textarea
          className="input textarea"
          rows={5}
          maxLength={4000}
          value={form.message}
          onChange={set('message')}
        />
        <FieldError msg={fields.message} />
      </label>
      <label className="field">
        <span>Why this goes out (audit log only)</span>
        <input className="input" maxLength={500} value={form.reason} onChange={set('reason')} />
        <FieldError msg={fields.reason} />
      </label>
      <label className="field">
        <span>Type COY to confirm</span>
        <input
          className="input coyConfirm"
          autoComplete="off"
          value={form.confirm}
          onChange={set('confirm')}
        />
      </label>
      {error && <ErrorCard message={error} />}
      <div className="rowGap">
        <Button variant="primary" glow sm disabled={busy || !ready} onClick={send}>
          <Megaphone size={16} strokeWidth={1.75} aria-hidden />
          {busy ? 'Sending…' : `Send to ${summary.participants} participants`}
        </Button>
      </div>
      {sent && (
        <p className="notificationNotice notificationNoticeOk" role="status">
          <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
          Sent{sent.notice ? ' · notice posted' : ''} · {sent.email.queued} emails queued ·{' '}
          {sent.push.queued} device alerts queued
        </p>
      )}
    </div>
  )
}
