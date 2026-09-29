import { useMemo, useState } from 'react'
import { useApi } from '../lib/api.js'
import { A, Async, Empty, PageHeader } from '../components/ui.jsx'
import {
  TbArrowUpRight as ArrowUpRight,
  TbSearch as Search,
  TbWorldSearch as WorldSearch,
} from 'react-icons/tb'

export function Negotiations() {
  const [search, setSearch] = useState('')
  const [openOnly, setOpenOnly] = useState(false)
  const query = useApi(`/negotiations${openOnly ? '?openCalls=true' : ''}`, [openOnly])

  return (
    <div>
      <PageHeader
        title="Negotiations"
        description="Source-backed tracks, agenda lineage and contribution calls. Fixture labels indicate development-only evidence."
      />
      <div className="catalogTools">
        <div className="catalogSearchRow">
          <label className="searchInputWrap">
            <span className="srOnly">Search negotiation tracks</span>
            <Search size={18} strokeWidth={1.75} aria-hidden />
            <input
              className="input"
              type="search"
              placeholder="Search track topics or working groups"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button
            className={`btn btn-sm ${openOnly ? 'btn-primary' : 'btn-secondary'}`}
            type="button"
            aria-pressed={openOnly}
            onClick={() => setOpenOnly((value) => !value)}
          >
            Open calls only
          </button>
        </div>
      </div>
      <Async query={query}>{(data) => <TrackResults data={data} search={search} />}</Async>
    </div>
  )
}

function TrackResults({ data, search }) {
  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    if (!needle) return data.items
    return data.items.filter((track) =>
      [track.topic, track.summary, ...(track.workingGroupSlugs || [])]
        .join(' ')
        .toLocaleLowerCase()
        .includes(needle),
    )
  }, [data.items, search])

  if (!items.length)
    return (
      <Empty
        icon={WorldSearch}
        title="No negotiation tracks match"
        body="Try another topic or include tracks without an open call."
      />
    )

  return (
    <div className="cardGrid">
      {items.map((track) => (
        <A className="card entityCard" href={`/negotiations/${track.slug}`} key={track.id}>
          <div className="cardBody">
            <div className="eyebrow">{track.activityStatus}</div>
            <h2>{track.topic}</h2>
            <p className="meta">{track.summary}</p>
            <div className="pillRow">
              {(track.workingGroupSlugs || []).map((slug) => (
                <span className="chip chip-neutral" key={slug}>
                  {slug}
                </span>
              ))}
              <span className="chip chip-neutral">
                {track.openCalls} open {track.openCalls === 1 ? 'call' : 'calls'}
              </span>
            </div>
          </div>
          <ArrowUpRight className="cardCornerIcon" aria-hidden />
        </A>
      ))}
    </div>
  )
}
