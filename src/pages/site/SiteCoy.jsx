import {
  TbCalendar as CalendarDays,
  TbChevronRight as ChevronRight,
  TbWorld as Globe,
  TbMap as Map,
  TbMapPin as MapPin,
  TbVideo as Video,
  TbArrowUpRight as ArrowUpRight,
} from 'react-icons/tb'
import { A, Async, Empty } from '../../components/ui.jsx'
import { useApi } from '../../lib/api.js'

const FORMATS = [
  {
    icon: Globe,
    title: 'COY — the global Conference of Youth',
    body: 'The most important annual event of YOUNGO. It is usually organised in the same city as the COP and takes place in the days preceding it, gathering members of the constituency and youth interested in YOUNGO’s work. Its outputs feed formally into YOUNGO’s work at the COP.',
  },
  {
    icon: Map,
    title: 'RCOY — Regional COY',
    body: 'Regional Conferences of Youth bring the process to each UN region, so young people who cannot travel to the global COY still shape the collective input.',
  },
  {
    icon: MapPin,
    title: 'LCOY — Local COY',
    body: 'Local Conferences of Youth are organised by YOUNGO members in countries and cities worldwide. The LCOY name is collectively owned by YOUNGO and its use is endorsed through an official approval process.',
  },
  {
    icon: Video,
    title: 'vCOY — virtual COY',
    body: 'The virtual Conference of Youth keeps the process open year-round, in line with YOUNGO’s mandate and policy processes aimed towards the UN and especially the UNFCCC.',
  },
]

const STATUS_LABEL = {
  announced: ['chip-neutral', 'Announced soon'],
  registration_open: ['chip-accent', 'Registration open'],
  applications_open: ['chip-warn', 'Applications open'],
  concluded: ['chip-neutral', 'Concluded'],
  cancelled: ['chip-danger', 'Cancelled'],
}

const REGION_LABEL = {
  africa: 'Africa',
  apac: 'Asia-Pacific',
  eca: 'Europe & Central Asia',
  lac: 'Latin America & the Caribbean',
  mena: 'Middle East & North Africa',
  noram: 'North America',
  weog: 'Western Europe & Others',
}

function CoyRow({ coy }) {
  const [chipClass, chipLabel] = STATUS_LABEL[coy.status] || [
    'chip-neutral',
    coy.status,
  ]
  const place = [coy.city, coy.country].filter(Boolean).join(', ')
  return (
    <li className="siteCoyRow">
      <div className="siteCoyIdentity">
        <h3>{coy.title}</h3>
        <p className="metaMuted">
          {coy.type === 'coy'
            ? 'Global Conference of Youth'
            : coy.type === 'rcoy'
              ? 'Regional Conference of Youth'
              : coy.type === 'lcoy'
                ? 'Local Conference of Youth'
                : 'Conference of Youth'}
          {place ? ` · ${place}` : ''}
          {coy.region && !place
            ? ` · ${REGION_LABEL[coy.region] || coy.region}`
            : coy.region && place
              ? ` (${REGION_LABEL[coy.region] || coy.region})`
              : ''}
        </p>
      </div>
      <span className={`chip ${chipClass}`}>{chipLabel}</span>
    </li>
  )
}

export function SiteCoy() {
  const query = useApi('/coys')

  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">The annual gathering</p>
        <h1>The Conference of Youth</h1>
        <p className="sitePageLead">
          The Conference of Youth (COY) is YOUNGO’s most important annual event
          and is rooted in a long history. It serves as a gathering of members
          of the constituency and youth interested in the work of YOUNGO —
          usually in the same city as the COP, in the days preceding it. Local
          and regional editions feed into it, and its outputs culminate in the
          Global Youth Statement presented at the COP.
        </p>
      </header>

      <section className="siteSection" aria-labelledby="formats-heading">
        <div className="siteSectionHeadingRow">
          <h2 id="formats-heading">The COY family</h2>
          <a
            className="btn btn-secondary btn-sm"
            href="https://climatecoy.com/"
            target="_blank"
            rel="noreferrer"
          >
            Official COY site
            <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
          </a>
        </div>
        <div className="siteFormatGrid">
          {FORMATS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="card siteFormatCard">
              <span className="iconTile" aria-hidden>
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <h3>{title}</h3>
              <p className="meta">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="siteSection" aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading">This cycle</h2>
        <p className="siteSectionLead">
          Conferences of Youth currently listed by the constituency. Dates and
          registration details are confirmed by each organising team.
        </p>
        <Async
          query={query}
          empty={(data) =>
            data.items.length === 0 ? (
              <Empty
                icon={CalendarDays}
                title="No COYs listed yet"
                body="Conferences for this cycle are announced as teams are endorsed."
              />
            ) : null
          }
        >
          {(data) => {
            const global = data.items.filter((c) => c.type === 'coy')
            const regional = data.items.filter((c) => c.type !== 'coy')
            return (
              <div className="stack">
                {global.length > 0 && (
                  <ul className="card siteCoyList">
                    {global.map((coy) => (
                      <CoyRow key={coy.slug} coy={coy} />
                    ))}
                  </ul>
                )}
                {regional.length > 0 && (
                  <ul className="card siteCoyList">
                    {regional.map((coy) => (
                      <CoyRow key={coy.slug} coy={coy} />
                    ))}
                  </ul>
                )}
                <p className="metaMuted">
                  Members can follow dates, registration links, and statuses in
                  the{' '}
                  <A href="/coys" className="inlineLink">
                    Hub COY tracker
                  </A>
                  .
                </p>
              </div>
            )
          }}
        </Async>
      </section>

      <section className="siteCtaBand card">
        <CalendarDays size={24} strokeWidth={1.75} aria-hidden />
        <div>
          <h2>Be part of the next COY</h2>
          <p className="meta">
            Every COY is run by volunteer teams — coordinators, delegates, and
            organisers from around the world. Join the Hub to find your regional
            team and take part.
          </p>
        </div>
        <A className="btn btn-primary" href="/join">
          Join YOUNGO Hub
          <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
        </A>
      </section>
    </div>
  )
}
