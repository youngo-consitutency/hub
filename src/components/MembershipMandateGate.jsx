import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  ScrollText,
} from 'lucide-react'
import {
  MANDATE_ANALYSIS,
  POLICY_META,
  POLICY_SECTIONS,
  POLICY_VERSION,
} from '../content/membershipPolicy.js'
import { acknowledgeMembershipPolicy } from '../lib/membershipGate.js'
import { Button } from './ui.jsx'
import { Brand } from './Brand.jsx'

/**
 * Full-screen mandatory Membership Policy read (step 1 of access).
 * Landing is summary-first for readability; full legal text is available
 * in a collapsible section that still requires scroll-to-end.
 */
export function MembershipMandateGate({ onComplete }) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [progress, setProgress] = useState(0)
  const [checked, setChecked] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const bodyRef = useRef(null)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const onScroll = useCallback(() => {
    const el = bodyRef.current
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    if (max <= 8) {
      setProgress(1)
      // Full legal text must still be opened when content fits without scroll.
      if (showFull) setScrolledToEnd(true)
      return
    }
    const ratio = Math.min(1, el.scrollTop / max)
    setProgress(ratio)
    if (showFull && el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      setScrolledToEnd(true)
    }
  }, [showFull])

  useEffect(() => {
    const id = requestAnimationFrame(onScroll)
    return () => cancelAnimationFrame(id)
  }, [onScroll, showFull])

  const openFullPolicy = () => {
    setShowFull(true)
    // Reset so the user must scroll the legal text (or see short content mark end).
    setScrolledToEnd(false)
    setProgress(0)
    requestAnimationFrame(() => {
      const el = bodyRef.current
      if (!el) return
      const full = el.querySelector('#full-policy')
      full?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      onScroll()
    })
  }

  const canContinue = scrolledToEnd && checked

  const finish = () => {
    if (!canContinue) return
    acknowledgeMembershipPolicy()
    onComplete?.()
  }

  return (
    <div
      className="mandateGate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mandate-title"
      aria-describedby="mandate-desc"
    >
      <div className="mandateShell">
        <header className="mandateHeader">
          <div className="gateBrand">
            <Brand />
          </div>
          <div className="rowGap" style={{ alignItems: 'flex-start' }}>
            <span className="iconTile" aria-hidden>
              <ScrollText size={22} strokeWidth={1.75} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="metaMuted" style={{ marginBottom: 4 }}>
                Step 1 of 2 · Required
              </p>
              <h1 id="mandate-title">Before you join</h1>
              <p
                id="mandate-desc"
                className="meta"
                style={{ marginTop: 6, maxWidth: 520 }}
              >
                A short overview of YOUNGO membership. Open the full policy,
                scroll to the end, then continue.
              </p>
            </div>
          </div>
          <div className="mandateProgress" aria-hidden>
            <div
              className="mandateProgressBar"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        </header>

        <div
          className="mandateBody"
          ref={bodyRef}
          onScroll={onScroll}
          tabIndex={0}
        >
          <section className="mandateAnalysis card">
            <div className="rowGap" style={{ marginBottom: 10 }}>
              <BookOpen
                size={18}
                strokeWidth={1.75}
                aria-hidden
                color="var(--accent)"
              />
              <h2>{MANDATE_ANALYSIS.title}</h2>
            </div>
            <p className="meta" style={{ marginBottom: 14, maxWidth: 640 }}>
              {MANDATE_ANALYSIS.lede}
            </p>
            <div className="mandatePoints">
              {MANDATE_ANALYSIS.points.map((p) => (
                <div key={p.title} className="mandatePoint">
                  <h3>{p.title}</h3>
                  <p className="meta">{p.body}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mandateDocMeta card cardTight">
            <p className="meta">
              <strong>{POLICY_META.name}</strong> · {POLICY_META.issue}
            </p>
            <p className="metaMuted" style={{ marginTop: 4 }}>
              Updated {POLICY_META.updatedOn}
              {POLICY_META.officialSource && (
                <>
                  {' · '}
                  <a
                    href={POLICY_META.officialSource.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mandateExtLink"
                  >
                    Official doc{' '}
                    <ExternalLink
                      size={12}
                      strokeWidth={1.75}
                      aria-hidden
                      style={{ verticalAlign: -1 }}
                    />
                  </a>
                </>
              )}
            </p>
            <p className="metaMuted" style={{ marginTop: 8 }}>
              Translations:{' '}
              {POLICY_META.translations.map((t, i) => (
                <span key={t.lang}>
                  {i > 0 && ' · '}
                  <a
                    href={t.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mandateExtLink"
                  >
                    {t.lang}
                  </a>
                </span>
              ))}
            </p>
          </div>

          {!showFull ? (
            <div className="card mandateExpandCard">
              <p className="meta" style={{ marginBottom: 12 }}>
                The full Membership Policy is required before creating an
                account. It is longer legal text — open it when you are ready to
                read.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={openFullPolicy}
              >
                <ScrollText size={16} strokeWidth={1.75} aria-hidden />
                Read full Membership Policy
              </Button>
            </div>
          ) : (
            <div id="full-policy" className="mandatePolicy">
              <p className="metaMuted" style={{ marginBottom: 12 }}>
                Full policy text · scroll to the end to enable the checkbox
              </p>
              {POLICY_SECTIONS.map((section) => (
                <section
                  key={section.id}
                  className="mandateSection"
                  id={`policy-${section.id}`}
                >
                  <h2>{section.heading}</h2>
                  {section.paragraphs?.map((para, i) => (
                    <p
                      key={`${section.id}-p-${i}`}
                      className="meta mandatePara"
                    >
                      {para}
                    </p>
                  ))}
                  {section.bullets?.map((group) => (
                    <div key={group.label} className="mandateBulletGroup">
                      <h3>{group.label}</h3>
                      <ul>
                        {group.items.map((item, i) => (
                          <li key={`${group.label}-${i}`} className="meta">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  {section.paragraphsAfter?.map((para, i) => (
                    <p
                      key={`${section.id}-pa-${i}`}
                      className="meta mandatePara"
                    >
                      {para}
                    </p>
                  ))}
                </section>
              ))}
              <p className="metaMuted mandateEndMark">
                End of policy · version {POLICY_VERSION} · contact{' '}
                <a
                  href={`mailto:${POLICY_META.contactEmail}`}
                  className="mandateExtLink"
                >
                  {POLICY_META.contactEmail}
                </a>
              </p>
            </div>
          )}
        </div>

        <footer className="mandateFooter">
          {!showFull && (
            <p className="mandateScrollHint meta">
              Open the full Membership Policy above to continue
            </p>
          )}
          {showFull && !scrolledToEnd && (
            <p className="mandateScrollHint meta">
              <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
              Scroll to the end of the policy to continue
            </p>
          )}

          <label className={`mandateCheck ${!scrolledToEnd ? 'disabled' : ''}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={!scrolledToEnd}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              I have read and understand the YOUNGO Membership Policy (
              {POLICY_META.issue}, updated {POLICY_META.updatedOn}).
            </span>
          </label>

          <div className="rowBetween" style={{ gap: 12, flexWrap: 'wrap' }}>
            <p className="metaMuted" style={{ flex: 1, minWidth: 160 }}>
              Next: create an account or sign in.
            </p>
            <Button
              variant="primary"
              glow
              disabled={!canContinue}
              onClick={finish}
              aria-disabled={!canContinue}
            >
              <Check size={18} strokeWidth={1.75} aria-hidden />
              Continue to account
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
