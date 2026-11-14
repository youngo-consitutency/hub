'use client'

import type { ComponentType, ReactNode } from 'react'
import { TbChevronRight as ChevronRight } from 'react-icons/tb'
import { A } from '../../components/ui'
import { NumberTicker } from '../../components/fx/NumberTicker'
import { HeroArt, type HeroArtKind } from './HeroArt'

export interface PageFact {
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>
  value: number
  label: string
}
interface SitePageProps {
  title: string
  eyebrow: string
  lead?: ReactNode
  /** the line drawing beside the title; each page has its own idea */
  art: HeroArtKind
  /** up to three numbers that size the page's subject; zero counts are left out */
  facts?: PageFact[]
  children: ReactNode
}

// the frame every public page shares: the same hero (eyebrow, title, lead, facts, drawing), then the page
export function SitePage({ title, eyebrow, lead, art, facts, children }: SitePageProps) {
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
