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
  TbSitemap as Network,
  TbScript as ScrollText,
  TbUsers as Users,
} from 'react-icons/tb'
import { A } from '../../components/ui.jsx'

const MISSION = [
  {
    icon: GraduationCap,
    title: 'Awareness, knowledge & capacity building',
    body: 'We help children and young people understand the UN climate process and build the skills to take part in it — from first-time followers to trained negotiators.',
  },
  {
    icon: Handshake,
    title: 'Collaboration, cooperation & network',
    body: 'We connect youth-led organisations, groups, delegations, and individuals across every region so local action adds up to a global movement.',
  },
  {
    icon: ScrollText,
    title: 'Policy, lobby & advocacy',
    body: 'We draft, coordinate, and deliver youth policy positions into the UNFCCC process, so the perspectives of young and future generations are heard where decisions are made.',
  },
  {
    icon: Megaphone,
    title: 'Youth action',
    body: 'We turn participation into agency: members run campaigns, actions, and initiatives inside and around the negotiations.',
  },
]

const ORGANISATION = [
  {
    value: 'Flat structure',
    label: 'No hierarchies. Roles facilitate; they do not decide over others.',
  },
  {
    value: 'Consensus',
    label:
      'All decisions are taken by consensus via established decision-making guidelines.',
  },
  {
    value: 'Equal voice',
    label:
      'Every engaging entity — irrespective of an NGO’s scale — has an equal voice.',
  },
  {
    value: 'Since 2009',
    label:
      'The oldest and largest volunteer-run children and youth constituency to a UN convention.',
  },
]

const WHAT_WE_DO = [
  {
    icon: ScrollText,
    title: 'Submissions',
    body: 'Coordinated policy inputs to UNFCCC bodies, sessions, and workshops.',
    href: '/about/faq',
    link: 'How YOUNGO works',
  },
  {
    icon: Gavel,
    title: 'Global Youth Statement',
    body: 'Inputs from young people worldwide, synthesised into the statement presented at each COP.',
    href: '/about/gys',
    link: 'How the statement works',
  },
  {
    icon: MapPin,
    title: 'Conferences of Youth',
    body: 'The annual COY and its local and regional editions (LCOY, RCOY) gather youth ahead of COP.',
    href: '/about/coy',
    link: 'About COY',
  },
  {
    icon: Users,
    title: 'Working groups',
    body: 'Thematic groups — from Adaptation and Finance to Gender and Human Rights — do the day-to-day policy work.',
    href: '/about/working-groups',
    link: 'Explore working groups',
  },
  {
    icon: BookOpen,
    title: 'Science resources',
    body: 'Reviewed research, learning, career, and funding resources for climate action.',
    href: '/about/resources',
    link: 'Browse the Resource Hub',
  },
  {
    icon: Globe,
    title: 'Presence at negotiations',
    body: 'Members follow COP, SB, and intersessional agenda items and coordinate daily as one constituency.',
    href: '/about/faq',
    link: 'Who can join',
  },
]

const PRINCIPLES = [
  'Justice and equity',
  'Dignity, respect and equality',
  'Inclusiveness and diversity',
  'Openness and transparency',
  'Integrity',
  'Impartiality and selflessness',
  'Ambition',
  'Sustainable development',
  'Compassion',
  'Hope',
  'Empowerment',
  'Democracy and consensus',
]

const TIMELINE = [
  {
    year: '2005–2008',
    title: 'The youth climate movement',
    body: 'Young people take part in UNFCCC sessions through observer organisations under the self-organised umbrella of the International Youth Climate Movement (IYCM).',
  },
  {
    year: '2009',
    title: 'Provisional constituency status',
    body: 'Ahead of COP15 in Copenhagen, the UNFCCC Secretariat and member states grant youth provisional observer constituency status — formalised as YOUNGO.',
  },
  {
    year: '2011',
    title: 'Official recognition',
    body: 'The constituency status becomes official. YOUNGO is confirmed as the formal voice of children and youth in UNFCCC processes.',
  },
  {
    year: 'Today',
    title: 'Oldest and largest',
    body: 'More than a decade later, YOUNGO remains volunteer-run and youth-led — the oldest and largest children and youth constituency to a UN convention or entity.',
  },
]

const START_STEPS = [
  {
    icon: HandHeart,
    title: 'Create your free account',
    body: 'Join as an individual or through a youth-led organisation.',
  },
  {
    icon: GraduationCap,
    title: 'Take the short introduction',
    body: 'Learn how YOUNGO works and the principles members share.',
  },
  {
    icon: Network,
    title: 'Find where you fit',
    body: 'Choose working groups, calls, and opportunities that matter to you.',
  },
]

export function SiteHome() {
  return (
    <>
      <section className="siteHero">
        <div className="siteMain">
          <div className="siteHeroLayout">
            <div className="siteHeroCopy">
              <p className="pageEyebrow">
                The official children and youth constituency of the UNFCCC
              </p>
              <h1>Your place in global climate action.</h1>
              <p className="siteHeroLead">
                YOUNGO brings together young people, youth-led organisations,
                groups, and delegations working on climate change. Learn the UN
                climate process, contribute to policy, and meet people taking
                action around the world.
              </p>
              <div className="siteHeroActions">
                <A className="btn btn-primary btn-glow" href="/join">
                  Join YOUNGO — it’s free
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </A>
                <A href="/about/working-groups" className="btn btn-secondary">
                  Explore working groups
                </A>
              </div>
              <p className="siteHeroReassurance">
                Open to children and youth up to 35. No membership fee.
              </p>
            </div>

            <aside className="card siteStartCard" aria-labelledby="start-title">
              <div className="siteStartHeading">
                <p className="pageEyebrow">New here?</p>
                <h2 id="start-title">Start in three simple steps</h2>
              </div>
              <ol className="siteStartList">
                {START_STEPS.map(({ icon: Icon, title, body }, index) => (
                  <li key={title}>
                    <span className="siteStartIcon" aria-hidden>
                      <Icon size={17} strokeWidth={1.75} />
                    </span>
                    <span className="siteStartCopy">
                      <span className="siteStartStepLabel">
                        Step {index + 1}
                      </span>
                      <strong>{title}</strong>
                      <span className="meta">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </section>

      <div className="siteMain">
        <section className="siteSection" aria-labelledby="mission-heading">
          <p className="pageEyebrow">How members make a difference</p>
          <h2 id="mission-heading">Four ways we work</h2>
          <p className="siteSectionLead">
            There is no single way to take part. Start with the work that feels
            most useful to you.
          </p>
          <div className="siteMissionGrid">
            {MISSION.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card siteMissionCard">
                <span className="iconTile" aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <h3>{title}</h3>
                <p className="meta">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="siteSection" aria-labelledby="organised-heading">
          <p className="pageEyebrow">Built for participation</p>
          <h2 id="organised-heading">How YOUNGO is organised</h2>
          <p className="siteSectionLead">
            YOUNGO was designed by young people, for young people — with as
            little hierarchy as possible. Every member is invited to take the
            initiative: start a submission, an action, or a new working group.
          </p>
          <div className="siteOrgGrid">
            {ORGANISATION.map(({ value, label }) => (
              <article key={value} className="card siteOrgCard">
                <strong>{value}</strong>
                <p className="meta">{label}</p>
              </article>
            ))}
          </div>
          <p className="meta siteOrgNote">
            Two Global Focal Points — one from the Global South, one from the
            Global North — are the constituency’s face to the UNFCCC
            Secretariat, COP hosts, and the other constituencies. A Global
            Coordination Team keeps an overview, working groups run
            independently, and the whole constituency meets on a monthly call.
          </p>
        </section>

        <section className="siteSection" aria-labelledby="what-heading">
          <p className="pageEyebrow">Inside the constituency</p>
          <h2 id="what-heading">What you can take part in</h2>
          <div className="siteDoGrid">
            {WHAT_WE_DO.map(({ icon: Icon, title, body, href, link }) => (
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
            ))}
          </div>
        </section>

        <section className="siteSection" aria-labelledby="values-heading">
          <p className="pageEyebrow">How we work together</p>
          <h2 id="values-heading">Values &amp; principles</h2>
          <p className="siteSectionLead">
            Our principles guide how members work together. YOUNGO condemns all
            types of harassment; an internal Awareness Team and a Code of
            Conduct — including an Anti-Harassment Policy — keep the space safe
            and open.
          </p>
          <ul className="sitePrincipleChips" aria-label="YOUNGO principles">
            {PRINCIPLES.map((principle) => (
              <li key={principle} className="chip chip-neutral">
                {principle}
              </li>
            ))}
          </ul>
        </section>

        <section className="siteSection" aria-labelledby="history-heading">
          <p className="pageEyebrow">Where this began</p>
          <h2 id="history-heading">Our history</h2>
          <div className="siteTimeline">
            {TIMELINE.map(({ year, title, body }) => (
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
            <h2 id="cta-heading">Take your seat in the process</h2>
            <p className="meta">
              Membership is free and open to all children and youth up to 35,
              and to youth-led organisations. Register, pass a short membership
              course, and the full Hub opens: calendar, working groups,
              submissions, and more.
            </p>
          </div>
          <A className="btn btn-primary" href="/join">
            Join YOUNGO Hub
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </A>
        </section>
      </div>
    </>
  )
}
