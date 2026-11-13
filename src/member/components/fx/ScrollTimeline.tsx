'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll } from 'motion/react'

interface Entry {
  label: string
  title: string
  body: ReactNode
}

// A vertical timeline whose rail fills as you scroll down it, with the label held in view beside
// each entry. The pattern is a common one (sticky labels, scroll-linked rail); this version is
// written for this project on top of Motion's useScroll.
export function ScrollTimeline({ entries }: { entries: Entry[] }) {
  const ref = useRef<HTMLOListElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 55%'] })
  return (
    <ol className="fxTimeline" ref={ref}>
      <span className="fxTimelineRail" aria-hidden>
        <motion.span className="fxTimelineFill" style={{ scaleY: reduced ? 1 : scrollYProgress }} />
      </span>
      {entries.map(({ label, title, body }) => (
        <li key={title} className="fxTimelineEntry">
          <span className="fxTimelineLabel">{label}</span>
          <div>
            <h3>{title}</h3>
            <p className="meta">{body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
