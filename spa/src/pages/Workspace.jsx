import { useCallback, useEffect, useState } from 'react'
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
import { DestinationIcon } from '../components/DestinationLink.jsx'
import { WgActivityCard } from '../components/WgActivityCard.jsx'
import { getWgOnboarding } from '../content/wgOnboarding.js'
import { getWgSelfPaced } from '../content/jtOnboardingCourse.js'
import { deckStyle } from '../content/wgDeckBrand.js'
import { WgSelfPaced } from '../components/WgSelfPaced.jsx'
import {
  TbArrowUpRight as ArrowUpRight,
  TbCircleCheck as CheckCircle2,
  TbLock as Lock,
  TbLockOpen as Unlock,
} from 'react-icons/tb'

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
  const [courseDone, setCourseDone] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const markCourseDone = useCallback(() => setCourseDone(true), [])

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
        if (data.progress?.presentation_ok) setCourseDone(true)
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
  const course = getWgSelfPaced(slug)
  const unlocked = state.progress?.presentation_ok && state.progress?.rules_ok
  const introductionRead = course
    ? courseDone && presentationOk
    : presentationOk

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
                  className={course ? 'wgOnboard' : 'card workspaceOnboarding'}
                  style={course ? deckStyle(course.brand) : undefined}
                  aria-labelledby="workspace-onboarding-title"
                >
                  <header
                    className={
                      course ? 'wgOnboardHead' : 'workspaceOnboardingHeader'
                    }
                  >
                    {course ? null : (
                      <span className="iconTile" aria-hidden>
                        <Lock size={20} strokeWidth={1.75} />
                      </span>
                    )}
                    <div>
                      <p className={course ? 'wgOnboardKicker' : 'pageEyebrow'}>
                        {course ? 'Self-paced onboarding' : 'Two short steps'}
                      </p>
                      <h2 id="workspace-onboarding-title">
                        {course ? `Join ${group.name}` : 'Join this group'}
                      </h2>
                      <p className={course ? 'wgOnboardLead' : 'meta'}>
                        {course
                          ? 'Walk through the introduction, then accept the shared rules to open activities, channels, and Contact Point details.'
                          : 'Read the introduction and accept the shared rules to open activities, channels, and Contact Point details.'}
                      </p>
                    </div>
                  </header>

                  {course ? (
                    <>
                      <WgSelfPaced
                        course={course}
                        storageKey={`youngo-wg-course:${slug}`}
                        onReachEnd={markCourseDone}
                      />
                      <section
                        className="wgOnboardRules"
                        aria-labelledby="wg-rules-title"
                      >
                        <h3 id="wg-rules-title">Shared rules</h3>
                        <ul>
                          {onboard.rules.map((rule) => (
                            <li key={rule}>{rule}</li>
                          ))}
                        </ul>
                        <label className="authCheck">
                          <input
                            type="checkbox"
                            checked={presentationOk}
                            disabled={!courseDone}
                            onChange={(event) =>
                              setPresentationOk(event.target.checked)
                            }
                          />
                          <span>
                            {courseDone
                              ? 'I have read the group introduction.'
                              : 'Finish the introduction to confirm you have read it.'}
                          </span>
                        </label>
                        <label className="authCheck">
                          <input
                            type="checkbox"
                            checked={rulesOk}
                            onChange={(event) =>
                              setRulesOk(event.target.checked)
                            }
                          />
                          <span>
                            I agree to follow these group rules and YOUNGO
                            policies.
                          </span>
                        </label>
                      </section>
                      <footer className="wgOnboardFoot">
                        <p>
                          {introductionRead && rulesOk
                            ? 'Ready to unlock.'
                            : courseDone
                              ? 'Confirm both checks to continue.'
                              : 'Read through to the last slide, then confirm both checks.'}
                        </p>
                        <Button
                          className="wgOnboardUnlock"
                          variant="primary"
                          disabled={!introductionRead || !rulesOk || saving}
                          onClick={saveOnboard}
                        >
                          {saving ? 'Saving…' : 'Unlock workspace'}
                        </Button>
                      </footer>
                    </>
                  ) : (
                    <>
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
                              onChange={(event) =>
                                setRulesOk(event.target.checked)
                              }
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
                          {introductionRead && rulesOk
                            ? 'Ready to unlock.'
                            : 'Complete both checks to continue.'}
                        </p>
                        <Button
                          variant="primary"
                          disabled={!introductionRead || !rulesOk || saving}
                          onClick={saveOnboard}
                        >
                          {saving ? 'Saving…' : 'Unlock workspace'}
                        </Button>
                      </footer>
                    </>
                  )}
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
                  {course && (
                    <section
                      className="wgOnboard"
                      style={deckStyle(course.brand)}
                    >
                      <footer className="wgOnboardFoot">
                        <p>The introduction stays available after you join.</p>
                        <Button
                          className="wgOnboardUnlock"
                          variant="primary"
                          onClick={() => setReviewing((open) => !open)}
                        >
                          {reviewing ? 'Hide onboarding' : 'Review onboarding'}
                        </Button>
                      </footer>
                      {reviewing && (
                        <WgSelfPaced
                          course={course}
                          storageKey={`youngo-wg-course:${slug}`}
                          onReachEnd={markCourseDone}
                        />
                      )}
                    </section>
                  )}
                  <Section label="Channels & contacts">
                    <div className="workspaceContactGrid">
                      {group.whatsappUrl && (
                        <a
                          className="card cardTight workspaceChannelCard"
                          href={group.whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <DestinationIcon url={group.whatsappUrl} size={20} />
                          <strong>WhatsApp</strong>
                          <ArrowUpRight
                            size={17}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                        </a>
                      )}
                      {group.contact && <ContactCard contact={group.contact} />}
                    </div>
                  </Section>
                  <Section label="WG activities">
                    {state.activities?.length ? (
                      <div className="cardGrid">
                        {state.activities.map((activity) => (
                          <WgActivityCard
                            key={activity.id}
                            activity={activity}
                          />
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
