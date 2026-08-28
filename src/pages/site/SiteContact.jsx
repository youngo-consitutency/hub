import {
  TbArrowUpRight as ArrowUpRight,
  TbAt as AtSign,
  TbHeartHandshake as HeartHandshake,
  TbLifebuoy as LifeBuoy,
  TbSitemap as Network,
  TbUsers as Users,
} from 'react-icons/tb'
import { A } from '../../components/ui.jsx'
import { DestinationIcon } from '../../components/DestinationLink.jsx'
import { publishedLinks } from '../../content/connect.js'

const ROUTES = [
  {
    icon: Users,
    title: 'Joining YOUNGO & membership',
    body: 'Registration, the membership course, verification, and organisation seats are all handled in the Hub.',
    cta: { label: 'Join or sign in', href: '/' },
  },
  {
    icon: Network,
    title: 'Working groups & policy work',
    body: 'Each working group is coordinated by its own contact points. Join the Hub, open a group, and its contacts and channels are listed there.',
    cta: { label: 'Explore working groups', href: '/about/working-groups' },
  },
  {
    icon: AtSign,
    title: 'Focal Points & official matters',
    body: 'The two Global Focal Points are the constituency’s contact for the UNFCCC Secretariat and official partners. Current Focal Points are listed on the official UNFCCC YOUNGO page.',
    cta: {
      label: 'YOUNGO on UNFCCC',
      href: 'https://unfccc.int/topics/action-for-climate-empowerment-children-and-youth/youth/youngo',
      external: true,
    },
  },
  {
    icon: LifeBuoy,
    title: 'Something wrong with the Hub',
    body: 'Members can report bugs and blockers straight from any page in the Hub — reports carry the page and context so the team can reproduce them.',
    cta: { label: 'Help & support', href: '/help', internal: true },
  },
]

export function SiteContact() {
  const socials = publishedLinks()
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <p className="pageEyebrow">Where to write</p>
        <h1>Contact</h1>
        <p className="sitePageLead">
          YOUNGO is volunteer-run, so the fastest answer usually comes from the
          right channel. Pick the route that matches your question below.
        </p>
      </header>

      <section className="siteSection" aria-labelledby="routes-heading">
        <h2 id="routes-heading">Contact routes</h2>
        <div className="siteContactGrid">
          {ROUTES.map(({ icon: Icon, title, body, cta }) => (
            <article key={title} className="card siteContactCard">
              <span className="iconTile" aria-hidden>
                <Icon size={20} strokeWidth={1.75} />
              </span>
              <div>
                <h3>{title}</h3>
                <p className="meta">{body}</p>
                {cta.internal ? (
                  <A className="siteContactLink" href={cta.href}>
                    {cta.label}
                    <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                  </A>
                ) : cta.external ? (
                  <a
                    className="siteContactLink"
                    href={cta.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {cta.label}
                    <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                  </a>
                ) : (
                  <a className="siteContactLink" href={cta.href}>
                    {cta.label}
                    <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {socials.length > 0 && (
        <section className="siteSection" aria-labelledby="socials-heading">
          <h2 id="socials-heading">Follow the constituency</h2>
          <p className="siteSectionLead">
            Announcements, calls, and opportunities are published on YOUNGO’s
            official channels.
          </p>
          <ul className="siteSocialList" aria-label="Official YOUNGO channels">
            {socials.map((link) => (
              <li key={link.key}>
                <a href={link.url} target="_blank" rel="noreferrer noopener">
                  <DestinationIcon url={link.url} size={16} />
                  {link.label}
                  <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card cardTight siteContactNote">
        <HeartHandshake size={20} strokeWidth={1.75} aria-hidden />
        <p className="meta">
          YOUNGO is run by volunteers, for its members. Please expect a little
          patience with replies around COP and school exam seasons — and
          kindness with the people answering.
        </p>
      </section>
    </div>
  )
}
