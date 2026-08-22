import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { usePath } from '../lib/router.js'
import { Button } from './ui.jsx'
import { MessageSquarePlus, X, Check } from 'lucide-react'

const FALLBACK_KINDS = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'ui_ux', label: 'Design or usability' },
  { value: 'feature', label: 'Feature idea' },
  { value: 'blocker', label: 'I am blocked' },
  { value: 'content', label: 'Wrong or missing content' },
  { value: 'other', label: 'Something else' },
]

const FALLBACK_SEVERITIES = [
  { value: 'low', label: 'Minor' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Serious' },
  { value: 'critical', label: 'Cannot use the Hub' },
]

const EMPTY = { kind: 'bug', severity: 'normal', title: '', body: '' }

function FeedbackForm({ pagePath, kinds, severities, onDone }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [sending, setSending] = useState(false)

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      await apiPost('/member/feedback', {
        ...form,
        pagePath,
        // Captured so the team can reproduce without a follow-up conversation.
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      })
      onDone()
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <form className="feedbackForm" onSubmit={submit}>
      <label className="field">
        <span>What kind of feedback is this?</span>
        <select className="input" value={form.kind} onChange={set('kind')}>
          {kinds.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>How much is it holding you up?</span>
        <select
          className="input"
          value={form.severity}
          onChange={set('severity')}
        >
          {severities.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Summary *</span>
        <input
          className="input"
          required
          minLength={6}
          maxLength={200}
          placeholder="Calendar filter resets when I go back"
          value={form.title}
          onChange={set('title')}
        />
      </label>
      <label className="field">
        <span>What happened, and what did you expect?</span>
        <textarea
          className="input textarea"
          rows={4}
          maxLength={4000}
          value={form.body}
          onChange={set('body')}
        />
      </label>
      <p className="metaMuted">
        We attach the page you are on ({pagePath}), your screen size, and your
        browser so the team can reproduce it.
      </p>
      {error && (
        <p className="meta" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={sending}>
        {sending ? 'Sending…' : 'Send to the Hub team'}
      </Button>
    </form>
  )
}

export function FeedbackButton({ mode = 'floating', label = 'Feedback' }) {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [options, setOptions] = useState({
    kinds: FALLBACK_KINDS,
    severities: FALLBACK_SEVERITIES,
  })
  const dialogRef = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (open) dialogRef.current?.querySelector('select, input')?.focus()
    else triggerRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    apiGet('/member/feedback/options')
      .then((data) => {
        if (data.kinds?.length && data.severities?.length) {
          setOptions({ kinds: data.kinds, severities: data.severities })
        }
      })
      .catch(() => {
        /* keep the local fallback labels */
      })
  }, [open])

  const close = () => {
    setOpen(false)
    setSent(false)
  }

  const keepFocusInside = (event) => {
    if (event.key !== 'Tab') return
    const focusable = [
      ...(dialogRef.current?.querySelectorAll(
        'input, select, textarea, button, a[href]',
      ) || []),
    ]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`feedbackTrigger feedbackTrigger--${mode}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
      >
        <MessageSquarePlus size={18} strokeWidth={1.75} aria-hidden />
        <span className="feedbackTriggerLabel">{label}</span>
      </button>

      {open && (
        <div className="feedbackBackdrop" onMouseDown={close}>
          <section
            className="feedbackDialog card"
            role="dialog"
            aria-modal="true"
            aria-label="Send feedback to the YOUNGO Hub team"
            ref={dialogRef}
            onKeyDown={keepFocusInside}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="feedbackHeader">
              <div>
                <h2>Send feedback</h2>
                <p className="meta">
                  Bugs, design problems, blockers and ideas all go to the YOUNGO
                  Hub team.
                </p>
              </div>
              <Button sm variant="ghost" onClick={close} aria-label="Close">
                <X size={18} strokeWidth={1.75} aria-hidden />
              </Button>
            </header>

            {sent ? (
              <div className="feedbackSent" role="status">
                <div className="iconTile">
                  <Check size={22} strokeWidth={1.75} aria-hidden />
                </div>
                <h3>Thank you — the team has it</h3>
                <p className="meta">
                  Your report is in the triage queue. We may follow up on the
                  email attached to your account.
                </p>
                <Button variant="primary" onClick={close}>
                  Done
                </Button>
              </div>
            ) : (
              <FeedbackForm
                pagePath={path}
                kinds={options.kinds}
                severities={options.severities}
                onDone={() => setSent(true)}
              />
            )}
          </section>
        </div>
      )}
    </>
  )
}
