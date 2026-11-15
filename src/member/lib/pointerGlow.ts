import type { PointerEvent } from 'react'

// surfaces that glow where the pointer is: cards, and the deep hero, page header, footer and sidebar
const GLOW = '.ldCard, .entityCard, .ldDark, .heroBand, .siteFooter, .sidebar'

// one delegated handler on the page shell: the nearest glowing surface gets --mx/--my
export function trackPointer(e: PointerEvent<HTMLElement>) {
  const surface = (e.target as HTMLElement).closest<HTMLElement>(GLOW)
  if (!surface) return
  const box = surface.getBoundingClientRect()
  surface.style.setProperty('--mx', `${e.clientX - box.left}px`)
  surface.style.setProperty('--my', `${e.clientY - box.top}px`)
}
