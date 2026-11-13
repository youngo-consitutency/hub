import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { AnyValue } from './types'
import { apiGet, apiPost, useApi } from './api'

// page/paragraph are optional pointers into a cited source
export const sourceLocation = (page: string, paragraph: string) => ({
  ...(page ? { page } : {}),
  ...(paragraph ? { paragraph } : {}),
})

interface Options<F> {
  initial: F
  // POST target and the key the saved record comes back under
  endpoint: string
  resultKey: string
  toBody: (form: F, idempotencyKey: string) => unknown
  // runs when the chosen track's detail loads, e.g. to preselect a source
  onTrackLoaded: (form: F, detail: AnyValue) => F
}

// shared state for the member proposal forms: pick a negotiation track, load its
// detail, edit fields, save once (the idempotency key survives retries)
export function useProposalForm<F extends Record<string, string>>({
  initial,
  endpoint,
  resultKey,
  toBody,
  onTrackLoaded,
}: Options<F>) {
  const tracks = useApi('/negotiations')
  const [form, setForm] = useState(initial)
  const [trackDetail, setTrackDetail] = useState<AnyValue>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<AnyValue>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const trackId = form.trackId
  const slug = useMemo(
    () => tracks.data?.items.find((track: AnyValue) => track.id === trackId)?.slug,
    [tracks.data, trackId],
  )

  useEffect(() => {
    let active = true
    setTrackDetail(null)
    if (!slug) return undefined
    apiGet(`/negotiations/${slug}`)
      .then((detail) => {
        if (!active) return
        setTrackDetail(detail)
        setForm((current) => onTrackLoaded(current, detail))
      })
      .catch((requestError) => active && setError(requestError.message))
    return () => {
      active = false
    }
    // onTrackLoaded is a stable module-level function in every caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  const set =
    (name: keyof F) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [name]: event.target.value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await apiPost(endpoint, toBody(form, idempotencyKey))
      setCreated(result[resultKey])
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return { tracks, form, set, trackDetail, error, saving, created, submit }
}
