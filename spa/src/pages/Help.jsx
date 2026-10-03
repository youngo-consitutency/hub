import { TbHelpCircle as HelpIcon } from 'react-icons/tb'
import {
  TbHome as Home,
  TbLifebuoy as LifeBuoy,
  TbSpeakerphone as Megaphone,
  TbShieldLock as ShieldLock,
  TbUserCircle as UserCircle,
  TbUsers as Users,
} from 'react-icons/tb'
import { A, PageHeader, Section } from '../components/ui.jsx'
import { FeedbackButton } from '../components/FeedbackButton.jsx'
import { useDocument } from '../lib/documents.js'

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

/** Show support actions, published Hub contributor details and privacy information. */
export function Help() {
  const { doc: connect } = useDocument('connect')
  const HUB_LAUNCHERS = connect?.HUB_LAUNCHERS || []

  return (
    <div className="detailPage helpPage">
      <PageHeader
        icon={HelpIcon}
        title="Help &amp; support"
        description="Get help with your account or report a problem."
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

      {HUB_LAUNCHERS.length > 0 && (
        <Section label="People behind the Hub">
          <div className="helpPeopleGrid">
            {HUB_LAUNCHERS.map((person) => (
              <PersonBehindHub key={person.name} person={person} />
            ))}
          </div>
        </Section>
      )}

      <section className="card helpAboutStrip" aria-labelledby="help-about-title">
        <span className="iconTile" aria-hidden>
          <ShieldLock size={20} strokeWidth={1.75} />
        </span>
        <div>
          <h2 id="help-about-title">About the Hub</h2>
          <p className="meta">
            Read the{' '}
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
