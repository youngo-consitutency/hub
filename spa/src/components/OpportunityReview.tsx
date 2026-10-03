interface PostingMetaProps {
  item?: any
}

import { formatDateTime } from '../lib/time'
import { regionLabel } from '../lib/regions'
import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { Button, Empty, ErrorCard, Section, Skeletons } from './ui'
import { TbSpeakerphone as Megaphone } from 'react-icons/tb'

const KIND_LABEL = {
  event: 'Event',
  workshop: 'Online workshop',
  hackathon: 'Hackathon',
  opportunity: 'Opportunity',
  call: 'Open call',
  training: 'Training',
}

function PostingMeta({ item }: PostingMetaProps) {
  return (
    <>
      <div className="rowGap" style={{ flexWrap: 'wrap' }}>
        <span className="chip chip-info">{(KIND_LABEL as any)[item.kind] || item.kind}</span>
        <span className="chip chip-neutral">{item.format}</span>
        {item.region && <span className="chip chip-neutral">{regionLabel(item.region)}</span>}
      </div>
      <h3>{item.title}</h3>
      <p className="meta">
        {item.organizationName || 'Unknown organisation'}
        {item.startsAt ? ` · ${formatDateTime(item.startsAt)}` : ''}
        {item.location ? ` · ${item.location}` : ''}
      </p>
      {item.summary && <p className="meta">{item.summary}</p>}
      {item.body && <p className="metaMuted">{item.body}</p>}
      {item.linkUrl && (
        <a className="metaMuted" href={item.linkUrl} target="_blank" rel="noreferrer noopener">
          {item.linkUrl}
        </a>
      )}
    </>
  )
}

export function OpportunityReview() {
  const [state, setState] = useState<Record<string, any>>({
    items: null,
    published: null,
    organisations: null,
    error: null,
  })
  const [notes, setNotes] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState<any>(null)

  const load = () => {
    apiGet('/member/opportunities/review')
      .then((data) =>
        setState({
          items: data.items,
          published: data.published || [],
          organisations: data.organisations || [],
          error: null,
        }),
      )
      .catch((error) =>
        setState({
          items: null,
          published: null,
          organisations: null,
          error: error.message,
        }),
      )
  }

  useEffect(() => {
    load()
  }, [])

  const setNote = (id: any, value: any) => setNotes((current) => ({ ...current, [id]: value }))

  const run = async (key: any, work: any) => {
    setBusy(key)
    try {
      await work()
      load()
    } catch (error) {
      setState((current) => ({ ...current, error: (error as any).message }))
    }
    setBusy(null)
  }

  const decide = (id: any, decision: any) =>
    run(`review:${id}`, () =>
      apiPost(`/member/opportunities/${id}/review`, {
        decision,
        note: notes[id] || '',
      }).then(() => setNote(id, '')),
    )

  const unpublish = (id: any) =>
    run(`unpublish:${id}`, () =>
      apiPost(`/member/opportunities/${id}/unpublish`, {
        note: notes[id] || '',
      }).then(() => setNote(id, '')),
    )

  const setTrust = (orgAccountId: any, nextState: any) =>
    run(`trust:${orgAccountId}`, () =>
      apiPost(`/member/opportunities/trust/${orgAccountId}`, {
        state: nextState,
        note: notes[`trust:${orgAccountId}`] || '',
      }),
    )

  return (
    <>
      <Section
        label="NGO postings awaiting review"
        action={<span>First posting per organisation</span>}
      >
        {state.error && <ErrorCard message={state.error} onRetry={load} />}
        {!state.items && !state.error && <Skeletons n={2} />}
        {state.items?.length === 0 && (
          <Empty
            icon={Megaphone}
            title="Queue is clear"
            body="An organisation's first posting is held here. After it is approved, that organisation posts directly."
          />
        )}
        <div className="stack">
          {(state.items || []).map((item: any) => (
            <div key={(item as any).id} className="card stackSm">
              <PostingMeta item={item} />
              <label className="field">
                <span>Note to the organisation (required to reject)</span>
                <input
                  className="input"
                  value={notes[(item as any).id] || ''}
                  onChange={(event) => setNote((item as any).id, event.target.value)}
                />
              </label>
              <div className="rowGap">
                <Button
                  sm
                  variant="primary"
                  disabled={busy === `review:${(item as any).id}`}
                  onClick={() => decide((item as any).id, 'approve')}
                >
                  Approve and publish
                </Button>
                <Button
                  sm
                  variant="ghost"
                  disabled={busy === `review:${(item as any).id}`}
                  onClick={() => decide((item as any).id, 'reject')}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {state.published && (
        <Section label="Live NGO postings" action={<span>Staff can take a posting down</span>}>
          {(state.published as any).length === 0 ? (
            <Empty
              icon={Megaphone}
              title="Nothing live"
              body="Published postings appear here so the Membership Team can unpublish them."
            />
          ) : (
            <div className="stack">
              {(state.published as any).map((item: any) => (
                <div key={item.id} className="card stackSm">
                  <PostingMeta item={item} />
                  <label className="field">
                    <span>Reason for unpublishing (required)</span>
                    <input
                      className="input"
                      value={notes[item.id] || ''}
                      onChange={(event) => setNote(item.id, event.target.value)}
                    />
                  </label>
                  <Button
                    sm
                    variant="ghost"
                    disabled={busy === `unpublish:${item.id}`}
                    onClick={() => unpublish(item.id)}
                  >
                    Unpublish
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {state.organisations && (state.organisations as any).length > 0 && (
        <Section
          label="Organisation posting trust"
          action={<span>Override the first-posting rule</span>}
        >
          <div className="stackSm">
            {(state.organisations as any).map((org: any) => (
              <div key={org.orgAccountId} className="card cardTight stackSm">
                <div className="rowBetween" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3>{org.organizationName || 'Organisation'}</h3>
                    <p className="metaMuted">
                      {org.trusted ? 'Posts publish directly' : 'Next posting needs review'}
                      {org.override
                        ? ` · override: ${org.override.replace('_', ' ')}`
                        : ' · earned from published postings'}
                    </p>
                    {org.overrideNote && <p className="metaMuted">{org.overrideNote}</p>}
                  </div>
                  <span className={`chip ${org.trusted ? 'chip-accent' : 'chip-warn'}`}>
                    {org.trusted ? 'Trusted' : 'Review required'}
                  </span>
                </div>
                <label className="field">
                  <span>Note for the override (optional)</span>
                  <input
                    className="input"
                    value={notes[`trust:${org.orgAccountId}`] || ''}
                    onChange={(event) => setNote(`trust:${org.orgAccountId}`, event.target.value)}
                  />
                </label>
                <div className="rowGap">
                  {!org.trusted && (
                    <Button
                      sm
                      variant="primary"
                      disabled={busy === `trust:${org.orgAccountId}`}
                      onClick={() => setTrust(org.orgAccountId, 'trusted')}
                    >
                      Trust — skip review
                    </Button>
                  )}
                  {org.trusted && (
                    <Button
                      sm
                      variant="ghost"
                      disabled={busy === `trust:${org.orgAccountId}`}
                      onClick={() => setTrust(org.orgAccountId, 'review_required')}
                    >
                      Require review again
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  )
}
