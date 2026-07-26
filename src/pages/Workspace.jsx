import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { useApi } from '../lib/api.js'
import {
  A,
  Button,
  Async,
  Section,
  Empty,
  ErrorCard,
  Skeletons,
  PageHeader,
} from '../components/ui.jsx'
import { getWgOnboarding } from '../content/wgOnboarding.js'
import { Lock, Unlock, MessageCircle, AtSign } from 'lucide-react'

export function Workspace({ slug }) {
  const groups = useApi('/groups')
  const [state, setState] = useState({
    progress: null,
    activities: [],
    loading: true,
    error: null,
  })
  const [presentationOk, setPresentationOk] = useState(false)
  const [rulesOk, setRulesOk] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    apiGet(`/member/workspace/${encodeURIComponent(slug)}`)
      .then((data) => {
        setState({
          progress: data.progress,
          activities: data.activities || [],
          loading: false,
          error: null,
        })
        setPresentationOk(Boolean(data.progress?.presentation_ok))
        setRulesOk(Boolean(data.progress?.rules_ok))
      })
      .catch((e) =>
        setState({
          progress: null,
          activities: [],
          loading: false,
          error: e.message,
        }),
      )
  }

  useEffect(() => {
    load()
  }, [slug])

  const onboard = getWgOnboarding(slug)
  const unlocked = state.progress?.presentation_ok && state.progress?.rules_ok

  const saveOnboard = async () => {
    setSaving(true)
    try {
      const res = await apiPost(
        `/member/workspace/${encodeURIComponent(slug)}/onboard`,
        {
          presentationOk,
          rulesOk,
        },
      )
      setState((s) => ({ ...s, progress: res.progress }))
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <A href="/groups" className="backLink">
        ← Working groups
      </A>
      <Async query={groups} skeletons={2}>
        {(gdata) => {
          const group = (gdata.items || []).find((g) => g.slug === slug)
          if (!group)
            return (
              <Empty
                title="Unknown group"
                body="That working group isn’t in the directory."
              />
            )
          return (
            <>
              <PageHeader
                eyebrow="Working group workspace"
                title={group.name}
                description={group.focusLine}
              />

              {state.loading && <Skeletons n={3} />}
              {state.error && (
                <ErrorCard message={state.error} onRetry={load} />
              )}

              {!state.loading && !unlocked && (
                <div className="stack" style={{ marginTop: 16 }}>
                  <div className="card">
                    <div className="rowGap" style={{ marginBottom: 8 }}>
                      <Lock size={18} strokeWidth={1.75} aria-hidden />
                      <h2>WG onboarding</h2>
                    </div>
                    <p className="meta">
                      Read the introduction and accept the rules to view
                      activities, channel links, and Contact Point details.
                    </p>
                  </div>
                  <div className="card">
                    <h3>Presentation</h3>
                    {onboard.presentation.map((p, i) => (
                      <p
                        key={i}
                        className="meta mandatePara"
                        style={{ marginTop: 8 }}
                      >
                        {p}
                      </p>
                    ))}
                    <label className="authCheck" style={{ marginTop: 12 }}>
                      <input
                        type="checkbox"
                        checked={presentationOk}
                        onChange={(e) => setPresentationOk(e.target.checked)}
                      />
                      <span>I have read the WG presentation.</span>
                    </label>
                  </div>
                  <div className="card">
                    <h3>Rules</h3>
                    <ul className="authBullet meta">
                      {onboard.rules.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <label className="authCheck" style={{ marginTop: 12 }}>
                      <input
                        type="checkbox"
                        checked={rulesOk}
                        onChange={(e) => setRulesOk(e.target.checked)}
                      />
                      <span>
                        I agree to follow these WG rules and YOUNGO policies.
                      </span>
                    </label>
                  </div>
                  <Button
                    variant="primary"
                    glow
                    disabled={!presentationOk || !rulesOk || saving}
                    onClick={saveOnboard}
                  >
                    {saving ? 'Saving…' : 'Unlock WG workspace'}
                  </Button>
                </div>
              )}

              {!state.loading && unlocked && (
                <div className="stack" style={{ marginTop: 16 }}>
                  <div className="card rowBetween">
                    <div className="rowGap">
                      <Unlock
                        size={18}
                        strokeWidth={1.75}
                        color="var(--accent)"
                        aria-hidden
                      />
                      <div>
                        <h3>Workspace unlocked</h3>
                        <p className="meta">
                          Status: {state.progress?.status || 'active'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Section label="Channels & contacts">
                    <div className="grid2">
                      {group.whatsappUrl && (
                        <a
                          className="card cardTight"
                          href={group.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <div className="rowGap">
                            <MessageCircle
                              size={18}
                              strokeWidth={1.75}
                              aria-hidden
                            />
                            <strong>WhatsApp</strong>
                          </div>
                          <p className="meta" style={{ marginTop: 6 }}>
                            Open the WG channel
                          </p>
                        </a>
                      )}
                      <A href="/directory" className="card cardTight">
                        <div className="rowGap">
                          <AtSign size={18} strokeWidth={1.75} aria-hidden />
                          <strong>Contact points</strong>
                        </div>
                        <p className="meta" style={{ marginTop: 6 }}>
                          Directory of public CP emails
                        </p>
                      </A>
                    </div>
                  </Section>
                  <Section label="WG activities">
                    {state.activities?.length ? (
                      state.activities.map((a) => (
                        <div key={a.id} className="card cardTight">
                          <span className="chip chip-neutral">{a.kind}</span>
                          <h3 style={{ marginTop: 6 }}>{a.title}</h3>
                          {a.body && (
                            <p className="meta" style={{ marginTop: 4 }}>
                              {a.body}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No activities yet"
                        body="Contact Points can register calls and action points."
                      />
                    )}
                  </Section>
                </div>
              )}
            </>
          )
        }}
      </Async>
    </div>
  )
}
