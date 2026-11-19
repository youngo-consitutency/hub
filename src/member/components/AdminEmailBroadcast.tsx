import type { ChangeEvent } from 'react'
import type { BroadcastResult, EmailPreview } from '../../shared/contracts'
import { useContentOptionLabels } from '../lib/documents'
import { useState } from 'react'
import { TbMail as Mail, TbSend as Send } from 'react-icons/tb'
import { useWorkingGroups } from '../lib/workingGroups'
import { apiPost, errorMessage } from '../lib/api'
import { Button, ErrorCard } from './ui'

const TEAM_ROLES = ['membership_team', 'gys_policy_team', 'content_editor', 'content_publisher']

export function AdminEmailBroadcast() {
  const { teamLabels } = useContentOptionLabels()
  const wg = useWorkingGroups()
  const [form, setForm] = useState({
    title: '',
    message: '',
    actionPath: '',
    reason: '',
    scopeType: 'all_active',
    scopeValue: '',
  })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<BroadcastResult | null>(null)
  const [preview, setPreview] = useState<EmailPreview | null>(null)

  const change = ({
    target,
  }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [target.name]: target.value }))

  const payload = () => ({
    title: form.title,
    message: form.message,
    actionUrl: form.actionPath || null,
    reason: form.reason,
    scope: {
      type: form.scopeType,
      ids: form.scopeType === 'all_active' ? [] : [form.scopeValue],
    },
  })

  const run = async (mode: 'preview' | 'send') => {
    setBusy(mode)
    setError('')
    setResult(null)
    try {
      if (mode === 'preview') {
        setPreview(await apiPost<EmailPreview>('/member/admin/notifications/preview', payload()))
      } else {
        const response = await apiPost<BroadcastResult>(
          '/member/admin/notifications/send',
          payload(),
          { 'x-idempotency-key': globalThis.crypto?.randomUUID?.() || String(Date.now()) },
        )
        setPreview(null)
        setResult(response)
        setForm((current) => ({
          ...current,
          title: '',
          message: '',
          actionPath: '',
          reason: '',
        }))
      }
    } catch (thrown) {
      setError(errorMessage(thrown))
    } finally {
      setBusy('')
    }
  }

  const scopeReady = form.scopeType === 'all_active' || Boolean(form.scopeValue)
  const ready =
    form.title.trim() && form.message.trim() && form.reason.trim().length >= 8 && scopeReady

  return (
    <>
      <div className="stack">
        <div className="rowGap">
          <span className="iconTile" aria-hidden>
            <Mail size={20} />
          </span>
          <p className="meta">
            Only active, verified members who opted in to Hub announcements will receive this email.
          </p>
        </div>
        <div className="stack">
          <label className="field">
            <span>Recipient scope</span>
            <select
              className="input"
              name="scopeType"
              value={form.scopeType}
              onChange={(event) => {
                change(event)
                setForm((current) => ({ ...current, scopeValue: '' }))
              }}
            >
              <option value="all_active">All opted-in active members</option>
              <option value="working_group">One working group</option>
              <option value="team">One responsibility or permission</option>
            </select>
          </label>
          {form.scopeType === 'working_group' && (
            <label className="field">
              <span>Working group</span>
              <select className="input" name="scopeValue" value={form.scopeValue} onChange={change}>
                <option value="">Choose a working group</option>
                {wg.groups.map((group) => (
                  <option key={group.slug} value={group.slug}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.scopeType === 'team' && (
            <label className="field">
              <span>Responsibility or permission</span>
              <select className="input" name="scopeValue" value={form.scopeValue} onChange={change}>
                <option value="">Choose a team</option>
                {TEAM_ROLES.map((value) => [value, teamLabels[value] || value]).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
          <label className="field">
            <span>Subject</span>
            <input
              className="input"
              name="title"
              maxLength={160}
              value={form.title}
              onChange={change}
            />
          </label>
          <label className="field">
            <span>Optional Hub path</span>
            <input
              className="input"
              name="actionPath"
              placeholder="/calendar"
              value={form.actionPath}
              onChange={change}
            />
          </label>
        </div>
        <label className="field">
          <span>Message</span>
          <textarea
            className="input textarea"
            name="message"
            rows={5}
            maxLength={4000}
            value={form.message}
            onChange={change}
          />
        </label>
        <label className="field">
          <span>Reason for sending</span>
          <textarea
            className="input textarea"
            name="reason"
            rows={2}
            maxLength={500}
            value={form.reason}
            onChange={change}
          />
          <small className="metaMuted">
            At least 8 characters; stored in the governance audit. The message body is not copied
            there.
          </small>
        </label>
        {error && <ErrorCard message={error} />}
        {preview && (
          <div className="card cardTight stackSm">
            <strong>{preview.subject}</strong>
            <p className="meta">{preview.text}</p>
          </div>
        )}
        {result && (
          <p className="notificationNotice notificationNoticeOk" role="status">
            Queued {result.queued} of {result.eligible} eligible recipients.
          </p>
        )}
        <div className="rowGap">
          <Button
            variant="secondary"
            disabled={!ready || Boolean(busy)}
            onClick={() => run('preview')}
          >
            Preview
          </Button>
          <Button variant="primary" disabled={!ready || Boolean(busy)} onClick={() => run('send')}>
            <Send size={17} aria-hidden />
            Queue announcement
          </Button>
        </div>
      </div>
    </>
  )
}
