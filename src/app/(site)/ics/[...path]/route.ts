import { getPayload } from 'payload'
import config from '@payload-config'
import ical, { ICalAlarmType, ICalCalendarMethod } from 'ical-generator'
import { getEvent, getGroup, listEventsForIcs } from '@/lib/content'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  constituency_call: 'Constituency calls',
  wg_call: 'Working group calls',
  wgf: 'WG forums',
  unfccc_session: 'UNFCCC sessions',
  webinar: 'Webinars',
  coordination: 'Coordination',
}

const stripIcs = (file: string) => file.replace(/\.ics$/, '')

// Calendar feeds carry UTC times, meeting URLs and a 15-minute VALARM.
function buildCalendar({ name, events }: { name: string; events: any[] }) {
  const cal = ical({
    name,
    prodId: { company: 'YOUNGO Hub', product: 'Hub', language: 'EN' },
    method: ICalCalendarMethod.PUBLISH,
  })
  for (const e of events) {
    cal.createEvent({
      id: `${e.slug}@youngohub`,
      start: new Date(e.startsAt),
      end: new Date(e.endsAt),
      summary: e.title,
      description: e.description,
      url: e.meetingUrl,
      location: e.meetingUrl,
      alarms: [
        { type: ICalAlarmType.display, trigger: 900, description: 'Reminder' },
      ],
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const payload = await getPayload({ config })
  const req = { payload } as any

  const [scope, file] = path
  if (scope === 'all.ics') {
    const events = await listEventsForIcs(req)
    return send(
      'youngo-all.ics',
      buildCalendar({ name: 'YOUNGO — All events', events }),
    )
  }
  if (!file) return notFound('Unknown calendar feed')
  const id = stripIcs(file)
  if (scope === 'type') {
    const events = await listEventsForIcs(req, { type: id })
    return send(
      `youngo-${id}.ics`,
      buildCalendar({ name: `YOUNGO — ${TYPE_LABEL[id] || id}`, events }),
    )
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
    return send(
      `${id}.ics`,
      buildCalendar({ name: event.title, events: [event] }),
    )
  }
  return notFound('Unknown calendar feed')
}
