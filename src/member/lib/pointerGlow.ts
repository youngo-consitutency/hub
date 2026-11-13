import type { PointerEvent } from 'react'

// one delegated handler per grid: the hovered `.ldCard` gets --mx/--my for its glow
export function trackPointer(e: PointerEvent<HTMLElement>) {
  const card = (e.target as HTMLElement).closest<HTMLElement>('.ldCard')
  if (!card) return
  const box = card.getBoundingClientRect()
  card.style.setProperty('--mx', `${e.clientX - box.left}px`)
  card.style.setProperty('--my', `${e.clientY - box.top}px`)
}
