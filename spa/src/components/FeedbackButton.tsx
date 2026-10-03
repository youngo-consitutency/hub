interface FeedbackFormProps {
  pagePath?: any
  kinds?: any
  severities?: any
  onDone?: any
}

interface FeedbackButtonProps {
  mode?: any
  label?: string
}

import { SidePanel } from './SidePanel.tsx'
import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { usePath } from '../lib/router'
import { Button } from './ui'
import { TbMessagePlus as MessageSquarePlus, TbCheck as Check } from 'react-icons/tb'

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

function FeedbackForm({ pagePath, kinds, severities, onDone }: FeedbackFormProps) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<any>(null)
  const [sending, setSending] = useState(false)

  const set = (key: any) => (event: any) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = async (event: any) => {
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
      setError((err as any).message)
      setSending(false)
    }
  }

  return (
    <form className="feedbackForm" onSubmit={submit}>
      <label className="field">
        <span>What kind of feedback is this?</span>
        <select className="input" value={form.kind} onChange={set('kind')}>
          {kinds.map((item: any) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>How much is it holding you up?</span>
        <select className="input" value={form.severity} onChange={set('severity')}>
          {severities.map((item: any) => (
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
        We attach the page you are on ({pagePath}), your screen size, and your browser so the team
        can reproduce it.
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

export function FeedbackButton({ mode = 'floating', label = 'Feedback' }: FeedbackButtonProps) {
  const path = usePath()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [options, setOptions] = useState<Record<string, any>>({
    kinds: FALLBACK_KINDS,
    severities: FALLBACK_SEVERITIES,
  })
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

  return (
    <>
      <button
        type="button"
        className={`feedbackTrigger feedbackTrigger--${mode}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
      >
        <MessageSquarePlus size={18} strokeWidth={1.75} aria-hidden />
        <span className="feedbackTriggerLabel">{label}</span>
      </button>

      {open && (
        <SidePanel title="Send feedback" onClose={close}>
          <p className="meta">
            Bugs, design problems, blockers and ideas all go to the YOUNGO Hub team.
          </p>
          {sent ? (
            <div className="feedbackSent" role="status">
              <div className="iconTile">
                <Check size={22} strokeWidth={1.75} aria-hidden />
              </div>
              <h3>Thank you — the team has it</h3>
              <p className="meta">
                Your report is in the triage queue. We may follow up on the email attached to your
                account.
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
        </SidePanel>
      )}
    </>
  )
}
