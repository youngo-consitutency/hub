import type { ReactNode } from 'react'

interface HeroBandProps {
  eyebrow: string
  title: string
  lead?: ReactNode
  /** the drawing beside the copy; dropped under 860px */
  art?: ReactNode
  /** page: full bleed under the public header. hub: the rounded inset band on Home */
  variant: 'page' | 'hub'
  /** names the hub band for assistive tech; the page band is the page's own header */
  label?: string
  /** the slot under the lead: facts on a page, metrics on Home */
  children?: ReactNode
}

// the deep green band that opens a page: eyebrow, the one h1, lead, then facts or metrics
export function HeroBand({ eyebrow, title, lead, art, variant, label, children }: HeroBandProps) {
  const hub = variant === 'hub'
  const Band = hub ? 'section' : 'header'
  return (
    <Band
      className={`heroBand heroBand-${variant}${hub ? ' ldDark' : ''}`}
      aria-label={hub ? (label ?? title) : undefined}
    >
      <div
        className={
          art
            ? 'grid grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] items-center gap-8 max-[860px]:grid-cols-1'
            : undefined
        }
      >
        <div className={`grid ${hub ? 'gap-2' : 'gap-3'}`}>
          <p className="pageEyebrow">{eyebrow}</p>
          <h1 className="heroBandTitle">{title}</h1>
          {lead && <p className="heroBandLead">{lead}</p>}
          {children}
        </div>
        {art && <div className="grid max-[860px]:hidden">{art}</div>}
      </div>
    </Band>
  )
}
