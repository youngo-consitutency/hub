import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TbX } from 'react-icons/tb'

let openPanels = 0
let pageOverflow = ''

/** Shared detail/editor surface: native focus trapping, Escape and focus return. */
export function SidePanel({
  title,
  onClose,
  children,
  className = '',
  showTitle = true,
  actions,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
  showTitle?: boolean
  actions?: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeCallback = useRef(onClose)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    closeCallback.current = onClose
  }, [onClose])

  useEffect(() => {
    const dialog = dialogRef.current
    const trigger = document.activeElement
    dialog?.showModal()
    if (openPanels++ === 0) {
      pageOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    return () => {
      dialog?.close()
      if (--openPanels === 0) document.body.style.overflow = pageOverflow
      requestAnimationFrame(() => {
        if (
          trigger instanceof HTMLElement &&
          trigger.isConnected &&
          document.activeElement === document.body
        ) {
          trigger.focus({ preventScroll: true })
        }
      })
    }
  }, [])

  useEffect(() => {
    if (!closing) return
    let cancelled = false
    const animations = dialogRef.current?.getAnimations() || []
    Promise.allSettled(animations.map((animation) => animation.finished)).then(
      () => {
        if (!cancelled) closeCallback.current()
      },
    )
    return () => {
      cancelled = true
    }
  }, [closing])

  const close = () => setClosing(true)
  return (
    <dialog
      ref={dialogRef}
      className={`routePeek ${className}`.trim()}
      aria-label={title}
      data-closing={closing || undefined}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="routePeekToolbar">
        {showTitle && <h2 className="sidePanelTitle">{title}</h2>}
        {actions}
        <button
          type="button"
          className="iconButton"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={close}
        >
          <TbX size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="routePeekBody">{children}</div>
    </dialog>
  )
}
