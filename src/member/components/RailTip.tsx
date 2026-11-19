import { useSyncExternalStore, type ComponentProps } from 'react'
import { Focusable, Tooltip, TooltipTrigger } from 'react-aria-components'

// the tablet icon rail (see shell.css / design-language.css) hides labels, so the label becomes a
// tooltip that keyboard focus and touch long-press can reach, which a bare `title` never is
const RAIL = '(min-width: 768px) and (max-width: 1279px)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(RAIL)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const useRail = () =>
  useSyncExternalStore(
    subscribe,
    () => window.matchMedia(RAIL).matches,
    () => false,
  )

export function RailTip({
  label,
  children,
}: {
  label: string
  children: ComponentProps<typeof Focusable>['children']
}) {
  const rail = useRail()
  return (
    <TooltipTrigger delay={200} closeDelay={0} isDisabled={!rail}>
      <Focusable>{children}</Focusable>
      <Tooltip className="railTooltip" placement="end" offset={10}>
        {label}
      </Tooltip>
    </TooltipTrigger>
  )
}
