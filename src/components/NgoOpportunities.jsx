import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { Button, Empty, ErrorCard, Section, Skeletons } from './ui.jsx'
import { DatePicker, SearchableSelect } from './FormControls.jsx'
import { TbSpeakerphone as Megaphone } from 'react-icons/tb'

const KIND_OPTIONS = [
  { value: 'event', label: 'Event' },
  { value: 'workshop', label: 'Online workshop' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'opportunity', label: 'Opportunity' },
  { value: 'call', label: 'Open call' },
  { value: 'training', label: 'Training' },
]

const FORMAT_OPTIONS = [
  { value: 'online', label: 'Online' },
  { value: 'in_person', label: 'In person' },
  { value: 'hybrid', label: 'Hybrid' },
]

const STATUS_CHIP = {
  published: ['chip-accent', 'Live'],
  pending_review: ['chip-warn', 'Awaiting review'],
  rejected: ['chip-danger', 'Not published'],
  withdrawn: ['chip-neutral', 'Withdrawn'],
}

const EMPTY = {
  kind: 'workshop',
  title: '',
  summary: '',
  body: '',
  format: 'online',
  location: '',
  region: '',
  startsAt: '',
  endsAt: '',
  deadlineAt: '',
  linkUrl: '',
}

export function NgoOpportunities() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setError(null)
    apiGet('/member/ngo/opportunities')
      .then(setData)
      .catch((err) => setError(err.message))
  }

  useEffect(() => {
    load()
  }, [])

  const field = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const iso = (value) => (value ? new Date(value).toISOString() : null)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await apiPost('/member/ngo/opportunities', {
        ...form,
        startsAt: iso(form.startsAt),
        endsAt: iso(form.endsAt),
        deadlineAt: iso(form.deadlineAt),
      })
      setNotice(res.note)
      setForm(EMPTY)
      load()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const withdraw = async (id) => {
    try {
      await apiPost(`/member/ngo/opportunities/${id}/withdraw`, {})
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data && !error) return <Skeletons n={2} />

  return (
    <>
      <Section
        label="What your organisation has posted"
        action={
          data?.trusted ? (
            <span className="chip chip-accent">Posts publish directly</span>
          ) : (
            <span className="chip chip-warn">First posting is reviewed</span>
          )
        }
      >
        {error && <ErrorCard message={error} onRetry={load} />}
        {notice && (
          <p className="meta" style={{ color: 'var(--accent)' }}>
            {notice}
          </p>
        )}
        {data?.items?.length === 0 ? (
          <Empty
            icon={Megaphone}
            title="Nothing posted yet"
            body="Share events, online workshops, hackathons and open calls with the constituency."
          />
        ) : (
          <div className="stackSm">
            {(data?.items || []).map((item) => {
              const [chipClass, chipLabel] = STATUS_CHIP[item.status] || [
                'chip-neutral',
                item.status,
              ]
              return (
                <div key={item.id} className="card cardTight rowBetween">
                  <div>
                    <div className="rowGap" style={{ flexWrap: 'wrap' }}>
                      <span className={`chip ${chipClass}`}>{chipLabel}</span>
                      <span className="chip chip-neutral">{item.kind}</span>
                    </div>
                    <h3 style={{ marginTop: 6 }}>{item.title}</h3>
                    <p className="meta">
                      {item.startsAt
                        ? new Date(item.startsAt).toLocaleString()
                        : 'No date set'}
                      {item.location ? ` · ${item.location}` : ''}
                    </p>
                    {item.reviewNote && (
                      <p className="metaMuted">Reviewer: {item.reviewNote}</p>
                    )}
                  </div>
                  {data.canPost &&
                    ['published', 'pending_review'].includes(item.status) && (
                      <Button
                        sm
                        variant="ghost"
                        onClick={() => withdraw(item.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {data?.canPost && (
        <Section label="Post to the constituency">
          <form className="card stack" onSubmit={submit}>
            <SearchableSelect
              label="Type"
              options={KIND_OPTIONS}
              value={form.kind}
              onChange={(kind) => setForm((current) => ({ ...current, kind }))}
              searchPlaceholder="Search posting types…"
            />
            <label className="field">
              <span>Title *</span>
              <input
                className="input"
                required
                minLength={6}
                maxLength={200}
                value={form.title}
                onChange={field('title')}
              />
            </label>
            <label className="field">
              <span>One-line summary</span>
              <input
                className="input"
                maxLength={300}
                placeholder="Who it is for and what they get out of it"
                value={form.summary}
                onChange={field('summary')}
              />
            </label>
            <label className="field">
              <span>Details</span>
              <textarea
                className="input textarea"
                rows={4}
                maxLength={4000}
                value={form.body}
                onChange={field('body')}
              />
            </label>
            <SearchableSelect
              label="Format"
              options={FORMAT_OPTIONS}
              value={form.format}
              onChange={(format) =>
                setForm((current) => ({ ...current, format }))
              }
              searchPlaceholder="Search formats…"
            />
            {form.format !== 'online' && (
              <label className="field">
                <span>Location</span>
                <input
                  className="input"
                  maxLength={200}
                  placeholder="City, country or venue"
                  value={form.location}
                  onChange={field('location')}
                />
              </label>
            )}
            <label className="field">
              <span>Region (optional)</span>
              <input
                className="input"
                maxLength={60}
                placeholder="Africa, Asia-Pacific, Latin America…"
                value={form.region}
                onChange={field('region')}
              />
            </label>
            <div className="formRow">
              <DatePicker
                label="Starts"
                value={form.startsAt}
                onChange={(startsAt) =>
                  setForm((current) => ({ ...current, startsAt }))
                }
              />
              <DatePicker
                label="Ends"
                value={form.endsAt}
                onChange={(endsAt) =>
                  setForm((current) => ({ ...current, endsAt }))
                }
              />
            </div>
            <DatePicker
              label="Application deadline"
              value={form.deadlineAt}
              onChange={(deadlineAt) =>
                setForm((current) => ({ ...current, deadlineAt }))
              }
            />
            <label className="field">
              <span>Link</span>
              <input
                className="input"
                type="url"
                placeholder="https://…"
                value={form.linkUrl}
                onChange={field('linkUrl')}
              />
            </label>
            <p className="metaMuted">
              {data.trusted
                ? 'This posting goes live for members immediately.'
                : 'Your first posting is checked by the Membership Team. After it is approved, later postings publish directly.'}
            </p>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? 'Posting…' : 'Post'}
            </Button>
          </form>
        </Section>
      )}
    </>
  )
}
