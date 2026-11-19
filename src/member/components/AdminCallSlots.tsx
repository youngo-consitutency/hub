import type { FormEvent } from 'react'
import type { AdminCpCallSlotsResponse } from '../../shared/contracts'
import { useState } from 'react'
import { useApi, apiPost, errorMessage } from '../lib/api'
import { Button, ErrorCard, Section } from './ui'
import { fmtDual } from '../lib/time'

function toLocalInput(iso: string) {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string) {
  if (!value) return null
  return new Date(value).toISOString()
}

export function AdminCallSlots() {
  const query = useApi<AdminCpCallSlotsResponse>('/member/admin/cp-calls/mine')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onStart = (value: string) => {
    setStartsAt(value)
    if (!endsAt && value) {
      const end = new Date(value)
      end.setMinutes(end.getMinutes() + 45)
      setEndsAt(toLocalInput(end.toISOString()))
    }
  }

  const add = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      // the server takes a start and a duration, not an end time
      const minutes = Math.round(
        (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
      )
      await apiPost('/member/admin/cp-calls', {
        startsAt: fromLocalInput(startsAt),
        durationMinutes: minutes,
      })
      setStartsAt('')
      setEndsAt('')
      query.retry()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (id: number) => {
    setBusy(true)
    setError('')
    try {
      await apiPost(`/member/admin/cp-calls/${id}/cancel`, {})
      query.retry()
    } catch (err) {
      setError(errorMessage(err))
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
      {(error || query.error) && (
        <ErrorCard
          message={error || query.error || undefined}
          onRetry={() => {
            setError('')
            query.retry()
          }}
        />
      )}
      <form className="authForm" onSubmit={add}>
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
        {slots.map((slot) => (
          <div key={slot.id} className="card cardTight auditRow">
            <div>
              <strong>
                {slot.host?.name || 'You'} · {fmtDual(slot.startsAt)}
              </strong>
              <p className="meta">
                {slot.bookedBy
                  ? `Booked by ${slot.bookedBy.name || slot.bookedBy.email || 'a CP'}`
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
