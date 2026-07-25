import { useApi } from '../lib/api.js'
import { Async, Empty, Section } from '../components/ui.jsx'
import { Award, BadgeCheck, Trophy } from 'lucide-react'

export function Recognition() {
  const query = useApi('/recognition')

  return (
    <div>
      <p className="metaMuted" style={{ marginBottom: 6 }}>Community</p>
      <h1 className="rowGap"><Trophy size={24} strokeWidth={1.75} aria-hidden /> NGO recognition</h1>
      <p className="meta" style={{ marginTop: 6, maxWidth: 560 }}>
        Organisations that support YOUNGO pool badges and UNFCCC-facing submissions, verified by staff.
        Recognition is hub-only — not an official UNFCCC credential.
      </p>

      <Async query={query} skeletons={4}>
        {(data) => (
          <>
            <Section label="Leaderboard">
              {!data.items?.length
                ? (
                  <Empty
                    icon={Award}
                    title="No points awarded yet"
                    body="When staff verify badge support or UNFCCC submission help, organisations appear here."
                  />
                )
                : (
                  <div className="stackSm">
                    {data.items.map((row) => (
                      <div key={`${row.rank}-${row.name}`} className="card cardTight rowBetween">
                        <div className="rowGap" style={{ alignItems: 'flex-start' }}>
                          <span className="mono" style={{ minWidth: 28, fontWeight: 600, color: 'var(--text-3)' }}>
                            #{row.rank}
                          </span>
                          <div>
                            <strong>{row.name}</strong>
                            {row.tier && (
                              <p className="metaMuted" style={{ marginTop: 4 }}>
                                <BadgeCheck size={14} strokeWidth={1.75} aria-hidden style={{ verticalAlign: -2 }} />
                                {' '}{row.tier}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{row.balance}</p>
                          <p className="metaMuted">points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </Section>

            {data.tiers?.length > 0 && (
              <Section label="Recognition tiers">
                <div className="grid2">
                  {data.tiers.map((t) => (
                    <div key={t.id} className="card cardTight">
                      <h3>{t.label}</h3>
                      <p className="metaMuted" style={{ marginTop: 4 }}>{t.minPoints}+ points</p>
                      <p className="meta" style={{ marginTop: 6 }}>{t.blurb}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {data.note && <p className="metaMuted" style={{ marginTop: 8 }}>{data.note}</p>}
          </>
        )}
      </Async>
    </div>
  )
}
