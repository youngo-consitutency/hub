import { Feedback } from './Feedback.tsx'
import { Skeletons } from '../../components/ui.jsx'
import { useState, type FormEvent } from 'react'
import { usePlatform, post, values } from './api.ts'
import { Field, Text } from './fields.tsx'

type PublicData = {
  bodies: { id: string; name: string; kind: string; summary: string }[]
  decisions: {
    id: string
    title: string
    proposal: string
    outcome: string
    policyVersion: string
  }[]
  partners: {
    id: string
    organisation: string
    summary: string
    website: string
  }[]
}
export function PublicPlatform() {
  const { data, error, loading } = usePlatform<PublicData>('/public')
  return (
    <div className="siteMain platform">
      <header className="sitePageHeader">
        <p className="pageEyebrow">YOUNGO in practice</p>
        <h1>Our organisation and partnerships</h1>
        <p className="siteSectionLead">
          Learn about YOUNGO’s bodies, published decisions and approved
          partnerships. These records are maintained in the member workspace and
          reviewed for public sharing.
        </p>
      </header>
      {loading && <Skeletons n={3} />}
      {error && (
        <p role="status">
          The maintained register is temporarily unavailable. You can still{' '}
          <a href="/about/contact">contact YOUNGO</a>.
        </p>
      )}
      {data && (
        <>
          <section className="siteSection">
            <h2>Our bodies</h2>
            <div className="cardGrid">
              {data.bodies.map((b) => (
                <article key={b.id} className="card entityCard">
                  <h3>{b.name}</h3>
                  <p className="meta">{b.kind.replaceAll('_', ' ')}</p>
                  <p>{b.summary}</p>
                </article>
              ))}
            </div>
            {!data.bodies.length && (
              <p>
                Reviewed body profiles will appear here as the constituency
                publishes them.
              </p>
            )}
          </section>
          <section className="siteSection">
            <h2>Published decisions</h2>
            <div className="cardGrid">
              {data.decisions.map((d) => (
                <details key={d.id} className="card entityCard">
                  <summary>{d.title}</summary>
                  <p className="meta">{d.policyVersion}</p>
                  <p className="platformProse">{d.proposal}</p>
                  <p>
                    <strong>Outcome:</strong> {d.outcome}
                  </p>
                </details>
              ))}
            </div>
            {!data.decisions.length && (
              <p>
                No decisions have been approved for this public register yet.
              </p>
            )}
          </section>
          <section className="siteSection">
            <h2>Approved partnerships</h2>
            <div className="cardGrid">
              {data.partners.map((p) => (
                <article key={p.id} className="card entityCard">
                  <h3>{p.organisation}</h3>
                  <p>{p.summary}</p>
                  {p.website && (
                    <a
                      href={p.website}
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      Organisation website
                    </a>
                  )}
                </article>
              ))}
            </div>
            {!data.partners.length && (
              <p>Reviewed partnerships will be listed here.</p>
            )}
          </section>
        </>
      )}
      <section className="siteSection">
        <h2>Work with YOUNGO</h2>
        <p>
          Propose a collaboration, explain the opportunity, and the partnerships
          team can follow up. An enquiry does not constitute YOUNGO endorsement.
        </p>
        <PartnerEnquiry />
      </section>
    </div>
  )
}
export function PartnerEnquiry() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = values(form)
      await post('/enquiries', { ...data, consent: data.consent === 'on' })
      form.reset()
      setMessage('Your enquiry has been recorded for the partnerships team.')
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Could not submit your enquiry.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="platform">
      <form className="platformForm" onSubmit={submit}>
        <Field label="Organisation" name="organisation" required />
        <Field label="Your name" name="contactName" required />
        <Field
          label="Contact email"
          name="email"
          type="email"
          required
          maxLength={254}
        />
        <Text
          label="How would you like to collaborate?"
          name="message"
          required
        />
        <div hidden>
          <label>
            Leave empty
            <input name="websiteTrap" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <label className="platformConsent">
          <input type="checkbox" name="consent" required />{' '}
          <span>
            I agree that YOUNGO may use these details to respond to this
            enquiry. My contact name, email and message are visible only to the
            responsible team. An approved partnership may have a reviewed public
            organisation listing. <a href="/privacy">Privacy notice</a>.
          </span>
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Send enquiry'}
        </button>
      </form>
      <Feedback error={error} message={message} />
    </div>
  )
}
