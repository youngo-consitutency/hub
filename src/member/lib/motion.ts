import type { Variants } from 'motion/react'

// shared entrance motion for the public pages; MotionConfig turns it off for reduced-motion users
export const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

// play once, a little before the element is fully in view
export const inView = { once: true, margin: '0px 0px -10% 0px' } as const
