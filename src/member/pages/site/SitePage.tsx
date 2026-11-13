'use client'

import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { TbChevronRight as ChevronRight } from 'react-icons/tb'
import { A } from '../../components/ui'

export type Motif = 'rings' | 'dots' | 'lines' | 'grid' | 'arcs' | 'waves'
export interface PageSection {
  id: string
  label: string
}

// a long page is split into sections with a sticky "on this page" list that marks where you are
function SectionNav({ sections }: { sections: PageSection[] }) {
  const [current, setCurrent] = useState(sections[0]?.id)
  useEffect(() => {
    const seen = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) seen.set(entry.target.id, entry.isIntersecting)
        // the first section in the band just below the header wins
        const active = sections.find(({ id }) => seen.get(id))
        if (active) setCurrent(active.id)
      },
      { rootMargin: '-20% 0px -65% 0px' },
    )
    for (const { id } of sections) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
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
  eyebrow?: string
  lead?: ReactNode
  motif: Motif
  /** two or more sections get the "on this page" list */
  sections?: PageSection[]
  children: ReactNode
}

// the frame every public page shares: one h1 in the deep band, then the page
export function SitePage({ title, eyebrow, lead, motif, sections, children }: SitePageProps) {
  return (
    <div className="siteMain">
      <header className="sitePageHeader" data-motif={motif === 'rings' ? undefined : motif}>
        {eyebrow && <p className="pageEyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lead && <p className="sitePageLead">{lead}</p>}
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
