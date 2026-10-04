import type { AnyValue } from '../lib/types'
import { useEffect, useMemo, useState } from 'react'
import {
  TbBellRinging as BellRing,
  TbCircleCheck as CheckCircle2,
  TbAlertTriangle as TriangleAlert,
} from 'react-icons/tb'
import { apiGet, apiPost } from '../lib/api'
import { SearchableSelect } from './FormControls'
import { Button, ErrorCard } from './ui'

const TITLE_MAX = 80
const BODY_MAX = 180
const ALL_CONFIRM = 'SEND'

export function PushBroadcast() {
  const [summary, setSummary] = useState<AnyValue>(null)
  const [subscribers, setSubscribers] = useState<AnyValue[]>([])
  const [audience, setAudience] = useState('one')
  const [accountId, setAccountId] = useState('')
  const [title, setTitle] = useState('YOUNGO Hub')
  const [body, setBody] = useState('')
  const [confirmAll, setConfirmAll] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnyValue>(null)

  const load = async () => {
    try {
      const [nextSummary, nextSubscribers] = await Promise.all([
        apiGet('/push/admin/summary'),
        apiGet('/push/admin/subscribers'),
      ])
      setSummary(nextSummary)
      setSubscribers(nextSubscribers.items || [])
      setError('')
    } catch (thrown) {
      setError((thrown as AnyValue).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const options = useMemo(
    () =>
      subscribers.map((row) => ({
        value: row.id,
        label: `${row.name} (${row.email}) · ${row.devices} device${row.devices === 1 ? '' : 's'}`,
      })),
    [subscribers],
  )

  const selected = subscribers.find((row) => row.id === accountId)
  const allReady = audience === 'all' && confirmAll.trim().toUpperCase() === ALL_CONFIRM
  const oneReady = audience === 'one' && Boolean(accountId)
  const copyReady = title.trim() && body.trim()
  const canSend =
    summary?.configured && copyReady && (audience === 'all' ? allReady : oneReady) && !busy

  const send = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const payload = await apiPost('/push/send', {
        userIds: audience === 'all' ? 'all' : [accountId],
        title: title.trim(),
        body: body.trim(),
        data: { url: '/' },
      })
      setResult(payload)
      setConfirmAll('')
      await load()
    } catch (thrown) {
      setError((thrown as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  if (summary && !summary.configured)
    return <p className="meta">Device alerts are not enabled on this Hub. No alerts can be sent.</p>
  return (
    <div className="stack">
      {summary && (
        <p className="meta">
          {summary.accounts} members · {summary.devices} devices
        </p>
      )}
      <div className="pushBroadcast">
        <p className="meta">
          Send a banner to members who turned alerts on for a phone or laptop. This does not email
          anyone.
        </p>

        {summary && !summary.configured && (
          <p className="metaMuted">Device alerts are not configured on this deployment yet.</p>
        )}

        {error && <ErrorCard message={error} />}
        {result && (
          <p className="notificationNotice notificationNoticeOk" role="status">
            <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden />
            Queued for {result.targeted ?? result.total} member
            {result.targeted === 1 ? '' : 's'} — delivery runs in the background and retries
            automatically.
          </p>
        )}

        <div className="rowGap">
          <Button
            sm
            variant={audience === 'one' ? 'secondary' : 'ghost'}
            aria-pressed={audience === 'one'}
            onClick={() => setAudience('one')}
          >
            One member
          </Button>
          <Button
            sm
            variant={audience === 'all' ? 'secondary' : 'ghost'}
            aria-pressed={audience === 'all'}
            onClick={() => setAudience('all')}
          >
            Everyone with alerts on
          </Button>
        </div>

        {audience === 'one' ? (
          options.length ? (
            <SearchableSelect
              label="Member with a subscribed device"
              options={options}
              value={accountId}
              onChange={setAccountId}
              placeholder="Choose a member"
              searchPlaceholder="Search name or email…"
            />
          ) : (
            <p className="metaMuted">Nobody has turned device alerts on yet.</p>
          )
        ) : (
          <label className="field">
            <span>
              Type {ALL_CONFIRM} to reach every subscribed device
              {summary ? ` (${summary.devices})` : ''}
            </span>
            <input
              className="input"
              value={confirmAll}
              onChange={(event) => setConfirmAll(event.target.value)}
              placeholder={ALL_CONFIRM}
              autoComplete="off"
            />
            <small className="metaMuted">
              Use one member for a test. Everyone is for a real constituency notice.
            </small>
          </label>
        )}

        <label className="field">
          <span>Title</span>
          <input
            className="input"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Message</span>
          <textarea
            className="input textarea"
            rows={3}
            maxLength={BODY_MAX}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Room change, call starting, or a pinned announcement."
          />
          <small className="metaMuted">
            {body.length}/{BODY_MAX} · keep this short; phone banners truncate.
          </small>
        </label>

        <div className="pushBroadcastPreview" aria-label="Notification preview">
          <span className="iconTile" aria-hidden>
            <BellRing size={18} strokeWidth={1.75} />
          </span>
          <div>
            <strong>{title.trim() || 'YOUNGO Hub'}</strong>
            <p className="meta">{body.trim() || 'The message members will see on the device.'}</p>
            {audience === 'one' && selected && (
              <p className="metaMuted">
                {selected.name} · {selected.devices} device
                {selected.devices === 1 ? '' : 's'}
              </p>
            )}
            {audience === 'all' && summary && (
              <p className="metaMuted">
                <TriangleAlert size={14} strokeWidth={1.75} aria-hidden /> {summary.devices} device
                {summary.devices === 1 ? '' : 's'} across {summary.accounts} member
                {summary.accounts === 1 ? '' : 's'}
              </p>
            )}
          </div>
        </div>

        <div className="adminAccountFooter">
          <Button variant="primary" disabled={!canSend} onClick={send}>
            <BellRing size={16} strokeWidth={1.75} aria-hidden />
            {busy ? 'Sending…' : 'Send device alert'}
          </Button>
        </div>
      </div>
    </div>
  )
}
