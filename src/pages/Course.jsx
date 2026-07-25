import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { useAccount } from '../lib/accountContext.jsx'
import { A, Button, Skeletons, ErrorCard } from '../components/ui.jsx'
import { navigate } from '../lib/router.js'
import { Check, GraduationCap } from 'lucide-react'

export function Course() {
  const { account, setAccount } = useAccount()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [step, setStep] = useState('modules') // modules | quiz | done
  const [moduleIdx, setModuleIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  const load = () => {
    setError(null)
    apiGet('/member/course')
      .then(setData)
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    load()
  }, [])

  if (error) return <ErrorCard message={error} onRetry={load} />
  if (!data) return <Skeletons n={4} />

  const mod = data.modules[moduleIdx]
  const lastModule = moduleIdx >= data.modules.length - 1

  const submitQuiz = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiPost('/member/course/submit', { answers })
      setResult(res)
      setAccount(res.account)
      setStep('done')
    } catch (err) {
      setError(err.message)
      setResult({ score: null, passed: false })
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'done' && result?.passed) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '24px auto' }}>
        <div className="rowGap" style={{ marginBottom: 12 }}>
          <span className="iconTile">
            <Check size={22} strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h1>You’re verified</h1>
            <p className="meta" style={{ marginTop: 4 }}>
              Score {result.score}/{result.total}. Your account can use the full
              hub.
            </p>
          </div>
        </div>
        <p className="meta mandatePara">
          Next, browse Working groups and complete the introduction for any
          group you want to join. Use Calendar for meetings and Submissions for
          current drafting processes.
        </p>
        <div className="detailActions">
          <Button variant="primary" glow onClick={() => navigate('/')}>
            Enter platform
          </Button>
          <A href="/groups" className="btn btn-secondary">
            Working groups
          </A>
          <A href="/onboarding" className="btn btn-ghost">
            Onboarding home
          </A>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>
        Membership course · {data.version}
      </p>
      <h1 className="rowGap">
        <GraduationCap size={26} strokeWidth={1.75} aria-hidden /> Membership
        course
      </h1>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        Pass score: {data.passScore}/{data.quiz.length}.
        {account?.isVerified && ' You already passed — review anytime.'}
      </p>

      {step === 'modules' && mod && (
        <div className="card" style={{ marginTop: 16 }}>
          <p className="metaMuted">
            Module {moduleIdx + 1} of {data.modules.length} · ~{mod.minutes} min
          </p>
          <h2 style={{ marginTop: 6 }}>{mod.title}</h2>
          <div className="stackSm" style={{ marginTop: 12 }}>
            {mod.body.map((p, i) => (
              <p key={i} className="meta mandatePara">
                {p}
              </p>
            ))}
          </div>
          <div className="detailActions">
            {moduleIdx > 0 && (
              <Button
                variant="ghost"
                onClick={() => setModuleIdx((i) => i - 1)}
              >
                Back
              </Button>
            )}
            {!lastModule ? (
              <Button
                variant="primary"
                onClick={() => setModuleIdx((i) => i + 1)}
              >
                Next module
              </Button>
            ) : (
              <Button variant="primary" glow onClick={() => setStep('quiz')}>
                Take the test
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 'quiz' && (
        <form className="stack" style={{ marginTop: 16 }} onSubmit={submitQuiz}>
          {data.quiz.map((q, qi) => (
            <div key={q.id} className="card">
              <h3>
                {qi + 1}. {q.prompt}
              </h3>
              <div className="stackSm" style={{ marginTop: 10 }}>
                {q.choices.map((c) => (
                  <label
                    key={c.id}
                    className={`authChoice ${answers[q.id] === c.id ? 'active' : ''}`}
                    style={{ display: 'block' }}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === c.id}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: c.id }))
                      }
                    />
                    <span className="meta">{c.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          {error && (
            <p className="meta" style={{ color: 'var(--danger)' }} role="alert">
              {error}
            </p>
          )}
          <div className="detailActions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep('modules')}
            >
              Back to modules
            </Button>
            <Button type="submit" variant="primary" glow disabled={submitting}>
              {submitting ? 'Checking…' : 'Submit test'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
