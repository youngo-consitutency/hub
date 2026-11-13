'use client'

// Adapted from Magic UI's BorderBeam (MIT, https://magicui.design): a light that travels around
// the parent's border. Restyled for this project's CSS instead of Tailwind.
import { motion, useReducedMotion, type MotionStyle } from 'motion/react'

interface BorderBeamProps {
  size?: number
  duration?: number
  delay?: number
  colorFrom?: string
  colorTo?: string
  borderWidth?: number
}

/** Place inside a `position: relative` element with a border radius. */
export function BorderBeam({
  size = 80,
  duration = 8,
  delay = 0,
  colorFrom = 'var(--ld-glow-green)',
  colorTo = 'var(--ld-glow-lime)',
  borderWidth = 1,
}: BorderBeamProps) {
  // the beam is decoration, so reduced motion drops it entirely
  if (useReducedMotion()) return null
  return (
    <div
      className="fxBeam"
      aria-hidden
      style={{ '--beam-width': `${borderWidth}px` } as React.CSSProperties}
    >
      <motion.div
        className="fxBeamDot"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            '--from': colorFrom,
            '--to': colorTo,
          } as MotionStyle
        }
        initial={{ offsetDistance: '0%' }}
        animate={{ offsetDistance: ['0%', '100%'] }}
        transition={{ repeat: Infinity, ease: 'linear', duration, delay: -delay }}
      />
    </div>
  )
}
