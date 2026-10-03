import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { useAccount } from '../lib/accountContext'
import { A, Button, Skeletons, ErrorCard, PageHeader } from '../components/ui'
import { navigate } from '../lib/router'
import {
  TbArrowLeft as ArrowLeft,
  TbCheck as Check,
  TbChevronLeft as ChevronLeft,
  TbChevronRight as ChevronRight,
} from 'react-icons/tb'

export function Course() {
  const { account, setAccount } = useAccount()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const [step, setStep] = useState('modules') // modules | quiz | done
  const [moduleIdx, setModuleIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)

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

  const submitQuiz = async (e: any) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiPost('/member/course/submit', { answers })
      setResult(res)
      setAccount(res.account)
      setStep('done')
    } catch (err) {
      setError((err as any).message)
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
              Score {result.score}/{result.total}. Your account can use the full hub.
            </p>
          </div>
        </div>
        <p className="meta mandatePara">
          Next, browse Working groups and complete the introduction for any group you want to join.
          Use Calendar for meetings and Submissions for current drafting processes.
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
      <PageHeader
        title="Membership course"
        description={`Version ${data.version} · Pass score: ${data.passScore}/${data.quiz.length}.${account?.isVerified ? ' You already passed — review anytime.' : ''}`}
      />

      {step === 'modules' && mod && (
        <>
          <div className="card courseModuleCard">
            <div className="courseModuleHeader">
              <div>
                <p className="metaMuted">
                  Module {moduleIdx + 1} of {data.modules.length} · ~{mod.minutes} min
                </p>
                <h2>{mod.title}</h2>
              </div>
              <div className="courseModuleNavigation" aria-label="Course modules">
                <button
                  type="button"
                  className="iconButton"
                  aria-label="Previous module"
                  disabled={moduleIdx === 0}
                  onClick={() => setModuleIdx((i) => i - 1)}
                >
                  <ChevronLeft size={20} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="iconButton"
                  aria-label="Next module"
                  disabled={lastModule}
                  onClick={() => setModuleIdx((i) => i + 1)}
                >
                  <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            </div>
            <div className="stackSm courseModuleBody">
              {mod.body.map((p: any, i: any) => (
                <p key={i} className="meta mandatePara">
                  {p}
                </p>
              ))}
            </div>
          </div>
          {lastModule && (
            <div className="courseModuleAction">
              <Button variant="primary" glow onClick={() => setStep('quiz')}>
                Start the membership test
              </Button>
            </div>
          )}
        </>
      )}

      {step === 'quiz' && (
        <form className="stack" style={{ marginTop: 16 }} onSubmit={submitQuiz}>
          {data.quiz.map((q: any, qi: any) => (
            <div key={q.id} className="card">
              <h3>
                {qi + 1}. {q.prompt}
              </h3>
              <div className="stackSm" style={{ marginTop: 10 }}>
                {q.choices.map((c: any) => (
                  <label
                    key={c.id}
                    className={`authChoice ${answers[q.id] === c.id ? 'active' : ''}`}
                    style={{ display: 'block' }}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={answers[q.id] === c.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
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
          <div className="courseQuizActions">
            <Button type="button" variant="secondary" onClick={() => setStep('modules')}>
              <ArrowLeft size={18} strokeWidth={2} aria-hidden />
              Back to modules
            </Button>
            <Button type="submit" variant="primary" glow disabled={submitting}>
              {submitting ? 'Checking…' : 'Submit and continue'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
