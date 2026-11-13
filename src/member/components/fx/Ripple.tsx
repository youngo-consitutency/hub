// Adapted from Magic UI's Ripple (MIT, https://magicui.design): concentric rings that breathe
// outward. Pure CSS animation, so the global reduced-motion rule stops it.
import { memo, type CSSProperties } from 'react'

interface RippleProps {
  size?: number
  rings?: number
}

export const Ripple = memo(function Ripple({ size = 200, rings = 8 }: RippleProps) {
  return (
    <div className="fxRipple" aria-hidden>
      {Array.from({ length: rings }, (_, i) => (
        <span
          key={i}
          className="fxRippleRing"
          style={
            {
              '--i': i,
              width: size + i * 70,
              height: size + i * 70,
              opacity: 0.28 - i * 0.03,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
})
