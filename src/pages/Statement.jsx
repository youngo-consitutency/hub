import { useApi } from '../lib/api.js'
import { Async } from '../components/ui.jsx'
import { GysSignup } from '../components/GysSignup.jsx'
import { fmtDay } from '../lib/time.js'
import { ScrollText, ArrowUpRight, Flame, Users, Swords, Coins, Sprout } from 'lucide-react'

// One icon per 2025 priority, in statement order.
const PRIORITY_ICON = [Flame, Users, Swords, Coins, Sprout]

export function Statement() {
  const query = useApi('/gys')
  return (
    <div>
      <Async query={query} skeletons={4}>
        {(gys) => {
          const c = gys.current
          return (
            <>
              <p className="eyebrow">YOUNGO · Children and Youth Constituency</p>
              <h1>{c.title}</h1>
              <p className="gysTagline">{c.tagline}</p>

              <div className="gysHero card">
                <blockquote className="gysQuote">“{c.quote}”</blockquote>
                <p className="metaMuted mono">{c.edition} · {c.location} · aimed at {c.targetSession} · published {fmtDay(`${c.publishedOn}T00:00:00Z`, 'UTC')}</p>
                <div className="gysStats">
                  {c.stats.map((s) => (
                    <div key={s.label} className="statBlock">
                      <span className="statValue">{s.value}</span>
                      <span className="metaMuted">{s.label}</span>
                    </div>
                  ))}
                </div>
                <div className="detailActions" style={{ marginTop: 4 }}>
                  <a className="btn btn-primary" href={c.fullUrl} target="_blank" rel="noreferrer">
                    <ScrollText size={18} strokeWidth={1.75} aria-hidden />Read the full statement
                  </a>
                  <a className="btn btn-secondary" href={c.releaseUrl} target="_blank" rel="noreferrer">
                    Read the release<ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                  </a>
                </div>
              </div>

              <p className="meta gysIntro">{c.intro}</p>
              <p className="meta gysIntro">{c.note}</p>
              <div className="rowGap" style={{ marginTop: 12 }}>
                {c.editions.map((e) => <span key={e} className="chip chip-neutral">{e}</span>)}
              </div>

              <div style={{ marginTop: 20 }}><GysSignup /></div>

              <div className="sectionLabel"><span>{c.year} priorities</span></div>
              <div className="grid2">
                {gys.priorities.map((p, i) => {
                  const Icon = PRIORITY_ICON[i] || ScrollText
                  return (
                    <div key={p.title} className="card">
                      <div className="rowGap">
                        <span className="eventIcon"><Icon size={18} strokeWidth={1.75} aria-hidden /></span>
                        <h3 style={{ fontSize: 15 }}>{p.title}</h3>
                      </div>
                      <p className="meta" style={{ marginTop: 8 }}>{p.body}</p>
                    </div>
                  )
                })}
              </div>

              <div className="sectionLabel"><span>How it’s built</span></div>
              <ol className="gysSteps">
                {gys.process.map((s, i) => (
                  <li key={s.step} className="gysStep">
                    <span className="stepNum">{i + 1}</span>
                    <div>
                      <p className="stepHead">{s.step}</p>
                      <p className="meta" style={{ marginTop: 2 }}>{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="sectionLabel"><span>Past statements</span></div>
              <div className="stackSm">
                {gys.archive.map((a) => (
                  <div key={a.edition} className="card cardTight rowBetween">
                    <span>
                      <span className="mono" style={{ color: 'var(--text-2)' }}>{a.year}</span> · {a.edition}
                      <span className="metaMuted" style={{ marginLeft: 8 }}>{a.host}</span>
                    </span>
                    <span className="rowGap">
                      {a.links.map((l) => (
                        <a key={l.url} className="btn btn-ghost btn-sm" href={l.url} target="_blank" rel="noreferrer">
                          {l.label}<ArrowUpRight size={16} strokeWidth={1.75} aria-hidden />
                        </a>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )
        }}
      </Async>
    </div>
  )
}
