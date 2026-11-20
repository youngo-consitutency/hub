import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import type { NegotiationTracksResponse } from '../../shared/contracts'
import type { Doc } from './types'
import { apiGet, apiPost, errorMessage, useApi } from './api'

// page/paragraph are optional pointers into a cited source
export const sourceLocation = (page: string, paragraph: string) => ({
  ...(page ? { page } : {}),
  ...(paragraph ? { paragraph } : {}),
})

interface Options<F, D> {
  initial: F
  // POST target and the key the saved record comes back under
  endpoint: string
  resultKey: string
  toBody: (form: F, idempotencyKey: string) => unknown
  // runs when the chosen track's detail loads, e.g. to preselect a source
  onTrackLoaded: (form: F, detail: D) => F
}

// shared state for the member proposal forms: pick a negotiation track, load its
// detail, edit fields, save once (the idempotency key survives retries)
export function useProposalForm<F extends Record<string, string>, D = Doc>({
  initial,
  endpoint,
  resultKey,
  toBody,
  onTrackLoaded,
}: Options<F, D>) {
  const tracks = useApi<NegotiationTracksResponse>('/negotiations')
  const [form, setForm] = useState(initial)
  const [trackDetail, setTrackDetail] = useState<D | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<Doc | null>(null)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const trackId = form.trackId
  // the select holds the id as a string while the API sends a number
  const slug = useMemo(
    () => tracks.data?.items.find((track) => String(track.id) === trackId)?.slug,
    [tracks.data, trackId],
  )

  const trackLoaded = useEffectEvent((detail: D) =>
    setForm((current) => onTrackLoaded(current, detail)),
  )

  useEffect(() => {
    let active = true
    setTrackDetail(null)
    if (!slug) return undefined
    apiGet<D>(`/negotiations/${slug}`)
      .then((detail) => {
        if (!active) return
        setTrackDetail(detail)
        trackLoaded(detail)
      })
      .catch((requestError) => active && setError(errorMessage(requestError)))
    return () => {
      active = false
    }
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
      const result = await apiPost<Record<string, Doc>>(endpoint, toBody(form, idempotencyKey))
      setCreated(result[resultKey])
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  return { tracks, form, set, trackDetail, error, saving, created, submit }
}
