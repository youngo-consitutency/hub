import type { AnyValue, Doc } from '../lib/types'
import { useState } from 'react'
import { useApi, apiPost } from '../lib/api'
import { Button, ErrorCard, Section } from './ui'
import { fmtDual } from '../lib/time'

function toLocalInput(iso: AnyValue) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: AnyValue) {
  if (!value) return null
  return new Date(value).toISOString()
}

export function AdminCallSlots() {
  const query = useApi('/member/admin/cp-calls/mine')
  const [hostLabel, setHostLabel] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onStart = (value: AnyValue) => {
    setStartsAt(value)
    if (!endsAt && value) {
      const end = new Date(value)
      end.setMinutes(end.getMinutes() + 45)
      setEndsAt(toLocalInput(end.toISOString()))
    }
  }

  const add = async (event: AnyValue) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiPost('/member/admin/cp-calls', {
        hostLabel: hostLabel || undefined,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
      })
      setStartsAt('')
      setEndsAt('')
      query.retry()
    } catch (err) {
      setError((err as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: AnyValue) => {
    setBusy(true)
    setError('')
    try {
      await apiPost(`/member/admin/cp-calls/${id}/cancel`, {})
      query.retry()
    } catch (err) {
      setError((err as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  const slots = query.data?.slots || []

  return (
    <Section label="WG section calls">
      <p className="meta">
        Publish times Contact Points can book on the Hub. Your name shows on the slot. 45 minutes is
        the default.
      </p>
      {error && <ErrorCard message={error} onRetry={() => setError('')} />}
      <form className="authForm" onSubmit={add}>
        <label className="field">
          <span>Shown as</span>
          <input
            className="input"
            value={hostLabel}
            onChange={(event) => setHostLabel(event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label className="field">
          <span>Starts</span>
          <input
            className="input"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => onStart(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Ends</span>
          <input
            className="input"
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            required
          />
        </label>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Add slot'}
        </Button>
      </form>
      <div className="stackSm" style={{ marginTop: 16 }}>
        {slots.map((slot: Doc) => (
          <div key={slot.id} className="card cardTight auditRow">
            <div>
              <strong>
                {slot.hostLabel} · {fmtDual(slot.startsAt)}
              </strong>
              <p className="meta">
                {slot.status === 'booked'
                  ? `Booked by ${slot.bookedName || slot.bookedEmail || 'a CP'}${slot.wgSlug ? ` · ${slot.wgSlug}` : ''}`
                  : 'Open'}
              </p>
            </div>
            <Button sm variant="ghost" onClick={() => cancel(slot.id)}>
              Remove
            </Button>
          </div>
        ))}
        {!slots.length && !query.loading && (
          <p className="metaMuted">No slots yet. Add the times you can do.</p>
        )}
      </div>
    </Section>
  )
}
