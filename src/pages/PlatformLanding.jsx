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
    body: 'Meetings, calls, events, and deadlines, with calendar links ready.',
  },
  {
    icon: Users,
    title: 'Working groups',
    body: 'See what each group does and join the spaces that match your work.',
  },
  {
    icon: FileText,
    title: 'Submissions',
    body: 'Follow open policy inputs and know when your contribution is needed.',
  },
  {
    icon: Gavel,
    title: 'Decisions',
    body: 'Return to constituency decisions without searching old chat threads.',
  },
  {
    icon: BookOpen,
    title: 'Resources',
    body: 'Keep reviewed knowledge findable when you need to brief or share.',
  },
]

const STEPS = [
  {
    title: 'Create a free account',
    body: 'Register as an individual or a youth-led organisation.',
  },
  {
    title: 'Learn the shared ground',
    body: 'Complete the short introduction to YOUNGO’s structure and principles.',
  },
  {
    title: 'Open the tools you need',
    body: 'Choose interests and responsibilities; the matching workspaces appear.',
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
          <a href="#what-it-does">What’s inside</a>
          <a href="#how-it-works">How to join</a>
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
            The shared workspace for the children and youth constituency of the
            UNFCCC.
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
            Join YOUNGO
            <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </A>
        </div>
      </div>
      <p className="platformFooterLegal">
        Membership is free · Built with youth, for youth · YOUNGO Hub
      </p>
    </footer>
  )
}

/** Signed-out front door: members sign in or register. */
export function PlatformLanding({ onAuthenticated }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'YOUNGO Hub · Sign in or join'
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
                Children and youth constituency · UNFCCC
              </p>
              <h1 id="platform-title">Your YOUNGO workspace.</h1>
              <p className="platformHeroLead">
                Sign in to continue, or create a free account. The Hub is where
                members follow meetings, working groups, submissions, and
                decisions — without hunting through chats.
              </p>
              <ul className="platformBenefitList">
                <li>See what needs you this week</li>
                <li>Find the working group that fits</li>
                <li>Keep policy work and decisions in one place</li>
              </ul>
              <div className="platformHeroActions">
                <A className="btn btn-primary platformHeroPrimary" href="/join">
                  Join the Hub — it’s free
                  <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </A>
                <a className="platformTextLink" href="#what-it-does">
                  See what’s inside
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
                <p className="platformSectionLabel">Inside the Hub</p>
                <h2 id="modules-title">The work, in one shared place.</h2>
              </div>
              <p>
                Members, contact points, YOUNGO teams, and organisations each
                see the tools attached to their responsibilities.
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
                <p className="platformSectionLabel">New here</p>
                <h2 id="steps-title">From joining to contributing.</h2>
              </div>
              <p>
                You do not need to understand the UN climate process before you
                arrive. The Hub helps you learn your way into it.
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
          <h2 id="final-cta-title">Join the Hub, or sign in to continue.</h2>
          <p>
            Membership is free. After you join, a short introduction unlocks the
            rest of the workspace.
          </p>
          <div className="platformFinalActions">
            <A className="btn btn-primary" href="/join">
              Join YOUNGO Hub
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
