import { TbMailCheck as MailCheck } from 'react-icons/tb'
import { Button } from '../ui'

interface CheckYourEmailProps {
  email: string
  onStartOver: () => void
}

/**
 * Shown after sign-up. The same message appears whether or not the address already has an account,
 * so the form never reveals who is registered; the email says which case it was.
 */
export function CheckYourEmail({ email, onStartOver }: CheckYourEmailProps) {
  return (
    <section className="card authSection" role="status" aria-live="polite">
      <h2 className="authSectionTitle">
        <MailCheck size={20} aria-hidden /> Check your email
      </h2>
      <p>
        We sent a message to <strong>{email}</strong>. Open it and follow the link to finish joining
        YOUNGO Hub. The link works for 24 hours.
      </p>
      <p className="meta">
        Nothing arrived? Look in your spam folder, then check the address is right. If you already
        have an account, the email tells you how to sign in.
      </p>
      <Button variant="secondary" onClick={onStartOver}>
        Use a different address
      </Button>
    </section>
  )
}
