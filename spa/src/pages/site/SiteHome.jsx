import {
  TbBook as BookOpen,
  TbChevronRight as ChevronRight,
  TbGavel as Gavel,
  TbWorld as Globe,
  TbSchool as GraduationCap,
  TbHeartHandshake as HandHeart,
  TbHeartHandshake as Handshake,
  TbMapPin as MapPin,
  TbSpeakerphone as Megaphone,
  TbScript as ScrollText,
  TbUsers as Users,
} from 'react-icons/tb'
import { A, Skeletons } from '../../components/ui.jsx'
import { useDocument } from '../../lib/documents.js'
import { UpcomingEvents } from './UpcomingEvents.jsx'

// Icon names are stored in the site document; components live here.
const ICONS = {
  GraduationCap,
  Handshake,
  ScrollText,
  Megaphone,
  Gavel,
  MapPin,
  Users,
  BookOpen,
  Globe,
  HandHeart,
}
const iconFor = (name) => ICONS[name] || Users

export function SiteHome() {
  const { doc: site, loading } = useDocument('site')
  const home = site?.home
  if (!home) return loading ? <Skeletons n={5} /> : null
  const { hero, mission, organisation, takePart, principles, history, cta } = home

  return (
    <>
      <section className="siteHero">
        <div className="siteMain">
          <div className="siteHeroLayout">
            <div className="siteHeroCopy">
              <p className="pageEyebrow">{hero.eyebrow}</p>
              <h1>{hero.title}</h1>
              <p className="siteHeroLead">{hero.lead}</p>
              <div className="siteHeroActions">
                <A className="btn btn-primary btn-glow" href="/join">
                  {hero.joinLabel}
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </A>
                <A href="/about/working-groups" className="btn btn-secondary">
                  {hero.exploreLabel}
                </A>
              </div>
              <p className="siteHeroReassurance">{hero.reassurance}</p>
            </div>

            <UpcomingEvents />
          </div>
        </div>
      </section>

      <div className="siteMain">
        <section className="siteSection" aria-labelledby="mission-heading">
          <p className="pageEyebrow">{mission.eyebrow}</p>
          <h2 id="mission-heading">{mission.title}</h2>
          <p className="siteSectionLead">{mission.lead}</p>
          <div className="siteMissionGrid">
            {(mission.items || []).map(({ icon, title, body }) => {
              const Icon = iconFor(icon)
              return (
                <article key={title} className="card siteMissionCard">
                  <span className="iconTile" aria-hidden>
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <h3>{title}</h3>
                  <p className="meta">{body}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="siteSection" aria-labelledby="organised-heading">
          <p className="pageEyebrow">{organisation.eyebrow}</p>
          <h2 id="organised-heading">{organisation.title}</h2>
          <p className="siteSectionLead">{organisation.lead}</p>
          <div className="siteOrganisationGrid">
            {(organisation.stats || []).map(({ value, label }) => (
              <article key={value} className="card siteOrgCard">
                <strong>{value}</strong>
                <p className="meta">{label}</p>
              </article>
            ))}
          </div>
          <p className="meta siteOrgNote">{organisation.note}</p>
        </section>

        <section className="siteSection" aria-labelledby="what-heading">
          <p className="pageEyebrow">{takePart.eyebrow}</p>
          <h2 id="what-heading">{takePart.title}</h2>
          <div className="siteActivityGrid">
            {(takePart.items || []).map(({ icon, title, body, href, link }) => {
              const Icon = iconFor(icon)
              return (
                <article key={title} className="card siteDoCard">
                  <span className="iconTile" aria-hidden>
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p className="meta">{body}</p>
                    <A href={href} className="siteDoLink">
                      {link}
                      <ChevronRight size={15} strokeWidth={1.75} aria-hidden />
                    </A>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section
          className="siteSection siteValuesSection"
          aria-labelledby="values-heading"
        >
          <p className="pageEyebrow">{principles.eyebrow}</p>
          <h2 id="values-heading">{principles.title}</h2>
          <p className="siteSectionLead">{principles.lead}</p>
          <ul className="sitePrincipleChips" aria-label="YOUNGO principles">
            {(principles.items || []).map((principle) => (
              <li key={principle} className="chip chip-neutral">
                {principle}
              </li>
            ))}
          </ul>
        </section>

        <section className="siteSection" aria-labelledby="history-heading">
          <p className="pageEyebrow">{history.eyebrow}</p>
          <h2 id="history-heading">{history.title}</h2>
          <div className="siteTimeline">
            {(history.items || []).map(({ year, title, body }) => (
              <article key={year} className="siteTimelineItem">
                <span className="siteTimelineYear mono">{year}</span>
                <div>
                  <h3>{title}</h3>
                  <p className="meta">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="siteCtaBand card" aria-labelledby="cta-heading">
          <HandHeart size={24} strokeWidth={1.75} aria-hidden />
          <div>
            <h2 id="cta-heading">{cta.title}</h2>
            <p className="meta">{cta.body}</p>
          </div>
          <A className="btn btn-primary" href="/join">
            {cta.label}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </A>
        </section>
      </div>
    </>
  )
}
