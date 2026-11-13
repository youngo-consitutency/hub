import {
  Button,
  Checkbox,
  Disclosure,
  DisclosurePanel,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  TextArea,
  TextField,
  type TextFieldProps,
} from 'react-aria-components'
import { motion } from 'motion/react'
import { TbCheck, TbCircleCheck, TbSend } from 'react-icons/tb'
import { SiteSection } from '../../pages/site/SitePage'
import { Skeletons } from '../../components/ui'
import { useState, type FormEvent } from 'react'
import { usePlatform, post, values } from './api.ts'

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
export function OrganisationSection() {
  const { data, error, loading } = usePlatform<PublicData>('/public')
  return (
    <SiteSection
      id="organisation"
      eyebrow="YOUNGO in practice"
      title="Our organisation and partnerships"
      lead="Learn about YOUNGO’s bodies, published decisions and approved partnerships. These records           are maintained in the member workspace and reviewed for public sharing."
    >
      {loading && <Skeletons n={3} />}
      {error && (
        <p role="status">
          The maintained register is temporarily unavailable. You can still{' '}
          <a href="#contact">contact YOUNGO</a>.
        </p>
      )}
      {data && (
        <>
          <div className="siteSub">
            <h3>Our bodies</h3>
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
              <p>Reviewed body profiles will appear here as the constituency publishes them.</p>
            )}
          </div>
          <div className="siteSub">
            <h3>Published decisions</h3>
            <div className="cardGrid">
              {data.decisions.map((d) => (
                <Disclosure key={d.id} className="card entityCard">
                  <Heading level={4}>
                    <Button slot="trigger" className="siteDisclosureTrigger">
                      {d.title}
                    </Button>
                  </Heading>
                  <DisclosurePanel>
                    <p className="meta">{d.policyVersion}</p>
                    <p className="platformProse">{d.proposal}</p>
                    <p>
                      <strong>Outcome:</strong> {d.outcome}
                    </p>
                  </DisclosurePanel>
                </Disclosure>
              ))}
            </div>
            {!data.decisions.length && (
              <p>No decisions have been approved for this public register yet.</p>
            )}
          </div>
          <div className="siteSub">
            <h3>Approved partnerships</h3>
            <div className="cardGrid">
              {data.partners.map((p) => (
                <article key={p.id} className="card entityCard">
                  <h3>{p.organisation}</h3>
                  <p>{p.summary}</p>
                  {p.website && (
                    <a href={p.website} rel="noreferrer noopener" target="_blank">
                      Organisation website
                    </a>
                  )}
                </article>
              ))}
            </div>
            {!data.partners.length && <p>Reviewed partnerships will be listed here.</p>}
          </div>
        </>
      )}
    </SiteSection>
  )
}

const MESSAGE_MAX = 1500

// a text field with react-aria's labelling and inline validation
function EnquiryField({ label, name, type = 'text', ...rest }: TextFieldProps & { label: string }) {
  return (
    <TextField className="siteField" name={name} type={type} isRequired maxLength={254} {...rest}>
      <Label>{label}</Label>
      <Input className="input" />
      <FieldError className="fieldError" />
    </TextField>
  )
}

export function PartnerEnquiry() {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [length, setLength] = useState(0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = values(event.currentTarget)
      await post('/enquiries', { ...data, consent: data.consent === 'on' })
      setSent(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not submit your enquiry.')
    } finally {
      setBusy(false)
    }
  }

  if (sent)
    return (
      <motion.div
        className="card siteFormDone"
        role="status"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <TbCircleCheck size={28} strokeWidth={1.5} aria-hidden />
        <div>
          <h3>Thank you, your enquiry is with the partnerships team</h3>
          <p className="meta">We read every message and reply to the email you gave.</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSent(false)
              setLength(0)
            }}
          >
            Send another
          </button>
        </div>
      </motion.div>
    )

  return (
    <Form className="siteForm" onSubmit={submit} validationBehavior="native">
      <div className="siteFormRow">
        <EnquiryField label="Organisation" name="organisation" maxLength={200} />
        <EnquiryField label="Your name" name="contactName" maxLength={200} />
      </div>
      <EnquiryField label="Contact email" name="email" type="email" />
      <TextField
        className="siteField"
        name="message"
        isRequired
        maxLength={MESSAGE_MAX}
        onChange={(value) => setLength(value.length)}
      >
        <Label>How would you like to collaborate?</Label>
        <TextArea className="input" rows={5} />
        <FieldError className="fieldError" />
        <span className="siteFieldCount" aria-hidden>
          {length} / {MESSAGE_MAX}
        </span>
      </TextField>
      <div hidden>
        <label>
          Leave empty
          <input name="websiteTrap" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Checkbox className="siteCheck" name="consent" isRequired>
        <span className="siteCheckBox" aria-hidden>
          <TbCheck size={14} strokeWidth={3} />
        </span>
        <span>
          I agree that YOUNGO may use these details to respond to this enquiry. My contact name,
          email and message are visible only to the responsible team. An approved partnership may
          have a reviewed public organisation listing. <a href="/privacy">Privacy notice</a>.
        </span>
      </Checkbox>
      {error && (
        <p className="formAlert" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="btn btn-primary btn-lg siteFormSubmit" isDisabled={busy}>
        {busy ? 'Sending…' : 'Send enquiry'}
        <TbSend size={17} strokeWidth={1.75} aria-hidden />
      </Button>
    </Form>
  )
}
