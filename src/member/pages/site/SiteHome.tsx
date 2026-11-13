import type { AnyValue } from '../../lib/types'
import { Ripple } from '../../components/fx/Ripple'
import { BorderBeam } from '../../components/fx/BorderBeam'
import { MotionConfig, motion } from 'motion/react'
import {
  TbBook as BookOpen,
  TbArrowUpRight as ArrowUpRight,
  TbChevronRight as ChevronRight,
  TbGavel as Gavel,
  TbLeaf as Leaf,
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
import { useSignedIn } from '../../lib/useSignedIn'
import { useDocument } from '../../lib/documents'
import { inView, rise, stagger } from '../../lib/motion'
import { HeroCommunity } from './HeroCommunity'
import { HubPulse } from './HubPulse'

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
    <header className="ldIntro">
      {eyebrow && <p className="ldEyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {lead && <p className="ldLead">{lead}</p>}
    </header>
  )
}

// the public home page, rendered from the cms `site` document
export function SiteHome() {
  const { doc: site, loading, error, retry } = useDocument('site')
  const signedIn = useSignedIn()
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
    organisation = {},
    takePart = {},
    principles = {},
    history = {},
    cta = {},
  } = home

  // the last two words of the headline carry the gradient
  const words: string[] = (hero.title || '').split(' ')
  const lead = words.slice(0, -2).join(' ')
  const accent = words.slice(-2).join(' ')
  const principleItems: string[] = principles.items || []

  return (
    <MotionConfig reducedMotion="user">
      <section className="ldHero ldDark">
        <div className="ldContour" aria-hidden />
        <div className="ldAurora" aria-hidden />
        <div className="ldWrap ldHeroGrid">
          <div className="ldHeroCopy">
            <p className="ldChip">
              <Leaf size={15} strokeWidth={1.75} aria-hidden />
              {hero.eyebrow}
            </p>
            <h1>
              {lead} <span className="ldGradient">{accent}</span>
            </h1>
            <p className="ldHeroLead">{hero.lead}</p>
            <div className="ldActions">
              <A className="btn btn-primary btn-glow btn-lg" href={signedIn ? '/' : '/join'}>
                {signedIn ? 'Open your Hub' : hero.joinLabel}
                <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
              </A>
              <A href="/about/working-groups" className="btn btn-secondary btn-lg">
                {hero.exploreLabel}
              </A>
            </div>
            <p className="ldFine">{hero.reassurance}</p>
          </div>
          <HeroCommunity href={signedIn ? '/' : '/join'} label="Your seat" />
        </div>
        {/* the track repeats once so the loop is seamless; the copy is hidden from readers */}
        <div className="ldMarquee">
          <ul className="ldTrack" aria-label="YOUNGO principles">
            {principleItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ul className="ldTrack ldTrackCopy" aria-hidden>
            {principleItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
      <section className="ldBand ldDark" aria-labelledby="organised-heading">
        <div className="ldGridLines" aria-hidden />
        <div className="ldWrap ldBandInner">
          <SectionIntro
            eyebrow={organisation.eyebrow}
            title={organisation.title}
            id="organised-heading"
          />
          <motion.dl
            className="ldFacts"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={inView}
          >
            {(organisation.stats || []).map(({ value, label }: AnyValue) => (
              <motion.div key={value} variants={rise}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </div>
      </section>
      <section className="ldSection ldWrap" aria-labelledby="what-heading">
        <SectionIntro {...takePart} id="what-heading" />
        <motion.ul
          className="ldGrid ldGrid3"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={inView}
        >
          {(takePart.items || []).map(({ icon, title, body, href, link }: AnyValue) => {
            const Icon = iconFor(icon)
            return (
              <motion.li key={title} variants={rise} whileHover={{ y: -4 }}>
                <A href={href} className="ldCard ldTile">
                  <span className="ldTileTop">
                    <span className="ldIcon" aria-hidden>
                      <Icon size={22} strokeWidth={1.5} />
                    </span>
                    <ArrowUpRight className="ldArrow" size={20} strokeWidth={1.75} aria-hidden />
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <span className="ldTileLink">
                    {link}
                    <ChevronRight size={15} strokeWidth={1.75} aria-hidden />
                  </span>
                </A>
              </motion.li>
            )
          })}
        </motion.ul>
      </section>
      <section className="ldSection ldWrap" aria-label="Live from the Hub">
        <HubPulse />
      </section>
      <section className="ldSection ldWrap" aria-labelledby="history-heading">
        <SectionIntro {...history} id="history-heading" />
        <div className="ldTimeline">
          <motion.span
            className="ldRail"
            aria-hidden
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={inView}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <motion.ol variants={stagger} initial="hidden" whileInView="show" viewport={inView}>
            {(history.items || []).map(({ year, title, body }: AnyValue) => (
              <motion.li key={year} variants={rise}>
                <span className="ldYear">{year}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>
      <section className="ldCta ldDark ldWrap" aria-labelledby="cta-heading">
        <div className="ldCtaRipple">
          <Ripple />
        </div>
        <BorderBeam />
        <div className="ldCtaInner">
          <h2 id="cta-heading">{cta.title}</h2>
          <p>{cta.body}</p>
          <A className="btn btn-primary btn-glow btn-lg" href={signedIn ? '/' : '/join'}>
            {signedIn ? 'Open your Hub' : cta.label}
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </A>
        </div>
      </section>
    </MotionConfig>
  )
}
