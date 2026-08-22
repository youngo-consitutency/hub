import { useApi } from '../lib/api.js'
import { Async, Empty, PageHeader, Section } from '../components/ui.jsx'
import { Award } from 'lucide-react'

export function Recognition() {
  const query = useApi('/recognition')

  return (
    <div>
      <PageHeader
        eyebrow="Community"
        title="NGO recognition"
        description="YOUNGO recognises verified organisational support for constituency work, including badge support and UNFCCC submissions."
      />

      <Async query={query} skeletons={4}>
        {(data) => (
          <>
            <Section label="Leaderboard">
              {!data.items?.length ? (
                <div className="recognitionEmpty">
                  <Empty
                    icon={Award}
                    title="No points awarded yet"
                    body="When staff verify badge support or UNFCCC submission help, organisations appear here."
                  />
                </div>
              ) : (
                <div className="recognitionRankGrid">
                  {data.items.map((row) => (
                    <div
                      key={`${row.rank}-${row.name}`}
                      className="card cardTight recognitionRank"
                    >
                      <div className="recognitionRankIdentity">
                        <span className="mono recognitionRankNumber">
                          #{row.rank}
                        </span>
                        <div>
                          <strong>{row.name}</strong>
                          {row.tier && (
                            <p className="metaMuted recognitionRankTier">
                              {row.tier} tier
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="recognitionPoints">
                        <p className="mono recognitionPointsValue">
                          {row.balance}
                        </p>
                        <p className="metaMuted">points</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {data.tiers?.length > 0 && (
              <Section label="Recognition tiers">
                <ol className="recognitionLadder">
                  {data.tiers.map((tier, index) => (
                    <li key={tier.id} className="card recognitionTier">
                      <div className="recognitionTierMarker" aria-hidden>
                        {index + 1}
                      </div>
                      <div className="recognitionTierCopy">
                        <div className="recognitionTierHeading">
                          <h3>{tier.label}</h3>
                          <span className="chip chip-neutral">
                            {tier.minPoints}+ points
                          </span>
                        </div>
                        <p className="meta">{tier.blurb}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Section>
            )}

            {data.note && (
              <aside className="recognitionNote metaMuted">{data.note}</aside>
            )}
          </>
        )}
      </Async>
    </div>
  )
}
