import { TbHelpCircle as HelpIcon } from 'react-icons/tb'
import {
  TbArrowRight as ArrowRight,
  TbBell as Bell,
  TbCalendar as CalendarDays,
  TbClipboardCheck as ClipboardCheck,
  TbFileText as FileText,
  TbHome as Home,
  TbLifebuoy as LifeBuoy,
  TbSpeakerphone as Megaphone,
  TbSchool as GraduationCap,
  TbSearch as Search,
  TbShieldLock as ShieldLock,
  TbUserCircle as UserCircle,
  TbUsers as Users,
} from 'react-icons/tb'
import { A, PageHeader, Section } from '../components/ui.jsx'
import { FeedbackButton } from '../components/FeedbackButton.jsx'
import { useDocument } from '../lib/documents.js'

const HUB_DESTINATIONS = [
  {
    icon: GraduationCap,
    title: 'Start and unlock the Hub',
    body: 'Complete the short membership introduction.',
    href: '/onboarding',
  },
  {
    icon: Bell,
    title: 'Install the app and turn on alerts',
    body: 'Add the Hub to your phone, then allow banners for meetings and announcements.',
    href: '/profile#alerts',
  },
  {
    icon: UserCircle,
    title: 'Your account and profile',
    body: 'Update your photo, directory details, and privacy.',
    href: '/profile',
  },
  {
    icon: CalendarDays,
    title: 'Calendar and calls',
    body: 'Find meetings and add them to your calendar.',
    href: '/calendar',
  },
  {
    icon: Megaphone,
    title: 'Opportunities',
    body: 'Browse open calls, fellowships, and events.',
    href: '/opportunities',
  },
  {
    icon: Users,
    title: 'Working groups',
    body: 'Open a group, meet its Contact Points, and enter its workspace.',
    href: '/groups',
  },
  {
    icon: FileText,
    title: 'Submissions',
    body: 'See drafts, deadlines, and ways to contribute.',
    href: '/submissions',
  },
  {
    icon: ClipboardCheck,
    title: 'Youth Statement',
    body: 'Follow inputs, drafting, and the objection process.',
    href: '/gys',
  },
  {
    icon: Search,
    title: 'Search the Hub',
    body: 'Find Hub content and source-backed constituency evidence.',
    href: '/search',
  },
]

function HubDestination({ item }) {
  const Icon = item.icon
  return (
    <A href={item.href} className="helpDestinationRow">
      <Icon size={19} strokeWidth={1.75} aria-hidden />
      <span className="helpDestinationCopy">
        <strong>{item.title}</strong>
        <span className="meta">{item.body}</span>
      </span>
      <ArrowRight className="helpDestinationArrow" size={17} strokeWidth={1.75} aria-hidden />
    </A>
  )
}

function PersonBehindHub({ person }) {
  const initials = person.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
  return (
    <article className="card cardTight helpPersonCard">
      <span className="helpPersonAvatar" aria-hidden>
        {initials}
      </span>
      <div>
        <h3>{person.name}</h3>
        <p className="meta">{person.focus}</p>
      </div>
    </article>
  )
}

export function Help() {
  const { doc: connect } = useDocument('connect')
  const HUB_LAUNCHERS = connect?.HUB_LAUNCHERS || []

  return (
    <div className="detailPage helpPage">
      <PageHeader
        icon={HelpIcon}
        title="Help &amp; support"
        description="Find the right Hub page, get help with access, or report a problem."
      />

      <Section label="Get help">
        <div className="helpActionGrid">
          <article className="card cardTight helpActionCard">
            <span className="iconTile" aria-hidden>
              <LifeBuoy size={20} strokeWidth={1.75} />
            </span>
            <div className="helpActionCopy">
              <h3>Something is broken</h3>
              <p className="meta">
                Send the page and device details needed to reproduce the problem.
              </p>
            </div>
            <div className="helpActionControl helpReportAction">
              <FeedbackButton mode="menu" label="Report an issue" />
            </div>
          </article>

          <article className="card cardTight helpActionCard">
            <span className="iconTile" aria-hidden>
              <UserCircle size={20} strokeWidth={1.75} />
            </span>
            <div className="helpActionCopy">
              <h3>Membership and account</h3>
              <p className="meta">
                Check verification, profile, organisation access, or your membership course.
              </p>
            </div>
            <A href="/profile" className="btn btn-secondary helpActionControl">
              Open profile
            </A>
          </article>

          <article className="card cardTight helpActionCard">
            <span className="iconTile" aria-hidden>
              <Users size={20} strokeWidth={1.75} />
            </span>
            <div className="helpActionCopy">
              <h3>Working-group access</h3>
              <p className="meta">Find Contact Points, member workspaces, and official channels.</p>
            </div>
            <A href="/groups" className="btn btn-secondary helpActionControl">
              Browse groups
            </A>
          </article>

          <article className="card cardTight helpActionCard">
            <span className="iconTile" aria-hidden>
              <Megaphone size={20} strokeWidth={1.75} />
            </span>
            <div className="helpActionCopy">
              <h3>Organisation postings</h3>
              <p className="meta">Publish opportunities from your organisation workspace.</p>
            </div>
            <A href="/ngo" className="btn btn-secondary helpActionControl">
              Open NGO workspace
            </A>
          </article>
        </div>
      </Section>

      <Section label="Use the Hub">
        <nav className="card helpDestinationGrid" aria-label="Hub help links">
          {HUB_DESTINATIONS.map((item) => (
            <HubDestination key={item.href} item={item} />
          ))}
        </nav>
      </Section>

      <Section label="People behind the Hub">
        <p className="meta helpPeopleIntro">
          The Hub is designed, maintained, and governed by the two people below inside YOUNGO.
        </p>
        <div className="helpPeopleGrid">
          {HUB_LAUNCHERS.map((person) => (
            <PersonBehindHub key={person.name} person={person} />
          ))}
        </div>
      </Section>

      <section className="card helpAboutStrip" aria-labelledby="help-about-title">
        <span className="iconTile" aria-hidden>
          <ShieldLock size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 id="help-about-title">About the Hub</h2>
          <p className="meta">
            The Hub is volunteer-maintained, runs at cost, and limits member data to what its
            services need. Read the{' '}
            <A href="/privacy" className="inlineLink">
              Privacy Notice
            </A>{' '}
            or{' '}
            <A href="/about" className="inlineLink">
              learn how YOUNGO works
            </A>
            .
          </p>
        </div>
        <A href="/" className="btn btn-secondary helpActionControl">
          <Home size={17} strokeWidth={1.75} aria-hidden />
          Go home
        </A>
      </section>
    </div>
  )
}
