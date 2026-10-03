import { useRef, useState } from 'react'
import { useDocument } from '../lib/documents'
import { apiPostFile, useApi } from '../lib/api'
import { Button, ErrorCard } from '../components/ui'
import { Brand } from '../components/Brand'
import { signOut } from '../lib/session'
import { useAccount } from '../lib/accountContext'
import { TbLogout as LogOut, TbScale as Scale, TbShieldCheck as ShieldCheck } from 'react-icons/tb'

const APPEAL_PROOF_MAX_BYTES = 2 * 1024 * 1024

const IDENTITY_OPTIONS = [
  ['passport', 'Passport'],
  ['national_id', 'National ID or residence card'],
  ['organisational_letter', 'Organisation letter on letterhead'],
  ['other', 'Other identity document'],
]

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'

export function MembershipAppeal() {
  const { doc: connect } = useDocument('connect')
  const membershipEmail = connect?.MEMBERSHIP_CONTACT_EMAIL

  const { account } = useAccount()
  const query = useApi('/member/membership/appeal')
  const [identityKind, setIdentityKind] = useState('passport')
  const [statement, setStatement] = useState('')
  const [consent, setConsent] = useState(false)
  const [file, setFile] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<any>(null)
  const appeal = query.data?.appeal
  const reason = query.data?.membershipEndReason || account?.membershipEndReason || null

  const submit = async (event: any) => {
    event.preventDefault()
    setError('')
    if (!consent) {
      setError('Confirm that the Membership Team may use this document for the appeal.')
      return
    }
    if (!file) {
      setError('Attach a photo or PDF of your identity document.')
      return
    }
    if (file.size > APPEAL_PROOF_MAX_BYTES) {
      setError('Keep the document at 2 MB or smaller.')
      return
    }
    setBusy(true)
    try {
      await apiPostFile('/member/membership/appeal', file, {
        'X-Identity-Kind': identityKind,
        'X-Appeal-Statement': encodeURIComponent(statement.trim()),
      })
      setFile(null)
      setStatement('')
      setConsent(false)
      if (fileRef.current) fileRef.current.value = ''
      query.retry()
    } catch (submitError) {
      setError((submitError as any).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mandateGate membershipAppealGate">
      <div className="mandateShell">
        <Brand />
        <p className="eyebrow">Membership decision</p>
        <h1>This application was not accepted</h1>
        <p className="lede">
          You can appeal directly from here by sending proof of who you are — a passport, national
          ID, or an organisation letter. Only the Membership Team can open the file.
        </p>
        {reason && <p className="meta membershipAppealReason">Reason given: {reason}</p>}

        {query.error && <ErrorCard message={query.error} onRetry={query.retry} />}

        {appeal?.status === 'submitted' && (
          <section className="card authSection">
            <p className="rowGap">
              <Scale size={18} aria-hidden />
              <strong>Appeal received</strong>
            </p>
            <p className="meta">
              The Membership Team has your statement and identity document. Stay signed in with this
              email; they will write back through the Hub when they decide.
            </p>
          </section>
        )}

        {appeal?.status === 'upheld' && (
          <section className="card authSection">
            <p className="meta">
              The previous appeal was not accepted
              {appeal.reviewerNote ? `: ${appeal.reviewerNote}` : '.'} You can send one more
              identity appeal if you have clearer proof.
            </p>
          </section>
        )}

        {appeal?.status !== 'submitted' && (
          <form className="card authSection stackSm" onSubmit={submit}>
            <h2 className="authSectionTitle">Send identity proof</h2>
            <label className="field">
              <span>What are you sending?</span>
              <select
                className="input"
                value={identityKind}
                onChange={(event) => setIdentityKind(event.target.value)}
              >
                {IDENTITY_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Who you are, in your own words *</span>
              <textarea
                className="input textarea"
                rows={5}
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                placeholder="Your full name, organisation if any, and why the rejection should be reviewed."
                required
                minLength={40}
                maxLength={2000}
              />
            </label>
            <label className="field">
              <span>Identity document (JPEG, PNG, WebP, or PDF · max 2 MB) *</span>
              <input
                ref={fileRef}
                className="input"
                type="file"
                accept={ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </label>
            <label className="authCheck">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                This document is mine or my organisation’s. The Membership Team may use it only to
                review this appeal.
              </span>
            </label>
            {error && <ErrorCard message={error} />}
            <Button variant="primary" disabled={busy} type="submit">
              <ShieldCheck size={16} aria-hidden />
              {busy ? 'Sending…' : 'Send appeal'}
            </Button>
          </form>
        )}

        <p className="metaMuted">
          Signed in as {account?.email}. Help:{' '}
          <a className="mandateExtLink" href={`mailto:${membershipEmail}`}>
            {membershipEmail}
          </a>
        </p>
        <Button variant="ghost" onClick={() => signOut()}>
          <LogOut size={16} aria-hidden />
          Sign out
        </Button>
      </div>
    </main>
  )
}
