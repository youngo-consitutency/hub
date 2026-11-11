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

// eyebrow, heading and optional lead shared by every home section
function SectionIntro({ id, eyebrow, title, lead }: AnyValue) {
  return (
    <header className="siteSectionIntro">
      {eyebrow && <p className="pageEyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {lead && <p className="siteSectionLead">{lead}</p>}
    </header>
  )
}

// the public home page, rendered from the cms `site` document
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

  // each section's layout follows its content: ideas, facts, places, values,
  // dates. take-part tiles are whole links, one big target per destination
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
          <SectionIntro {...mission} id="mission-heading" />
          <ul className="siteIdeas">
            {(mission.items || []).map(({ icon, title, body }: AnyValue) => {
              const Icon = iconFor(icon)
              return (
                <li key={title}>
                  <Icon size={28} strokeWidth={1.5} aria-hidden />
                  <h3>{title}</h3>
                  <p className="meta">{body}</p>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <section className="siteBand" aria-labelledby="organised-heading">
        <div className="siteMain siteBandInner">
          <SectionIntro {...organisation} id="organised-heading" />
          <dl className="siteFacts">
            {(organisation.stats || []).map(({ value, label }: AnyValue) => (
              <div key={value}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          {organisation.note && <p className="siteBandNote">{organisation.note}</p>}
        </div>
      </section>

      <div className="siteMain">
        <section className="siteSection" aria-labelledby="what-heading">
          <SectionIntro {...takePart} id="what-heading" />
          <ul className="siteTiles">
            {(takePart.items || []).map(({ icon, title, body, href, link }: AnyValue) => {
              const Icon = iconFor(icon)
              return (
                <li key={title}>
                  <A href={href} className="siteTile">
                    <span className="iconTile" aria-hidden>
                      <Icon size={20} strokeWidth={1.75} />
                    </span>
                    <h3>{title}</h3>
                    <p className="meta">{body}</p>
                    <span className="siteTileAction">
                      {link}
                      <ChevronRight size={15} strokeWidth={1.75} aria-hidden />
                    </span>
                  </A>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="siteSection siteSplit" aria-labelledby="values-heading">
          <SectionIntro {...principles} id="values-heading" />
          <ul className="sitePrinciples" aria-label="YOUNGO principles">
            {(principles.items || []).map((principle: AnyValue) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
        </section>

        <section className="siteSection" aria-labelledby="history-heading">
          <SectionIntro {...history} id="history-heading" />
          <ol className="siteHistory">
            {(history.items || []).map(({ year, title, body }: AnyValue) => (
              <li key={year}>
                <span className="siteHistoryYear mono">{year}</span>
                <h3>{title}</h3>
                <p className="meta">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="siteCta" aria-labelledby="cta-heading">
        <div className="siteMain siteCtaInner">
          <h2 id="cta-heading">{cta.title}</h2>
          <p>{cta.body}</p>
          <A className="btn btn-primary btn-glow" href="/join">
            {cta.label}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </A>
        </div>
      </section>
    </>
  )
}
