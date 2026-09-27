import { useEffect } from 'react'
import {
  TbArrowRight as ArrowRight,
  TbArrowUpRight as ArrowUpRight,
  TbChecks as Checks,
  TbFingerprint as Fingerprint,
  TbShieldCheck as ShieldCheck,
} from 'react-icons/tb'
import { LandingSignIn } from '../components/auth/LandingSignIn.jsx'
import { Brand } from '../components/Brand.jsx'
import { YOUNGO_NETWORK } from '../content/connect.js'
import { A } from '../components/ui.jsx'

const ORGANISATION = [
  {
    value: 'Flat structure',
    label: 'Roles facilitate. They do not decide over others.',
    tone: 'teal',
  },
  {
    value: 'Consensus',
    label: 'Decisions follow the guidelines the constituency already uses.',
    tone: 'lime',
  },
  {
    value: 'Equal voice',
    label: 'Every engaging entity has an equal voice, whatever its size.',
    tone: 'forest',
  },
]

const SCENES = [
  {
    src: '/landing-v2/working-group.jpg',
    title: 'Working groups',
    body: 'Thematic groups do the day-to-day policy work — from Adaptation to Human Rights.',
    href: '/about/working-groups',
    link: 'Explore working groups',
  },
  {
    src: '/landing-v2/coast.jpg',
    title: 'Conference of Youth',
    body: 'COY21: Climate on Every Coast, ahead of COP31 in Antalya.',
    href: 'https://climatecoy.com/',
    link: 'climatecoy.com',
    external: true,
  },
]

function PlatformHeader() {
  return (
    <header className="v2Header">
      <div className="v2HeaderInner">
        <A href="/landingV2" className="v2Brand" aria-label="YOUNGO home">
          <Brand constituencyOnly />
        </A>
        <p className="landingV2Banner" role="status">
          Preview — constituency-facing door.{' '}
          <A href="/">The live Hub desk stays at /</A>
        </p>
        <nav className="v2Nav" aria-label="Preview navigation">
          <A href="/about">About YOUNGO</A>
        </nav>
        <div className="v2HeaderActions">
          <A href="/about" className="v2HeaderAbout">
            About YOUNGO
          </A>
          <a className="v2SignInLink" href="#signin">
            Sign in
          </a>
          <A className="btn btn-primary v2Join" href="/join">
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
    <footer className="v2Footer">
      <div className="v2FooterInner">
        <div className="v2FooterLead">
          <Brand constituencyOnly />
          <p>
            Official children and youth constituency of the UNFCCC. This page is
            a preview — <A href="/">the live Hub desk stays at /</A>.
          </p>
        </div>
        <nav aria-label="Platform links">
          <A href="/about">About YOUNGO</A>
          <A href="/about/working-groups">Working groups</A>
          <A href="/about/resources">Resources</A>
          {YOUNGO_NETWORK.map((site) => (
            <a
              key={site.key}
              href={site.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {site.title}
            </a>
          ))}
          <a href="/privacy">Privacy</a>
        </nav>
        <div className="v2FooterActions">
          <A href="/signin">Sign in</A>
          <A className="btn btn-primary" href="/join">
            Join YOUNGO
            <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
          </A>
        </div>
      </div>
      <p className="v2FooterLegal">
        Preview of the constituency-facing door · Hub accounts are free ·{' '}
        <A href="/">The live desk stays at /</A>
      </p>
    </footer>
  )
}

/** Photographic public door. Does not replace the live member desk at `/`. */
export function PlatformLandingV2({ onAuthenticated }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'YOUNGO · Preview of the public door'
    if (!document.getElementById('landing-v2-syne')) {
      const link = document.createElement('link')
      link.id = 'landing-v2-syne'
      link.rel = 'stylesheet'
      link.href =
        'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap'
      document.head.appendChild(link)
    }
    return () => {
      document.title = previousTitle
    }
  }, [])

  return (
    <div className="platformLandingV2">
      <a className="skipLink" href="#platform-main">
        Skip to main content
      </a>
      <PlatformHeader />
      <main id="platform-main" tabIndex="-1">
        <section className="v2Hero" aria-labelledby="platform-title">
          <div className="v2HeroStage">
            <img
              className="v2HeroPhoto"
              src="/landing-v2/hero.jpg"
              alt="Young people seated in a packed hall, some with hands raised, leaving an empty aisle of folding chairs in the foreground."
            />
            <div className="v2HeroShade" aria-hidden="true" />
            <div className="v2HeroInner">
              <h1 id="platform-title">Your place in global climate action.</h1>
              <div className="v2HeroActions">
                <A className="btn btn-primary v2HeroPrimary" href="/join">
                  Join YOUNGO — it’s free
                  <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
                </A>
              </div>
            </div>
          </div>
          <div className="v2Stripe" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="v2Intro" aria-label="About this constituency">
          <p className="v2Kicker">
            Official children and youth constituency of the UNFCCC
          </p>
          <p className="v2HeroLead">
            YOUNGO brings together young people, youth-led organisations,
            groups, and delegations. Learn the UN climate process, contribute to
            policy, and find the people already doing the work.
          </p>
          <p className="v2HeroMeta">
            Since 2009 · Open to children and youth up to 35 · No membership fee
          </p>
        </section>

        <section className="v2Bands" aria-label="How YOUNGO is organised">
          {ORGANISATION.map(({ value, label, tone }) => (
            <article key={value} data-tone={tone}>
              <strong>{value}</strong>
              <p>{label}</p>
            </article>
          ))}
        </section>

        <section
          className="v2Scenes"
          id="what-it-does"
          aria-labelledby="scenes-title"
        >
          <div className="v2SectionHead">
            <p className="v2Label">Inside the constituency</p>
            <h2 id="scenes-title">What you can take part in</h2>
            <A className="v2SectionNote" href="/about">
              Since 2009 — oldest youth constituency to a UN convention.
            </A>
          </div>
          <ul className="v2SceneGrid">
            {SCENES.map((scene) => (
              <li key={scene.title}>
                {scene.external ? (
                  <a
                    href={scene.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <img src={scene.src} alt="" />
                    <div>
                      <strong>{scene.title}</strong>
                      <p>{scene.body}</p>
                      <span>
                        {scene.link}
                        <ArrowUpRight size={14} strokeWidth={1.8} />
                      </span>
                    </div>
                  </a>
                ) : (
                  <A href={scene.href}>
                    <img src={scene.src} alt="" />
                    <div>
                      <strong>{scene.title}</strong>
                      <p>{scene.body}</p>
                      <span>
                        {scene.link}
                        <ArrowRight size={14} strokeWidth={1.8} />
                      </span>
                    </div>
                  </A>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="v2Network"
          id="around-youngo"
          aria-labelledby="network-title"
        >
          <div className="v2SectionHead">
            <p className="v2Label">Around YOUNGO</p>
            <h2 id="network-title">Public sites the constituency keeps.</h2>
          </div>
          <ul className="v2NetworkGrid">
            {YOUNGO_NETWORK.map((site) => (
              <li key={site.key}>
                <a href={site.url} target="_blank" rel="noreferrer noopener">
                  <strong>{site.title}</strong>
                  {site.current && (
                    <p className="v2Current">{site.current.title}</p>
                  )}
                  <p>{site.body}</p>
                  <span className="v2Host">
                    {site.host}
                    <ArrowUpRight size={15} strokeWidth={1.8} />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="v2Close">
          <section className="v2Trust" id="trust" aria-labelledby="trust-title">
            <p className="v2Label">Trust is infrastructure</p>
            <h2 id="trust-title">
              Open enough to collaborate. Careful enough to belong here.
            </h2>
            <ul>
              <li>
                <Fingerprint size={20} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <strong>Private by design</strong>
                  <p>Personal account details stay outside Hub search.</p>
                </div>
              </li>
              <li>
                <Checks size={20} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <strong>Evidence over guesswork</strong>
                  <p>
                    Search answers keep their sources and a verification note.
                  </p>
                </div>
              </li>
              <li>
                <ShieldCheck size={20} strokeWidth={1.7} aria-hidden="true" />
                <div>
                  <strong>People approve important changes</strong>
                  <p>
                    Research cannot change governance, membership, or messages.
                  </p>
                </div>
              </li>
            </ul>
          </section>

          <section className="v2SignIn" aria-label="Sign in">
            <div className="v2SignInInner">
              <div>
                <p className="v2Label">Returning members</p>
                <h2>I already have an account</h2>
                <p>
                  Sign in to open the Hub. New members still join through a free
                  account — there is no membership fee.
                </p>
              </div>
              <LandingSignIn onAuthenticated={onAuthenticated} />
            </div>
          </section>
        </div>
      </main>

      <PlatformFooter />
    </div>
  )
}
