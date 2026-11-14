import { createElement } from 'react'
import type { AnyValue } from '../../lib/types'
import { Ripple } from '../../components/fx/Ripple'
import { BorderBeam } from '../../components/fx/BorderBeam'
import { motion } from 'motion/react'
import {
  TbAward as Award,
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
  TbUserCheck as UserCheck,
  TbUsers as Users,
  TbEye as Eye,
  TbScale as Scale,
  TbShieldCheck as ShieldCheck,
  TbSeedling as Seeding,
  TbMoodSmile as Smile,
  TbSparkles as Sparkles,
  TbRocket as Rocket,
  TbHeart as Heart,
  TbUsersGroup as UsersGroup,
  TbMessages as Messages,
} from 'react-icons/tb'
import { A, Skeletons, ErrorCard, Empty } from '../../components/ui'
import { useDocument } from '../../lib/documents'
import { inView, reveal, rise } from '../../lib/motion'
import { HeroCommunity } from './HeroCommunity'
import { JoinButton } from './JoinButton'
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

// heading and optional lead shared by every home section
function SectionIntro({ id, title, lead }: AnyValue) {
  return (
    <header className="ldIntro">
      <h2 id={id}>{title}</h2>
      {lead && <p className="ldLead">{lead}</p>}
    </header>
  )
}

// principles are CMS text, so icons follow the wording; anything new falls back to a leaf
const PRINCIPLE_ICONS: [RegExp, typeof Leaf][] = [
  [/justice|equity|impartial/i, Scale],
  [/dignity|compassion/i, Heart],
  [/inclusiv|divers/i, UsersGroup],
  [/open|transparen/i, Eye],
  [/integrity/i, ShieldCheck],
  [/ambition|empower/i, Rocket],
  [/sustainab/i, Seeding],
  [/hope/i, Smile],
  [/consensus|democra|dialog/i, Messages],
  [/innovat|creativ/i, Sparkles],
]
const principleIcon = (text: string) => PRINCIPLE_ICONS.find(([re]) => re.test(text))?.[1] ?? Leaf

// the four milestones are in a fixed order, so icons follow position
const MILESTONE_ICONS = [Leaf, UserCheck, Award, Globe]

function PrincipleChip({ text }: { text: string }) {
  return (
    <li>
      {createElement(principleIcon(text), { size: 17, strokeWidth: 1.5, 'aria-hidden': true })}
      {text}
    </li>
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
  const { hero = {}, takePart = {}, principles = {}, history = {}, cta = {} } = home

  // the last two words of the headline carry the gradient
  const words: string[] = (hero.title || '').split(' ')
  const lead = words.slice(0, -2).join(' ')
  const accent = words.slice(-2).join(' ')
  const principleItems: string[] = principles.items || []
  const items: AnyValue[] = takePart.items || []

  return (
    <>
      <section className="ldHero ldDark">
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
              <JoinButton label={hero.joinLabel} glow />
              <A href="/our-work#working-groups" className="btn btn-secondary btn-lg">
                <Users size={18} strokeWidth={1.75} aria-hidden />
                {hero.exploreLabel}
              </A>
            </div>
            <p className="ldFine">{hero.reassurance}</p>
          </div>
          <HeroCommunity label="Your seat" />
        </div>
        {/* the track repeats once so the loop is seamless; the copy is hidden from readers */}
        <div className="ldMarquee">
          <ul className="ldTrack" aria-label="YOUNGO principles">
            {principleItems.map((item) => (
              <PrincipleChip key={item} text={item} />
            ))}
          </ul>
          <ul className="ldTrack ldTrackCopy" aria-hidden>
            {principleItems.map((item) => (
              <PrincipleChip key={item} text={item} />
            ))}
          </ul>
        </div>
      </section>
      <section className="ldSection ldWrap" aria-labelledby="what-heading">
        <SectionIntro {...takePart} id="what-heading" />
        <motion.ul className="ldGrid ldGrid3" {...reveal}>
          {items.map(({ icon, title, body, href, link }: AnyValue) => {
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
          <motion.ol {...reveal}>
            {(history.items || []).map(({ year, title, body }: AnyValue, i: number) => {
              const MilestoneIcon = MILESTONE_ICONS[i % MILESTONE_ICONS.length]
              return (
                <motion.li key={year} variants={rise}>
                  <span className="ldYear">
                    <MilestoneIcon size={20} strokeWidth={1.5} aria-hidden />
                    {year}
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </motion.li>
              )
            })}
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
          <JoinButton label={cta.label} glow />
        </div>
      </section>
    </>
  )
}
