import type { AnyValue, Doc } from '../lib/types'
import { useEffect, useState } from 'react'
import {
  TbCircleCheck as CheckCircle2,
  TbMail as Mail,
  TbAlertTriangle as TriangleAlert,
} from 'react-icons/tb'
import { apiGet, apiPatch, apiPost } from '../lib/api'
import { Button } from './ui'

const CATEGORIES = [
  {
    key: 'digest',
    label: 'Weekly digest',
    description: 'Published events and announcements in your scope.',
  },
  {
    key: 'deadline',
    label: 'Deadline reminders',
    description: 'Published announcement deadlines, grouped seven and two days ahead (UTC).',
  },
  {
    key: 'announcement',
    label: 'Hub announcements',
    description: 'Governed updates that the Hub team sends to your scope.',
  },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function EmailNotificationSettings() {
  const [state, setState] = useState<Doc>({ loading: true })
  const [form, setForm] = useState<AnyValue>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const data = await apiGet('/member/notifications/preferences')
      setState({ loading: false, ...data })
      setForm({
        timezone: data.timezone,
        digestDay: data.digestDay,
        digestHourUtc: data.digestHourUtc,
        email: data.email,
      })
    } catch (thrown) {
      setState({ loading: false })
      setError((thrown as AnyValue).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const requestVerification = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await apiPost('/member/notifications/verify-email/request')
      setMessage('Verification email sent. Open its link within 24 hours.')
    } catch (thrown) {
      setError((thrown as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await apiPatch('/member/notifications/preferences', form)
      setForm(result.preferences)
      setMessage('Email preferences saved.')
    } catch (thrown) {
      setError((thrown as AnyValue).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stackSm" aria-label="Email notification settings">
      <div className="notificationHeadingRow">
        <span className="iconTile" aria-hidden>
          <Mail size={20} />
        </span>
        <div className="notificationHeadingCopy">
          <h2>Email updates</h2>
          <p className="meta">
            Optional categories stay off until you verify your address and turn them on.
          </p>
        </div>
      </div>

      {message && (
        <p className="notificationNotice notificationNoticeOk" role="status">
          <CheckCircle2 size={16} aria-hidden />
          {message}
        </p>
      )}
      {error && (
        <p className="notificationNotice notificationNoticeWarn" role="alert">
          <TriangleAlert size={16} aria-hidden />
          {error}
        </p>
      )}

      {state.loading ? (
        <p className="meta" role="status">
          Loading email preferences…
        </p>
      ) : !(state as AnyValue).deliveryConfigured ? (
        <p className="metaMuted">Email delivery is not configured for this Hub deployment yet.</p>
      ) : !(state as AnyValue).emailVerified ? (
        <div className="stackSm">
          <p className="meta">Confirm your account address before enabling digests or alerts.</p>
          <Button onClick={requestVerification} disabled={busy}>
            Send verification email
          </Button>
        </div>
      ) : form ? (
        <div className="stackSm">
          {CATEGORIES.map((category) => (
            <label className="authCheck" key={category.key}>
              <input
                type="checkbox"
                checked={Boolean(form.email[category.key])}
                onChange={(event) =>
                  setForm((current: AnyValue) => ({
                    ...current,
                    email: {
                      ...current.email,
                      [category.key]: event.target.checked,
                    },
                  }))
                }
              />
              <span>
                <strong>{category.label}</strong>
                <small>{category.description}</small>
              </span>
            </label>
          ))}
          {form.email.digest && (
            <label className="field">
              <span>Digest day</span>
              <select
                className="input"
                value={form.digestDay}
                onChange={(event) =>
                  setForm((current: AnyValue) => ({
                    ...current,
                    digestDay: Number(event.target.value),
                  }))
                }
              >
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day} at 06:00 UTC
                  </option>
                ))}
              </select>
            </label>
          )}
          <p className="metaMuted">
            Optional email is capped at three messages in seven days. Deadline reminders and
            announcements are limited to one per day.
          </p>
          <Button onClick={save} disabled={busy}>
            Save email preferences
          </Button>
        </div>
      ) : null}
    </section>
  )
}
