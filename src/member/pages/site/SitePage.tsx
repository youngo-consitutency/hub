'use client'

import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { TbChevronRight as ChevronRight } from 'react-icons/tb'
import { A } from '../../components/ui'
import { NumberTicker } from '../../components/fx/NumberTicker'
import { HeroArt, type HeroArtKind } from './HeroArt'

export interface PageFact {
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  value: number
  label: string
}
export interface PageSection {
  id: string
  label: string
}

// a long page is split into sections with a sticky "on this page" list that marks where you are
function SectionNav({ sections }: { sections: PageSection[] }) {
  const [current, setCurrent] = useState(sections[0]?.id)
  useEffect(() => {
    const seen = new Map<string, boolean>()
    const watched = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting)
        // the first section in the band just below the header wins
        const active = sections.find(({ id }) => seen.get(id))
        if (active) setCurrent(active.id)
      },
      { rootMargin: '-20% 0px -65% 0px' },
    )
    // a section can mount after its data loads, so pick up late arrivals too
    const attach = () => {
      for (const { id } of sections) {
        const element = document.getElementById(id)
        if (element && !watched.has(id)) {
          watched.add(id)
          observer.observe(element)
        }
      }
    }
    attach()
    const mutations = new MutationObserver(attach)
    mutations.observe(document.getElementById('site-main') ?? document.body, {
      childList: true,
      subtree: true,
    })
    return () => {
      mutations.disconnect()
      observer.disconnect()
    }
  }, [sections])
  return (
    <nav className="siteSectionNav" aria-label="On this page">
      <ul>
        {sections.map(({ id, label }) => (
          <li key={id}>
            <a href={`#${id}`} aria-current={current === id ? 'location' : undefined}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

interface SitePageProps {
  title: string
  eyebrow: string
  lead?: ReactNode
  /** the line drawing beside the title; each page has its own idea */
  art: HeroArtKind
  /** up to three numbers that size the page's subject; zero counts are left out */
  facts?: PageFact[]
  /** two or more sections get the "on this page" list */
  sections?: PageSection[]
  children: ReactNode
}

// the frame every public page shares: the same hero (eyebrow, title, lead, facts, drawing), then the page
export function SitePage({ title, eyebrow, lead, art, facts, sections, children }: SitePageProps) {
  const shown = (facts ?? []).filter((fact) => fact.value > 0)
  return (
    <div className="siteMain">
      <header className="sitePageHeader">
        <div className="sitePageHeaderGrid">
          <div className="sitePageHeaderCopy">
            <p className="pageEyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            {lead && <p className="sitePageLead">{lead}</p>}
            {shown.length > 0 && (
              <dl className="siteFacts">
                {shown.map(({ icon: Icon, value, label }) => (
                  <div key={label}>
                    <Icon size={18} strokeWidth={1.5} aria-hidden />
                    <dd>
                      <NumberTicker value={value} />
                    </dd>
                    <dt>{label}</dt>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <HeroArt kind={art} />
        </div>
      </header>
      {sections && sections.length > 1 && <SectionNav sections={sections} />}
      {children}
    </div>
  )
}

interface SiteSectionProps {
  id: string
  title: string
  /** kept for the page data that carries one; sections name themselves with the heading */
  eyebrow?: string
  lead?: ReactNode
  children: ReactNode
}

// one section of a page: an h2 that names it, and the content under it
export function SiteSection({ id, title, lead, children }: SiteSectionProps) {
  return (
    <section id={id} className="siteBlock" aria-labelledby={`${id}-title`}>
      <header className="siteBlockHead">
        <h2 id={`${id}-title`}>{title}</h2>
        {lead && <p className="siteSectionLead">{lead}</p>}
      </header>
      {children}
    </section>
  )
}

interface SiteCtaProps {
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  title: string
  body: string
  label: string
  href: string
}

// the one closing call to action of a page
export function SiteCtaBand({ icon: Icon, title, body, label, href }: SiteCtaProps) {
  return (
    <section className="siteCtaBand card">
      <Icon size={24} strokeWidth={1.75} aria-hidden />
      <div>
        <h2>{title}</h2>
        <p className="meta">{body}</p>
      </div>
      <A className="btn btn-primary" href={href}>
        {label}
        <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
      </A>
    </section>
  )
}
