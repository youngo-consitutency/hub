import type { ReactNode } from 'react'
import { Button, Dialog, DialogTrigger, Popover, type Placement } from 'react-aria-components'

interface PopoverButtonProps {
  /** names the panel for screen readers */
  label: string
  /** classes for the trigger, usually the shared `btn` ones */
  buttonClassName?: string
  buttonContent: ReactNode
  /** classes for the panel's contents (width, gap, padding) */
  panelClassName?: string
  placement?: Placement
  /** a function receives `close`, so a link inside can dismiss the panel */
  children: ReactNode | ((close: () => void) => ReactNode)
}

/**
 * A button that opens a floating panel. react-aria supplies the positioning, focus handling, Escape
 * and outside-click dismissal that each caller used to hand-roll.
 */
export function PopoverButton({
  label,
  buttonClassName = 'btn btn-secondary',
  buttonContent,
  panelClassName = '',
  placement = 'bottom start',
  children,
}: PopoverButtonProps) {
  return (
    <DialogTrigger>
      <Button className={buttonClassName}>{buttonContent}</Button>
      <Popover
        placement={placement}
        offset={6}
        className="card z-[var(--z-dropdown)] max-w-[min(92vw,380px)] shadow-[var(--shadow-popover)] data-[entering]:animate-[hubPopoverIn_var(--motion-standard)_var(--motion-ease-out)_both]"
      >
        <Dialog aria-label={label} className={`flex flex-col outline-none ${panelClassName}`}>
          {({ close }) => (typeof children === 'function' ? children(close) : children)}
        </Dialog>
      </Popover>
    </DialogTrigger>
  )
}
