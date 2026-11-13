'use client'

// Adapted from Magic UI's NumberTicker (MIT, https://magicui.design): the spring and in-view
// logic are theirs, restyled for this project's CSS instead of Tailwind.
import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'motion/react'

interface NumberTickerProps extends ComponentPropsWithoutRef<'span'> {
  value: number
  delay?: number
}

const format = new Intl.NumberFormat('en-GB')

/** Counts up to `value` once it scrolls into view; reduced motion shows the number straight away. */
export function NumberTicker({ value, delay = 0, className, ...props }: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { damping: 60, stiffness: 100 })
  const inView = useInView(ref, { once: true, margin: '0px' })

  useEffect(() => {
    if (!inView || reduced) return undefined
    const timer = setTimeout(() => motionValue.set(value), delay * 1000)
    return () => clearTimeout(timer)
  }, [motionValue, inView, reduced, delay, value])

  useEffect(
    () =>
      spring.on('change', (latest) => {
        if (ref.current) ref.current.textContent = format.format(Math.round(latest))
      }),
    [spring],
  )

  return (
    <span ref={ref} className={`fxTicker ${className ?? ''}`.trim()} {...props}>
      {reduced ? format.format(value) : 0}
    </span>
  )
}
