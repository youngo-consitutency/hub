import { getPayload, type PayloadRequest } from 'payload'
import type { Doc } from '@/lib/domain'
import config from '@payload-config'
import ical, { ICalAlarmType, ICalCalendarMethod } from 'ical-generator'
import { getEvent, getGroup, listEventsForIcs } from '@/lib/content'
import { getDocument } from '@/lib/documents'
import { eventView } from '@/lib/views'

export const dynamic = 'force-dynamic'

// Feed names come from the `content-options` document so new event types
// need no code change. `plural` labels the per-type feeds.
async function typeLabels(req: PayloadRequest): Promise<Record<string, string>> {
  const doc = await getDocument(req, 'content-options').catch(() => null)
  const entries: unknown[] = Array.isArray(doc?.body?.eventTypes) ? doc.body.eventTypes : []
  return Object.fromEntries(
    entries
      .filter((t): t is { value: string; plural?: string; label?: string } =>
        Boolean(t && typeof t === 'object' && 'value' in t && t.value),
      )
      .map((t) => [t.value, String(t.plural || t.label || t.value)]),
  )
}

const stripIcs = (file: string) => file.replace(/\.ics$/, '')

// calendar feeds carry UTC times and a 15-minute VALARM. they are public and cached, so events go through the same redaction as the json api
// (no meeting url, join links scrubbed from the description)
function buildCalendar({ name, events }: { name: string; events: Record<string, unknown>[] }) {
  const cal = ical({
    name,
    prodId: { company: 'YOUNGO Hub', product: 'Hub', language: 'EN' },
    method: ICalCalendarMethod.PUBLISH,
  })
  for (const event of events) {
    const e: Doc | null | undefined = eventView(event)
    if (!e) continue
    cal.createEvent({
      id: `${e.slug}@youngohub`,
      start: new Date(e.startsAt),
      end: new Date(e.endsAt),
      summary: e.title,
      description: e.description,
      alarms: [{ type: ICalAlarmType.display, trigger: 900, description: 'Reminder' }],
    })
  }
  return cal.toString()
}

function send(filename: string, body: string) {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'public, max-age=900',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}

const notFound = (message: string) =>
  Response.json({ error: { code: 'not_found', message } }, { status: 404 })

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const payload = await getPayload({ config })
  // only `payload` is read by the content helpers and getDocument; there is no request here
  const req = { payload } as PayloadRequest

  const [scope, file] = path
  if (scope === 'all.ics') {
    const events = await listEventsForIcs(req)
    return send('youngo-all.ics', buildCalendar({ name: 'YOUNGO — All events', events }))
  }
  if (!file) return notFound('Unknown calendar feed')
  const id = stripIcs(file)
  if (scope === 'type') {
    const events = await listEventsForIcs(req, { type: id })
    const labels = await typeLabels(req)
    return send(`youngo-${id}.ics`, buildCalendar({ name: `YOUNGO — ${labels[id] || id}`, events }))
  }
  if (scope === 'wg') {
    const group = await getGroup(req, id)
    if (!group) return notFound('Unknown working group')
    const events = await listEventsForIcs(req, { wg: id })
    return send(
      `youngo-${id}.ics`,
      buildCalendar({
        name: `YOUNGO — ${(group as { name?: string }).name || id} WG`,
        events,
      }),
    )
  }
  if (scope === 'event') {
    const event = await getEvent(req, id)
    if (!event) return notFound('Unknown event')
    return send(`${id}.ics`, buildCalendar({ name: event.title, events: [event] }))
  }
  return notFound('Unknown calendar feed')
}
