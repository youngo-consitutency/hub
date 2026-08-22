import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function RoutePeek({ children }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog?.open) dialog?.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      if (dialog?.open) dialog.close()
    }
  }, [])

  const close = () => window.history.back()

  return (
    <dialog
      ref={dialogRef}
      className="routePeek"
      aria-label="Quick view"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="routePeekToolbar">
        <button
          type="button"
          className="iconButton"
          aria-label="Close quick view"
          onClick={close}
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
      <div className="routePeekBody">{children}</div>
    </dialog>
  )
}
