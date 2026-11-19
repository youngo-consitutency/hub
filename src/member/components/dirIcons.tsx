import type { ComponentType } from 'react'
import type { IconBaseProps } from 'react-icons'
import * as tb from 'react-icons/tb'

/** Direction-aware icons: "forward"/"back" chevrons mirror in RTL; meaning-icons stay plain react-icons. */
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
