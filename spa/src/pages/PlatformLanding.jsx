import { TbArrowUpRight, TbBook2, TbCalendarEvent, TbUsersGroup } from 'react-icons/tb'
import { Brand } from '../components/Brand.jsx'
import { A } from '../components/ui.jsx'
import { useApi } from '../lib/api.js'

const spaces = [
  {
    title: 'Working groups',
    text: 'Work with other young people on the climate issues you care about.',
    href: '/about/wgs',
    icon: TbUsersGroup,
    label: 'Find a group',
  },
  {
    title: 'Conferences of Youth',
    text: 'Connect local and regional ideas with the global climate conversation.',
    href: '/about/coy',
    icon: TbCalendarEvent,
    label: 'Explore youth conferences',
  },
  {
    title: 'Resources',
    text: 'Find research, practical guides and learning materials in the Hub’s shared collection.',
    href: '/about/resources',
    icon: TbBook2,
    label: 'Browse resources',
  },
]

export function PlatformLanding() {
  const { data, loading, error, retry } = useApi('/landing')
  return (
    <div className="platformLanding">
      <a className="skipLink" href="#landing-main">
        Skip to content
      </a>
      <header className="platformHeader">
        <div className="platformHeaderInner">
          <A href="/" className="platformBrand" aria-label="YOUNGO Hub home">
            <Brand />
          </A>
          <nav className="platformNav" aria-label="Main navigation">
            <A href="/about">About YOUNGO</A>
            <A href="/about/resources">Resources</A>
          </nav>
          <A href="/signin" className="btn btn-ghost">
            Sign in
          </A>
          <A href="/join" className="btn btn-primary">
            Join YOUNGO
          </A>
        </div>
      </header>
      <main id="landing-main">
        <section className="aroundHero" id="around-youngo" aria-labelledby="around-title">
          <div className="aroundHeroCopy">
            <p className="aroundEyebrow">Young people. Shared climate action.</p>
            <h1 id="around-title">
              Around
              <br />
              <span>YOUNGO.</span>
            </h1>
            <p className="aroundLead">A place to connect, contribute and shape what comes next.</p>
            <p className="aroundIntro">
              YOUNGO is the children and youth constituency of the United Nations Framework
              Convention on Climate Change. The Hub brings our groups, resources and shared work
              together.
            </p>
            <div className="aroundActions">
              <A href="/join" className="btn btn-primary">
                Take part <TbArrowUpRight aria-hidden size={18} />
              </A>
              <A href="/about" className="aroundTextLink">
                Get to know YOUNGO <span aria-hidden>→</span>
              </A>
            </div>
          </div>
          <div className="aroundHeroImage">
            <img
              src="/landing/working-together.webp"
              alt="People sharing ideas around a table"
              width="1152"
              height="864"
              fetchPriority="high"
            />
            <div className="aroundImageCaption">
              <span>Our shared space</span>
              <strong>Ideas become collective work.</strong>
            </div>
          </div>
        </section>
        <section className="aroundSection" aria-labelledby="spaces-title">
          <div className="aroundSectionHeading">
            <p className="aroundEyebrow">Find your place</p>
            <h2 id="spaces-title">Many ways to get involved.</h2>
          </div>
          <div className="aroundSpaces">
            {spaces.map(({ title, text, href, icon: Icon, label }, i) => (
              <A href={href} className="aroundSpace" key={href}>
                <div className="aroundSpaceTop">
                  <Icon size={28} strokeWidth={1.5} aria-hidden />
                  <span aria-hidden>0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="aroundSpaceLink">
                  {label}
                  <TbArrowUpRight size={20} aria-hidden />
                </span>
              </A>
            ))}
          </div>
        </section>
        <section className="aroundSection aroundEvents" aria-labelledby="events-title">
          <div className="aroundSectionHeading">
            <p className="aroundEyebrow">Coming up</p>
            <h2 id="events-title">Meet, learn and contribute.</h2>
          </div>
          {loading ? (
            <p role="status" className="aroundStatus">
              Loading upcoming events…
            </p>
          ) : error ? (
            <div className="aroundStatus">
              <p>Upcoming events are unavailable just now.</p>
              <button className="btn btn-ghost" onClick={retry}>
                Try again
              </button>
            </div>
          ) : data?.events?.length ? (
            <div className="aroundEventList">
              {data.events.map((event) => {
                const date = new Date(event.startsAt)
                return (
                  <A
                    className="aroundEvent"
                    href={`/calendar/${encodeURIComponent(event.slug)}`}
                    key={event.slug}
                  >
                    <time dateTime={event.startsAt}>
                      <strong>
                        {date.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'UTC' })}
                      </strong>
                      <span>
                        {date.toLocaleDateString('en-GB', {
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </time>
                    <div>
                      <h3>{event.title}</h3>
                      <p>
                        {date.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        })}{' '}
                        UTC
                      </p>
                    </div>
                    <TbArrowUpRight size={22} aria-hidden />
                  </A>
                )
              })}
            </div>
          ) : (
            <p className="aroundStatus">No upcoming events have been published yet.</p>
          )}
        </section>
        <section className="aroundJoin" aria-labelledby="join-title">
          <div>
            <p className="aroundEyebrow">Your contribution matters</p>
            <h2 id="join-title">Be part of the work.</h2>
            <p>
              Join a group, contribute to a shared proposal or help bring a youth conference to
              life.
            </p>
          </div>
          <A href="/join" className="btn btn-primary">
            Join YOUNGO <TbArrowUpRight size={18} aria-hidden />
          </A>
        </section>
      </main>
      <footer className="aroundFooter">
        <p>YOUNGO Hub</p>
        <nav aria-label="Footer">
          <A href="/about/contact">Contact</A>
          <A href="/privacy">Privacy</A>
          <a href="https://github.com/youngo-consitutency/hub">Contribute on GitHub</a>
        </nav>
      </footer>
    </div>
  )
}
