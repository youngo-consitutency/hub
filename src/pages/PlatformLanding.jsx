import { useEffect } from 'react'
import {
  TbArrowRight as ArrowRight,
  TbBook2 as BookOpen,
  TbCalendarTime as Calendar,
  TbChecks as Checks,
  TbChevronDown as ChevronDown,
  TbFileDescription as FileText,
  TbFingerprint as Fingerprint,
  TbGavel as Gavel,
  TbShieldCheck as ShieldCheck,
  TbUsersGroup as Users,
} from 'react-icons/tb'
import { LandingSignIn } from '../components/auth/LandingSignIn.jsx'
import { Brand } from '../components/Brand.jsx'
import { A } from '../components/ui.jsx'

const MODULES = [
  {
    icon: Calendar,
    title: 'Calendar',
    body: 'See upcoming meetings, calls, events, and deadlines, with calendar links when you need them.',
  },
  {
    icon: Users,
    title: 'Working groups',
    body: 'Read what each group does and how to join the spaces that already exist in YOUNGO.',
  },
  {
    icon: FileText,
    title: 'Submissions',
    body: 'Follow open policy inputs and know when YOUNGO is asking for contributions.',
  },
  {
    icon: Gavel,
    title: 'Decisions',
    body: 'Find constituency decisions without searching through old chat threads.',
  },
  {
    icon: BookOpen,
    title: 'Resources',
    body: 'Look up reviewed knowledge when you need to brief someone or find your way in.',
  },
]

const STEPS = [
  {
    title: 'Create a Hub account',
    body: 'Register as an individual or a youth-led organisation so member information is available to you.',
  },
  {
    title: 'Learn YOUNGO’s shared ground',
    body: 'A short introduction to structure and principles — the same ground the constituency already uses.',
  },
  {
    title: 'Find where you fit',
    body: 'Follow the groups, calls, and deadlines that match your interests. The work itself stays with YOUNGO.',
  },
]

const TRUST = [
  {
    icon: Fingerprint,
    title: 'Private by design',
    body: 'Access is checked at the source. Personal account details stay outside Hub search.',
  },
  {
    icon: Checks,
    title: 'Evidence over guesswork',
    body: 'Search answers keep their sources and a verification note, so you can check before you act.',
  },
  {
    icon: ShieldCheck,
    title: 'People approve important changes',
    body: 'Research cannot directly change governance, membership, events, submissions, or messages.',
  },
]

function PlatformHeader() {
  return (
    <header className="platformHeader">
      <div className="platformHeaderInner">
        <A href="/" className="platformBrand" aria-label="YOUNGO Hub home">
          <Brand />
        </A>
        <nav className="platformNav" aria-label="Platform overview">
          <a href="#what-it-does">What you can look up</a>
          <a href="#how-it-works">Getting oriented</a>
          <a href="#trust">Trust</a>
          <A href="/about">About YOUNGO</A>
        </nav>
        <div className="platformHeaderActions">
          <a className="platformSignIn" href="#signin">
            Sign in
          </a>
          <A className="btn btn-primary platformJoinButton" href="/join">
            Join
            <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </A>
        </div>
      </div>
    </header>
  )
}

function PlatformFooter() {
  return (
    <footer className="platformFooter">
      <div className="platformFooterInner">
        <div className="platformFooterLead">
          <Brand />
          <p>
            An information tool for members of the children and youth
            constituency of the UNFCCC.
          </p>
        </div>
        <nav aria-label="Platform links">
          <A href="/about">About YOUNGO</A>
          <A href="/about/working-groups">Working groups</A>
          <A href="/about/resources">Resources</A>
          <a href="/privacy">Privacy</a>
        </nav>
        <div className="platformFooterActions">
          <A href="/signin">Sign in</A>
          <A className="btn btn-primary" href="/join">
            Join the Hub
            <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </A>
        </div>
      </div>
      <p className="platformFooterLegal">
        Hub accounts are free · Built with youth, for youth · YOUNGO Hub
      </p>
    </footer>
  )
}

/** Signed-out front door: an information tool for how to engage with YOUNGO. */
export function PlatformLanding({ onAuthenticated }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'YOUNGO Hub · How to take part'
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="platformLanding">
      <a className="skipLink" href="#platform-main">
        Skip to main content
      </a>
      <PlatformHeader />

      <main id="platform-main" tabIndex="-1">
        <section className="platformHero" aria-labelledby="platform-title">
          <div className="platformHeroInner">
            <div className="platformHeroCopy">
              <p className="platformKicker">
                For members of YOUNGO · UNFCCC children and youth constituency
              </p>
              <h1 id="platform-title">See how to take part.</h1>
              <p className="platformHeroLead">
                The Hub is an information tool for YOUNGO members. It gathers
                meetings, working groups, submissions, and decisions so you can
                find where to engage — the work itself stays with the
                constituency.
              </p>
              <ul className="platformBenefitList">
                <li>What is coming up this week</li>
                <li>Which working groups you can join</li>
                <li>Open submissions and recent decisions</li>
              </ul>
              <div className="platformHeroActions">
                <A className="btn btn-primary platformHeroPrimary" href="/join">
                  Create a Hub account
                  <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </A>
                <a className="platformTextLink" href="#what-it-does">
                  What you can look up
                  <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
                </a>
              </div>
              <p className="platformReassurance">
                For individual members and youth-led organisations. Designed for
                phones and slower connections.
              </p>
            </div>
            <LandingSignIn onAuthenticated={onAuthenticated} />
          </div>
        </section>

        <section
          className="platformSection platformModulesSection"
          id="what-it-does"
          aria-labelledby="modules-title"
        >
          <div className="platformSectionInner">
            <div className="platformSectionHeading">
              <div>
                <p className="platformSectionLabel">What you can look up</p>
                <h2 id="modules-title">A map of how YOUNGO engages.</h2>
              </div>
              <p>
                Use it to find the meeting, the group, or the deadline. Members,
                contact points, teams, and organisations each see the
                information attached to their responsibilities.
              </p>
            </div>
            <ul className="platformModuleGrid">
              {MODULES.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <span className="platformModuleIcon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.7} />
                  </span>
                  <strong>{title}</strong>
                  <p>{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className="platformSection platformStepsSection"
          id="how-it-works"
          aria-labelledby="steps-title"
        >
          <div className="platformSectionInner">
            <div className="platformSectionHeading platformStepsHeading">
              <div>
                <p className="platformSectionLabel">Getting oriented</p>
                <h2 id="steps-title">From curious to finding your place.</h2>
              </div>
              <p>
                You do not need to already know the UN climate process. The Hub
                helps you see how YOUNGO works, so you can take part in it.
              </p>
            </div>
            <ol className="platformSteps">
              {STEPS.map(({ title, body }, index) => (
                <li key={title}>
                  <span className="platformStepNumber">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="platformStepConnector" aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="platformTrust"
          id="trust"
          aria-labelledby="trust-title"
        >
          <div className="platformSectionInner platformTrustInner">
            <div className="platformTrustStatement">
              <p className="platformSectionLabel">Trust is infrastructure</p>
              <h2 id="trust-title">
                Open enough to collaborate. Careful enough to belong here.
              </h2>
              <p>
                Youth participation needs clear permissions, verifiable
                information, and human judgment around consequential actions.
              </p>
            </div>
            <div className="platformTrustList">
              {TRUST.map(({ icon: Icon, title, body }) => (
                <article key={title}>
                  <span aria-hidden="true">
                    <Icon size={20} strokeWidth={1.7} />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="platformFinalCta" aria-labelledby="final-cta-title">
          <p className="platformSectionLabel">Ready when you are</p>
          <h2 id="final-cta-title">Look up how to engage, then take part.</h2>
          <p>
            Hub accounts are free. A short introduction unlocks member
            information. YOUNGO’s own processes stay where they are.
          </p>
          <div className="platformFinalActions">
            <A className="btn btn-primary" href="/join">
              Create a Hub account
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </A>
            <a className="btn btn-secondary" href="#signin">
              I already have an account
            </a>
          </div>
        </section>
      </main>

      <PlatformFooter />
    </div>
  )
}
