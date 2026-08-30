import { useEffect } from 'react'
import {
  TbArrowRight as ArrowRight,
  TbBook2 as BookOpen,
  TbCalendarTime as Calendar,
  TbChecks as Checks,
  TbFileDescription as FileText,
  TbFingerprint as Fingerprint,
  TbGavel as Gavel,
  TbMessageQuestion as MessageQuestion,
  TbRoute as Route,
  TbSearch as Search,
  TbShieldCheck as ShieldCheck,
  TbSparkles as Sparkles,
  TbUsersGroup as Users,
  TbWorld as World,
} from 'react-icons/tb'
import { Brand } from '../components/Brand.jsx'
import { A } from '../components/ui.jsx'

const CAPABILITIES = [
  {
    icon: Calendar,
    eyebrow: 'Your week',
    title: 'Know what needs you next',
    body: 'Meetings, open calls, events, and deadlines come together in one place, with calendar links ready when you need them.',
    className: 'platformCapability platformCapabilityPrimary',
    preview: (
      <div className="platformAgenda" aria-hidden="true">
        <span className="platformAgendaDay">Today</span>
        <span className="platformAgendaLine platformAgendaLineLive" />
        <span className="platformAgendaCopy">
          Working group check-in
          <small>Coordination · on your calendar</small>
        </span>
        <span className="platformAgendaDay">Next</span>
        <span className="platformAgendaLine" />
        <span className="platformAgendaCopy">
          Policy input closes
          <small>Submission · action needed</small>
        </span>
      </div>
    ),
  },
  {
    icon: Users,
    eyebrow: 'Your place',
    title: 'Find the people and work that fit',
    body: 'Explore thematic working groups, understand what they do, and join the spaces connected to your interests.',
    className: 'platformCapability',
  },
  {
    icon: Search,
    eyebrow: 'Hub intelligence',
    title: 'Ask a question. Keep the evidence.',
    body: 'Search across governed Hub knowledge and receive answers that retain their sources and a clear verification note.',
    className: 'platformCapability',
  },
  {
    icon: Route,
    eyebrow: 'Your role',
    title: 'Open the workspace you actually need',
    body: 'Members, Working Group Contact Points, teams, and accredited organisations each see the tools attached to their responsibilities.',
    className: 'platformCapability platformCapabilityWide',
  },
  {
    icon: BookOpen,
    eyebrow: 'Shared memory',
    title: 'Keep useful knowledge findable',
    body: 'Browse reviewed science resources, follow decisions, and return to past submissions without searching through old chat threads.',
    className: 'platformCapability',
  },
]

const ROLES = [
  {
    label: 'Member',
    title: 'See where to participate',
    body: 'Follow events, opportunities, working groups, submissions, and decisions.',
  },
  {
    label: 'Working Group CP',
    title: 'Guide your group',
    body: 'Welcome participants, keep roles clear, and maintain the group workspace.',
  },
  {
    label: 'YOUNGO team',
    title: 'Move work through review',
    body: 'Coordinate membership, policy, or content work with the right safeguards.',
  },
  {
    label: 'Organisation',
    title: 'Bring opportunities into the network',
    body: 'Manage seats, share approved opportunities, and track recognised contributions.',
  },
]

const STEPS = [
  {
    title: 'Join YOUNGO',
    body: 'Create a free individual or youth-led organisation account.',
  },
  {
    title: 'Learn the shared ground',
    body: 'Complete the short introduction to YOUNGO’s structure and principles.',
  },
  {
    title: 'Make the Hub yours',
    body: 'Choose your interests and responsibilities; the right workspaces appear.',
  },
]

const TRUST = [
  {
    icon: Fingerprint,
    title: 'Private by design',
    body: 'Access is checked at the source. Personal account details and sensitive member data stay outside Hub search.',
  },
  {
    icon: Checks,
    title: 'Evidence over guesswork',
    body: 'Intelligence answers retain citations and a verification caveat, so you can check before you act.',
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
          <a href="#what-it-does">What it does</a>
          <a href="#how-it-works">How it works</a>
          <a href="#trust">Trust</a>
          <A href="/about">About YOUNGO</A>
        </nav>
        <div className="platformHeaderActions">
          <A className="platformSignIn" href="/signin">
            Sign in
          </A>
          <A className="btn btn-primary platformJoinButton" href="/join">
            Join the Hub
            <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </A>
        </div>
      </div>
    </header>
  )
}

function CoordinationOrbit() {
  return (
    <div
      className="platformOrbit"
      role="img"
      aria-label="YOUNGO Hub connects your calendar, working groups, submissions, decisions, and resources in one shared workspace."
    >
      <div className="platformOrbitField" aria-hidden="true">
        <span className="platformOrbitRing platformOrbitRingOuter" />
        <span className="platformOrbitRing platformOrbitRingInner" />
        <span className="platformOrbitAxis" />

        <span className="platformOrbitNode platformOrbitNodeCalendar">
          <Calendar size={16} strokeWidth={1.8} /> Calendar
        </span>
        <span className="platformOrbitNode platformOrbitNodeGroups">
          <Users size={16} strokeWidth={1.8} /> Working groups
        </span>
        <span className="platformOrbitNode platformOrbitNodePolicy">
          <FileText size={16} strokeWidth={1.8} /> Submissions
        </span>
        <span className="platformOrbitNode platformOrbitNodeDecisions">
          <Gavel size={16} strokeWidth={1.8} /> Decisions
        </span>
        <span className="platformOrbitNode platformOrbitNodeResources">
          <BookOpen size={16} strokeWidth={1.8} /> Resources
        </span>

        <span className="platformOrbitCore">
          <span className="platformOrbitPulse" />
          <Brand />
          <small>Your shared workspace</small>
        </span>
      </div>

      <div className="platformOrbitNote" aria-hidden="true">
        <span className="platformOrbitNoteIcon">
          <Sparkles size={16} strokeWidth={1.8} />
        </span>
        <span>
          <small>What needs you</small>
          <strong>One clear next step</strong>
        </span>
        <ArrowRight size={16} strokeWidth={1.8} />
      </div>
    </div>
  )
}

function PlatformFooter() {
  return (
    <footer className="platformFooter">
      <div className="platformFooterInner">
        <div className="platformFooterLead">
          <Brand />
          <p>
            The shared platform for the children and youth constituency of the
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

/** Public, signed-out introduction to the YOUNGO Hub platform. */
export function PlatformLanding() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'YOUNGO Hub · Climate action, coordinated'
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
                <span /> Mission control for youth climate action
              </p>
              <h1 id="platform-title">
                The work of YOUNGO,
                <span> finally in one place.</span>
              </h1>
              <p className="platformHeroLead">
                YOUNGO Hub is the shared workspace for children and youth in the
                UN climate process. Follow what is happening, find where you
                fit, and move the work forward with your community.
              </p>
              <div className="platformHeroActions">
                <A className="btn btn-primary platformHeroPrimary" href="/join">
                  Join the Hub — it’s free
                  <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </A>
                <a className="platformTextLink" href="#what-it-does">
                  See what’s inside
                  <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className="platformReassurance">
                For individual members and youth-led organisations · Designed
                for phones and slower connections
              </p>
            </div>
            <CoordinationOrbit />
          </div>
        </section>

        <section className="platformProblem" aria-label="The platform promise">
          <div className="platformSectionInner platformProblemInner">
            <p className="platformSectionLabel">One shared picture</p>
            <blockquote>
              Climate action moves quickly. Your information should not be the
              part that slows you down.
            </blockquote>
            <p>
              The Hub brings YOUNGO’s meetings, groups, policy work, decisions,
              opportunities, and knowledge into a clear, role-aware home.
            </p>
          </div>
        </section>

        <section
          className="platformSection platformCapabilitiesSection"
          id="what-it-does"
          aria-labelledby="capabilities-title"
        >
          <div className="platformSectionInner">
            <div className="platformSectionHeading">
              <div>
                <p className="platformSectionLabel">Built around the work</p>
                <h2 id="capabilities-title">
                  Less hunting. More contributing.
                </h2>
              </div>
              <p>
                Everything in the Hub answers a practical question: what is
                happening, what needs input, where do I go, and who can help?
              </p>
            </div>

            <div className="platformCapabilityGrid">
              {CAPABILITIES.map(
                ({ icon: Icon, eyebrow, title, body, className, preview }) => (
                  <article className={className} key={title}>
                    <div className="platformCapabilityTopline">
                      <span
                        className="platformCapabilityIcon"
                        aria-hidden="true"
                      >
                        <Icon size={20} strokeWidth={1.7} />
                      </span>
                      <span>{eyebrow}</span>
                    </div>
                    <h3>{title}</h3>
                    <p>{body}</p>
                    {preview}
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="platformRoles" aria-labelledby="roles-title">
          <div className="platformSectionInner">
            <div className="platformRolesIntro">
              <p className="platformSectionLabel">One Hub, many roles</p>
              <h2 id="roles-title">The platform meets you where you serve.</h2>
              <p>
                Start as a member. When your responsibilities grow, the Hub adds
                the tools for that work—without exposing everything to everyone.
              </p>
            </div>
            <ol className="platformRoleList">
              {ROLES.map(({ label, title, body }, index) => (
                <li key={label}>
                  <span className="platformRoleIndex" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="platformRoleCopy">
                    <span className="platformRoleLabel">{label}</span>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </span>
                </li>
              ))}
            </ol>
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
                <p className="platformSectionLabel">Your way in</p>
                <h2 id="steps-title">From curious to contributing.</h2>
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
              <span className="platformTrustMark" aria-hidden="true">
                <World size={28} strokeWidth={1.6} />
              </span>
              <p className="platformSectionLabel">Trust is infrastructure</p>
              <h2 id="trust-title">
                Open enough to collaborate. Careful enough to belong here.
              </h2>
              <p>
                Youth participation deserves more than convenient software. It
                needs clear permissions, verifiable information, and human
                judgment around consequential actions.
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
          <div className="platformFinalCtaOrb" aria-hidden="true">
            <MessageQuestion size={28} strokeWidth={1.6} />
          </div>
          <p className="platformSectionLabel">Your next step can be simple</p>
          <h2 id="final-cta-title">
            Find the part of the work that needs you.
          </h2>
          <p>
            Join YOUNGO Hub for free, take the short introduction, and start
            with one group, one meeting, or one contribution.
          </p>
          <div className="platformFinalActions">
            <A className="btn btn-primary" href="/join">
              Join YOUNGO Hub
              <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
            </A>
            <A className="btn btn-secondary" href="/signin">
              I already have an account
            </A>
          </div>
        </section>
      </main>

      <PlatformFooter />
    </div>
  )
}
