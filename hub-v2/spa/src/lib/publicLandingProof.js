import { useEffect, useState } from 'react'
import { apiGet } from './api.js'
import { fmtDay } from './time.js'

const EMPTY_FIELDS = {
  nextEvent: null,
  groupCount: null,
  openSubmission: null,
}

export const FALLBACK_PROOF_ITEMS = [
  { key: 'event', text: 'What is coming up this week' },
  { key: 'groups', text: 'Which working groups you can join' },
  { key: 'submissions', text: 'Open submissions and recent decisions' },
]

function asItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload)) return payload
  return []
}

function eventInstant(event) {
  const start = Date.parse(event?.startsAt)
  if (Number.isFinite(start)) return start
  const end = Date.parse(event?.endsAt)
  return Number.isFinite(end) ? end : NaN
}

function pickNextEvent(events, now) {
  return (
    (events || [])
      .map((event) => ({ event, at: eventInstant(event) }))
      .filter(
        ({ event, at }) => event?.title && Number.isFinite(at) && at > now,
      )
      .sort((a, b) => a.at - b.at)[0]?.event || null
  )
}

function pickOpenSubmission(submissions, now) {
  return (
    (submissions || []).find((item) => {
      if (!item?.title) return false
      if (!item.deadlineAt) return true
      const deadline = Date.parse(item.deadlineAt)
      return !Number.isFinite(deadline) || deadline > now
    }) || null
  )
}

function publicEvent(event) {
  if (!event) return null
  return {
    title: event.title,
    startsAt: event.startsAt || null,
    endsAt: event.endsAt || null,
  }
}

function publicSubmission(submission) {
  if (!submission) return null
  return { title: submission.title }
}

export function selectPublicLandingProof({
  events = [],
  groups = [],
  submissions = [],
  now = Date.now(),
} = {}) {
  const nextEvent = publicEvent(pickNextEvent(events, now))
  const groupCount = Array.isArray(groups) ? groups.length : 0
  const openSubmission = publicSubmission(pickOpenSubmission(submissions, now))

  if (!nextEvent && groupCount === 0 && !openSubmission) {
    return { status: 'empty', ...EMPTY_FIELDS }
  }

  return {
    status: 'ready',
    nextEvent,
    groupCount: groupCount > 0 ? groupCount : null,
    openSubmission,
  }
}

export async function fetchPublicLandingProof(get = apiGet, now = Date.now()) {
  try {
    const [eventsPayload, groupsPayload, submissionsPayload] =
      await Promise.all([
        get('/events'),
        get('/groups'),
        get('/submissions').catch(() => ({ items: [] })),
      ])
    return selectPublicLandingProof({
      events: asItems(eventsPayload),
      groups: asItems(groupsPayload),
      submissions: asItems(submissionsPayload),
      now,
    })
  } catch {
    return { status: 'error', ...EMPTY_FIELDS }
  }
}

export function publicLandingProofItems(proof) {
  if (proof?.status !== 'ready') return FALLBACK_PROOF_ITEMS

  const eventTime = proof.nextEvent?.startsAt || proof.nextEvent?.endsAt
  const eventItem = proof.nextEvent?.title
    ? {
        key: 'event',
        text: `Next: ${proof.nextEvent.title} · ${fmtDay(eventTime, 'UTC')}`,
        href: '/about',
      }
    : FALLBACK_PROOF_ITEMS[0]

  const groupsItem =
    proof.groupCount > 0
      ? {
          key: 'groups',
          text: `${proof.groupCount} working group${
            proof.groupCount === 1 ? '' : 's'
          } you can read about`,
          href: '/about/working-groups',
        }
      : FALLBACK_PROOF_ITEMS[1]

  const submissionItem = proof.openSubmission?.title
    ? {
        key: 'submissions',
        text: proof.openSubmission.title,
        href: '/about',
      }
    : FALLBACK_PROOF_ITEMS[2]

  return [eventItem, groupsItem, submissionItem]
}

export function usePublicLandingProof() {
  const [proof, setProof] = useState({
    status: 'loading',
    ...EMPTY_FIELDS,
  })

  useEffect(() => {
    let alive = true
    fetchPublicLandingProof().then((next) => {
      if (alive) setProof(next)
    })
    return () => {
      alive = false
    }
  }, [])

  return proof
}
