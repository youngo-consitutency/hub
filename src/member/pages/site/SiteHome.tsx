import type { AnyValue } from '../../lib/types'
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
import { A, Skeletons, ErrorCard, Empty } from '../../components/ui'
import { useDocument } from '../../lib/documents'
import { UpcomingEvents } from './UpcomingEvents'

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
const iconFor = (name: AnyValue) => (ICONS as AnyValue)[name] || Users

/** Render the public home page from the site document, with loading, retry and unpublished states. */
export function SiteHome() {
  const { doc: site, loading, error, retry } = useDocument('site')
  const home = site?.home
  if (loading)
    return (
      <div className="siteMain">
        <Skeletons n={5} />
      </div>
    )
  if (error)
    return (
      <div className="siteMain">
        <ErrorCard message={error} onRetry={retry} />
      </div>
    )
  if (!home)
    return (
      <div className="siteMain">
        <Empty title="About YOUNGO" body="This page has not been published yet." />
      </div>
    )
  const {
    hero = {},
    mission = {},
    organisation = {},
    takePart = {},
    principles = {},
    history = {},
    cta = {},
  } = home

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
        <section className="siteSection siteEditorialSection" aria-labelledby="mission-heading">
          <div className="siteSectionIntro">
            <p className="pageEyebrow">{mission.eyebrow}</p>
            <h2 id="mission-heading">{mission.title}</h2>
            <p className="siteSectionLead">{mission.lead}</p>
          </div>
          <div className="siteMissionGrid">
            {(mission.items || []).map(({ icon, title, body }: AnyValue) => {
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

        <section className="siteSection siteEditorialSection" aria-labelledby="organised-heading">
          <div className="siteSectionIntro">
            <p className="pageEyebrow">{organisation.eyebrow}</p>
            <h2 id="organised-heading">{organisation.title}</h2>
            <p className="siteSectionLead">{organisation.lead}</p>
          </div>
          <div className="siteOrganisationGrid">
            {(organisation.stats || []).map(({ value, label }: AnyValue) => (
              <article key={value} className="card siteOrgCard">
                <strong>{value}</strong>
                <p className="meta">{label}</p>
              </article>
            ))}
          </div>
          <p className="meta siteOrgNote">{organisation.note}</p>
        </section>

        <section className="siteSection siteEditorialSection" aria-labelledby="what-heading">
          <div className="siteSectionIntro">
            <p className="pageEyebrow">{takePart.eyebrow}</p>
            <h2 id="what-heading">{takePart.title}</h2>
          </div>
          <div className="siteActivityGrid">
            {(takePart.items || []).map(({ icon, title, body, href, link }: AnyValue) => {
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
          className="siteSection siteValuesSection siteEditorialSection"
          aria-labelledby="values-heading"
        >
          <div className="siteSectionIntro">
            <p className="pageEyebrow">{principles.eyebrow}</p>
            <h2 id="values-heading">{principles.title}</h2>
            <p className="siteSectionLead">{principles.lead}</p>
          </div>
          <ul className="sitePrincipleList" aria-label="YOUNGO principles">
            {(principles.items || []).map((principle: AnyValue) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
        </section>

        <section className="siteSection siteEditorialSection" aria-labelledby="history-heading">
          <div className="siteSectionIntro">
            <p className="pageEyebrow">{history.eyebrow}</p>
            <h2 id="history-heading">{history.title}</h2>
          </div>
          <div className="siteTimeline">
            {(history.items || []).map(({ year, title, body }: AnyValue) => (
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
