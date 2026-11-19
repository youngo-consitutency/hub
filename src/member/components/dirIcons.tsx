import type { ComponentType } from 'react'
import type { IconBaseProps } from 'react-icons'
import * as tb from 'react-icons/tb'

/**
 * Direction-aware icons. A chevron or arrow that means "forward" or "back" must mirror in
 * right-to-left layouts (Arabic is one of YOUNGO's six policy languages); icons that mean a
 * thing (external link, trending up) must not, so they stay plain react-icons imports.
 * Same names as react-icons/tb, so call sites only change their import path.
 */
const flip = (Icon: ComponentType<IconBaseProps>) =>
  function DirIcon({ className, ...rest }: IconBaseProps) {
    return <Icon {...rest} className={`dirIcon${className ? ` ${className}` : ''}`} />
  }

export const TbChevronRight = flip(tb.TbChevronRight)
export const TbChevronLeft = flip(tb.TbChevronLeft)
export const TbArrowRight = flip(tb.TbArrowRight)
export const TbArrowLeft = flip(tb.TbArrowLeft)
export const TbArrowBackUp = flip(tb.TbArrowBackUp)

/** A literal text arrow ("All →"): decorative, mirrors in RTL. */
export function Arrow() {
  return (
    <span className="dirIcon dirGlyph" aria-hidden>
      →
    </span>
  )
}
