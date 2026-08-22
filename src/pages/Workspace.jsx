import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { useApi } from '../lib/api.js'
import {
  Button,
  Async,
  BackLink,
  Section,
  Empty,
  ErrorCard,
  Skeletons,
  PageHeader,
} from '../components/ui.jsx'
import { ContactCard } from '../components/cards.jsx'
import { getWgOnboarding } from '../content/wgOnboarding.js'
import { CheckCircle2, Lock, Unlock, MessageCircle } from 'lucide-react'

export function Workspace({ slug }) {
  const groupQuery = useApi(`/groups/${encodeURIComponent(slug)}`, [slug])
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
    <div className="workspacePage">
      <BackLink href="/groups">Working groups</BackLink>
      <Async query={groupQuery} skeletons={2}>
        {(group) => {
          return (
            <>
              <PageHeader title={group.name} description={group.focusLine} />

              {state.loading && <Skeletons n={3} />}
              {state.error && (
                <ErrorCard message={state.error} onRetry={load} />
              )}

              {!state.loading && !unlocked && (
                <section
                  className="card workspaceOnboarding"
                  aria-labelledby="workspace-onboarding-title"
                >
                  <header className="workspaceOnboardingHeader">
                    <span className="iconTile" aria-hidden>
                      <Lock size={20} strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="pageEyebrow">Two short steps</p>
                      <h2 id="workspace-onboarding-title">Join this group</h2>
                      <p className="meta">
                        Read the introduction and accept the shared rules to
                        open activities, channels, and Contact Point details.
                      </p>
                    </div>
                  </header>

                  <div className="workspaceOnboardingSteps">
                    <fieldset className="workspaceOnboardingStep">
                      <legend>
                        <span>1</span> Group introduction
                      </legend>
                      <div className="workspaceIntroduction">
                        {onboard.presentation.map((paragraph) => (
                          <p key={paragraph} className="meta mandatePara">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                      <label className="authCheck workspaceAgreement">
                        <input
                          type="checkbox"
                          checked={presentationOk}
                          onChange={(event) =>
                            setPresentationOk(event.target.checked)
                          }
                        />
                        <span>I have read the group introduction.</span>
                      </label>
                    </fieldset>

                    <fieldset className="workspaceOnboardingStep">
                      <legend>
                        <span>2</span> Shared rules
                      </legend>
                      <ul className="authBullet meta">
                        {onboard.rules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                      <label className="authCheck workspaceAgreement">
                        <input
                          type="checkbox"
                          checked={rulesOk}
                          onChange={(event) => setRulesOk(event.target.checked)}
                        />
                        <span>
                          I agree to follow these group rules and YOUNGO
                          policies.
                        </span>
                      </label>
                    </fieldset>
                  </div>

                  <footer className="workspaceOnboardingFooter">
                    <p className="metaMuted">
                      {presentationOk && rulesOk
                        ? 'Ready to unlock.'
                        : 'Complete both checks to continue.'}
                    </p>
                    <Button
                      variant="primary"
                      disabled={!presentationOk || !rulesOk || saving}
                      onClick={saveOnboard}
                    >
                      {saving ? 'Saving…' : 'Unlock workspace'}
                    </Button>
                  </footer>
                </section>
              )}

              {!state.loading && unlocked && (
                <div className="workspaceUnlocked">
                  <div className="card workspaceStatusCard">
                    <div className="rowGap">
                      <Unlock
                        size={18}
                        strokeWidth={1.75}
                        className="workspaceStatusIcon"
                        aria-hidden
                      />
                      <div>
                        <h3>Workspace unlocked</h3>
                        <p className="meta">
                          Status: {state.progress?.status || 'active'}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden />
                  </div>
                  <Section label="Channels & contacts">
                    <div className="workspaceContactGrid">
                      {group.whatsappUrl && (
                        <a
                          className="card cardTight workspaceChannelCard"
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
                          <p className="meta">Open the WG channel</p>
                        </a>
                      )}
                      {group.contact && <ContactCard contact={group.contact} />}
                    </div>
                  </Section>
                  <Section label="WG activities">
                    {state.activities?.length ? (
                      <div className="cardGrid">
                        {state.activities.map((activity) => (
                          <article
                            key={activity.id}
                            className="card cardTight workspaceActivityCard"
                          >
                            <span className="chip chip-neutral">
                              {activity.kind}
                            </span>
                            <h3>{activity.title}</h3>
                            {activity.body && (
                              <p className="meta">{activity.body}</p>
                            )}
                          </article>
                        ))}
                      </div>
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
