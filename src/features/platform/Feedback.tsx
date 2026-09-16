import { useEffect, useRef } from 'react'

export function Feedback({
  error,
  message,
}: {
  error: string
  message: string
}) {
  const errorRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])
  return (
    <>
      {error && (
        <p className="formAlert" role="alert" ref={errorRef} tabIndex={-1}>
          {error}
        </p>
      )}
      <p className="platformFeedback" role="status">
        {message}
      </p>
    </>
  )
}
